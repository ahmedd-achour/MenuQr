import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, docData, updateDoc, setDoc, collection, getDocs, getDoc, query, where } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderPartnerComponent } from '../header-partner/header-partner.component';

interface UserProfile {
  id: string;
  email?: string;
  fullName?: string;
  currentRestaurantId?: string;
  phone?: string;
  status?: string;
}

interface Restaurant {
  id: string;
  businessName?: string;
  logo?: string;
  coverImage?: string;
  address?: string;
  city?: string;
  description?: string;
  currency?: string;
  language?: string;
  status?: string;
}

interface Theme {
  restaurantId: string;
  primaryColor: string;
  secondaryColor: string;
  background: string;
  cardColor: string;
  font: string;
  radius: number;
  darkMode: boolean;
}

@Component({
  selector: 'app-home-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderPartnerComponent],
  templateUrl: './home-partners.component.html',
  styleUrl: './home-partners.component.css'
})
export class HomePartnersComponent implements OnInit {

  userId: string = '';
  userProfile?: UserProfile;

  // Display data (from Firestore)
  restaurantData: Restaurant = {} as Restaurant;
  themeData: Theme = {} as Theme;

  // Editable form data (prevents reset)
  editRestaurant: any = {};
  editTheme: any = {};

  addedProducts: any[] = [];
  isSaving = false;
  notificationMessage = '';
  isError = false;

  categories: any[] = [];
  selectedCategoryId: string = 'all';
  productLimit = 8;
  hasMoreProducts = false;

  get activeCategories(): any[] {
    return this.categories.filter(cat =>
      this.addedProducts.some(p => p.categoryId === cat.id && p.visible)
    );
  }

  get filteredPreviewProducts(): any[] {
    const visibleProds = this.addedProducts.filter(p => p.visible);
    return this.selectedCategoryId === 'all'
      ? visibleProds
      : visibleProds.filter(p => p.categoryId === this.selectedCategoryId);
  }

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private storage: Storage
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.loadAllData();
    } else {
      this.triggerAlert('ID utilisateur manquant dans l\'URL.', true);
    }
  }

  private loadAllData(): void {
    const userRef = doc(this.firestore, `users/${this.userId}`);
    docData(userRef, { idField: 'id' }).subscribe({
      next: (user: any) => {
        if (user) {
          this.userProfile = user;
          if (user.currentRestaurantId) {
            this.loadRestaurant(user.currentRestaurantId);
          }
        }
      },
      error: (err) => this.triggerAlert('Impossible de charger les données utilisateur.', true)
    });
  }

  private loadRestaurant(restaurantId: string): void {
    const restRef = doc(this.firestore, `restaurants/${restaurantId}`);
    docData(restRef, { idField: 'id' }).subscribe({
      next: (data: any) => {
        if (data) {
          this.restaurantData = { ...data, id: restaurantId };
          this.editRestaurant = { ...this.restaurantData }; // Copy for editing
          this.loadTheme(restaurantId);
          this.loadAddedProducts(restaurantId);
        }
      },
      error: () => this.triggerAlert('Erreur lors du chargement du restaurant.', true)
    });
  }

  private loadTheme(restaurantId: string): void {
    const themeRef = doc(this.firestore, `themes/theme_${restaurantId}`);

    getDoc(themeRef).then(snapshot => {
      const data = snapshot.data();
      if (data) {
        this.themeData = { ...data, restaurantId } as Theme;
      } else {
        this.themeData = this.getDefaultTheme(restaurantId);
      }
      this.editTheme = { ...this.themeData }; // Copy for editing
    }).catch(() => {
      this.themeData = this.getDefaultTheme(restaurantId);
      this.editTheme = { ...this.themeData };
    });
  }

  private getDefaultTheme(restaurantId: string): Theme {
    return {
      restaurantId,
      primaryColor: '#d97706',
      secondaryColor: '#78350f',
      background: '#ffffff',
      cardColor: '#f8fafc',
      font: 'Outfit',
      radius: 8,
      darkMode: false
    };
  }

  private async loadAddedProducts(restaurantId: string): Promise<void> {
    // ... (kept same as before - no change needed)
    try {
      await this.fetchCategories();
      const prodRef = collection(this.firestore, 'restaurant_products');
      const q = query(prodRef, where('restaurantId', '==', restaurantId));
      const snapshot = await getDocs(q);

      this.hasMoreProducts = snapshot.docs.length > this.productLimit;
      const docsToFetch = snapshot.docs.slice(0, this.productLimit);

      const masterSnap = await getDocs(collection(this.firestore, 'master_products'));
      const mastersMap = new Map(masterSnap.docs.map(d => [d.id, d.data()]));

      this.addedProducts = docsToFetch.map(d => {
        const data = d.data();
        const master = mastersMap.get(data['masterProductId']) || {};
        return {
          id: d.id,
          name: data['nameSnapshot'] || master['name'] || 'Produit',
          image: data['imageOverride'] || master['image'] || '',
          description: data['descriptionOverride'] || master['description'] || '',
          price: data['priceVariant'] || master['price'] || 0,
          visible: data['visible'] !== false,
          categoryId: master['categoryId'] || '',
          displayOrder: data['displayOrder'] !== undefined ? data['displayOrder'] : 99
        };
      });
    } catch (err) {
      console.error('Products load error:', err);
    }
  }

  private async fetchCategories(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(this.firestore, 'master_categories'), where('active', '==', true)));
      this.categories = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name'],
        order: doc.data()['order'] || 99
      })).sort((a, b) => a.order - b.order);
    } catch (e) {
      console.warn('Categories fetch failed:', e);
    }
  }

  // ==================== SAVE ====================
  onSave(): void {
    if (!this.restaurantData.id) return;

    this.isSaving = true;

    const restaurantPayload = {
      businessName: this.editRestaurant.businessName,
      address: this.editRestaurant.address,
      city: this.editRestaurant.city,
      description: this.editRestaurant.description,
      currency: this.editRestaurant.currency || 'TND',
      language: this.editRestaurant.language || 'fr',
      updatedAt: new Date()
    };

    const restaurantRef = doc(this.firestore, `restaurants/${this.restaurantData.id}`);
    const themeRef = doc(this.firestore, `themes/theme_${this.restaurantData.id}`);

    Promise.all([
      updateDoc(restaurantRef, restaurantPayload),
      setDoc(themeRef, this.editTheme, { merge: true })
    ])
    .then(() => {
      // Sync back to display data
      this.restaurantData = { ...this.restaurantData, ...this.editRestaurant };
      this.themeData = { ...this.editTheme };

      this.triggerAlert('✅ Modifications sauvegardées avec succès !', false);
    })
    .catch(err => {
      console.error(err);
      this.triggerAlert('❌ Erreur de sauvegarde.', true);
    })
    .finally(() => this.isSaving = false);
  }

  // Media Upload
  uploadMedia(event: any, field: 'logo' | 'coverImage'): void {
    const file = event.target?.files?.[0];
    if (!file || !this.restaurantData.id) return;

    this.isSaving = true;
    const path = `restaurants/${this.restaurantData.id}/${field}_${Date.now()}`;
    const storageRef = ref(this.storage, path);

    uploadBytes(storageRef, file)
      .then(snapshot => getDownloadURL(snapshot.ref))
      .then(url => {
        if (field === 'logo') {
          this.restaurantData.logo = url;
          this.editRestaurant.logo = url;
        } else {
          this.restaurantData.coverImage = url;
          this.editRestaurant.coverImage = url;
        }
        this.triggerAlert(`${field === 'logo' ? 'Logo' : 'Couverture'} mis à jour.`, false);
      })
      .catch(() => this.triggerAlert('Échec du téléversement.', true))
      .finally(() => this.isSaving = false);
  }

  downloadQRCode(): void {
    if (!this.userId) return;
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=http://localhost:4200/qr-code/${this.userId}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-menu-${this.restaurantData.businessName || 'restaurant'}.png`;
    a.click();
  }

  private triggerAlert(message: string, isError: boolean): void {
    this.notificationMessage = message;
    this.isError = isError;
    setTimeout(() => this.notificationMessage = '', 5000);
  }

  // Load more products
  loadMoreProducts(): void {
    this.productLimit += 8;
    if (this.restaurantData.id) this.loadAddedProducts(this.restaurantData.id);
  }

  loadAllProducts(): void {
    this.productLimit = 99999;
    if (this.restaurantData.id) this.loadAddedProducts(this.restaurantData.id);
  }
}
