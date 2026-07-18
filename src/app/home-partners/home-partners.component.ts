import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  phone : string;
  status?: string;
}

interface Restaurant {
  id: string;
  ownerId?: string;
  businessName?: string;
  slug?: string;
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
  imports: [CommonModule, FormsModule, HeaderPartnerComponent, RouterLink],
  templateUrl: './home-partners.component.html',
  styleUrl: './home-partners.component.css'
})
export class HomePartnersComponent implements OnInit {

  userId: string = '';
  userProfile?: UserProfile ;

  restaurantData: Restaurant = {
    id: '',
    businessName: '',
    logo: '',
    coverImage: '',
    address: '',
    city: '',
    description: '',
    currency: 'TND',
    language: 'fr',
    status: 'trial'
  };

  themeData: Theme = {
    restaurantId: '',
    primaryColor: '#d97706',
    secondaryColor: '#78350f',
    background: '#ffffff',
    cardColor: '#f8fafc',
    font: 'Outfit',
    radius: 8,
    darkMode: false
  };

  addedProducts: any[] = [];
  isSaving = false;
  notificationMessage = '';
  isError = false;

  // Category selection and product pagination states
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
    if (this.selectedCategoryId === 'all') {
      return visibleProds;
    }
    return visibleProds.filter(p => p.categoryId === this.selectedCategoryId);
  }

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private storage: Storage
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    console.log('[HomePartners] User ID from route:', this.userId);

    if (this.userId) {
      this.loadAllData();
    } else {
      this.triggerAlert('ID utilisateur manquant dans l\'URL.', true);
    }
  }

  private loadAllData(): void {
    // Load User
    const userRef = doc(this.firestore, `users/${this.userId}`);
    docData(userRef, { idField: 'id' }).subscribe({
      next: (user: any) => {
        console.log('[HomePartners] User data loaded:', user);
        if (user) {
          this.userProfile = user as UserProfile;

          if (user.currentRestaurantId) {
            this.loadRestaurant(user.currentRestaurantId);
          } else {
            this.triggerAlert('Aucun restaurant lié à ce compte.', true);
          }
        }
      },
      error: (err) => {
        console.error('[HomePartners] User load error:', err);
        this.triggerAlert('Impossible de charger les données utilisateur.', true);
      }
    });
  }

  private loadRestaurant(restaurantId: string): void {
    console.log('[HomePartners] Loading restaurant:', restaurantId);
    const restRef = doc(this.firestore, `restaurants/${restaurantId}`);
    docData(restRef, { idField: 'id' }).subscribe({
      next: (data: any) => {
        console.log('[HomePartners] Restaurant data:', data);
        if (data) {
          this.restaurantData = { ...data, id: restaurantId } as Restaurant;
          this.loadTheme(restaurantId);
          this.loadAddedProducts(restaurantId);
        } else {
          this.triggerAlert('Restaurant non trouvé.', true);
        }
      },
      error: (err) => {
        console.error('[HomePartners] Restaurant load error:', err);
        this.triggerAlert('Erreur lors du chargement du restaurant.', true);
      }
    });
  }

  private loadTheme(restaurantId: string): void {
    const themeRef = doc(this.firestore, `themes/theme_${restaurantId}`);
    docData(themeRef).subscribe({
      next: (data: any) => {
        if (data) {
          this.themeData = { ...data, restaurantId } as Theme;
          console.log('[HomePartners] Theme loaded:', this.themeData);
        }
      },
      error: (err) => console.warn('Theme load warning:', err)
    });
  }

  private async fetchCategories(): Promise<void> {
    try {
      const categoriesRef = collection(this.firestore, 'master_categories');
      const categoriesQuery = query(categoriesRef, where('active', '==', true));
      const snap = await getDocs(categoriesQuery);
      this.categories = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'],
          icon: data['icon'] || '',
          order: data['order'] !== undefined ? data['order'] : 99
        };
      }).sort((a, b) => a.order - b.order);
    } catch (e) {
      console.warn('[HomePartners] Failed to fetch categories:', e);
    }
  }

  private async loadAddedProducts(restaurantId: string): Promise<void> {
    try {
      await this.fetchCategories();

      const prodRef = collection(this.firestore, 'restaurant_products');
      const q = query(prodRef, where('restaurantId', '==', restaurantId));
      const snapshot = await getDocs(q);

      const totalCount = snapshot.docs.length;
      this.hasMoreProducts = totalCount > this.productLimit;

      const docsToFetch = snapshot.docs.slice(0, this.productLimit);

      // Fetch master products details to map categoryId
      const masterRef = collection(this.firestore, 'master_products');
      const masterSnap = await getDocs(masterRef);
      const mastersMap = new Map(masterSnap.docs.map(d => [d.id, d.data()]));

      const products = docsToFetch.map((d) => {
        const data = d.data();
        const masterProductId = data['masterProductId'] || '';
        const master = mastersMap.get(masterProductId) || {};
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

      this.addedProducts = products;
      console.log(`[HomePartners] Loaded ${products.length} products (Limit: ${this.productLimit})`);
    } catch (err) {
      console.error('Products load error:', err);
    }
  }

  loadMoreProducts(): void {
    this.productLimit += 8;
    if (this.restaurantData.id) {
      this.loadAddedProducts(this.restaurantData.id);
    }
  }

  loadAllProducts(): void {
    this.productLimit = 99999;
    if (this.restaurantData.id) {
      this.loadAddedProducts(this.restaurantData.id);
    }
  }

  onSave(): void {
    if (!this.restaurantData.id) {
      this.triggerAlert('Aucun restaurant à sauvegarder.', true);
      return;
    }

    this.isSaving = true;

    const restaurantPayload = {
      businessName: this.restaurantData.businessName,
      address: this.restaurantData.address,
      city: this.restaurantData.city,
      description: this.restaurantData.description,
      currency: this.restaurantData.currency,
      language: this.restaurantData.language,
      updatedAt: new Date()
    };

    const restaurantRef = doc(this.firestore, `restaurants/${this.restaurantData.id}`);

    updateDoc(restaurantRef, restaurantPayload)
      .then(() => {
        const themeRef = doc(this.firestore, `themes/theme_${this.restaurantData.id}`);
        return setDoc(themeRef, this.themeData, { merge: true });
      })
      .then(() => {
        this.isSaving = false;
        this.triggerAlert('✅ Modifications sauvegardées avec succès !', false);
      })
      .catch(err => {
        this.isSaving = false;
        console.error(err);
        this.triggerAlert('❌ Erreur de sauvegarde : ' + err.message, true);
      });
  }

  uploadMedia(event: any, field: 'logo' | 'coverImage'): void {
    const file = event.target?.files?.[0];
    if (!file || !this.restaurantData.id) return;

    this.isSaving = true;
    const path = `restaurants/${this.restaurantData.id}/${field}_${Date.now()}`;
    const storageRef = ref(this.storage, path);

    uploadBytes(storageRef, file)
      .then(snapshot => getDownloadURL(snapshot.ref))
      .then(url => {
        if (field === 'logo') this.restaurantData.logo = url;
        else this.restaurantData.coverImage = url;

        this.isSaving = false;
        this.triggerAlert(`${field === 'logo' ? 'Logo' : 'Couverture'} téléchargé avec succès.`, false);
      })
      .catch(err => {
        this.isSaving = false;
        this.triggerAlert('Échec du téléversement.', true);
        console.error(err);
      });
  }

  downloadQRCode(): void {
    if (!this.userId) return;
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=http://localhost:4200/qr-code/${this.userId}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-menu-${this.restaurantData.businessName || 'my-restaurant'}.png`;
    a.click();
  }

  private triggerAlert(message: string, isError: boolean): void {
    this.notificationMessage = message;
    this.isError = isError;
    setTimeout(() => this.notificationMessage = '', 6000);
  }
}
