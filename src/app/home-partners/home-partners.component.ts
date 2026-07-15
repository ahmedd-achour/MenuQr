import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Firestore, doc, docData, updateDoc, setDoc, collection, getDocs, getDoc, query, where } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderPartnerComponent } from '../header-partner/header-partner.component';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  currentRestaurantId: string;
  status: string;
}

interface Restaurant {
  id: string;
  ownerId: string;
  businessName: string;
  slug: string;
  logo: string;
  coverImage: string;
  address: string;
  city: string;
  description: string;
  currency: string;
  language: string;
  status: string;
}

interface Theme {
  id?: string;
  restaurantId: string;
  primaryColor: string;
  secondaryColor: string;
  background: string;
  cardColor: string;
  font?: string;
  radius?: number;
  darkMode: boolean;
}

@Component({
  selector: 'app-home-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderPartnerComponent],
  templateUrl: './home-partners.component.html',
  styleUrl: './home-partners.component.css'
})
export class HomePartnersComponent implements OnInit {

  userId!: string;
  userProfile?: UserProfile;
  restaurantData: Restaurant = {
    id: '',
    ownerId: '',
    businessName: '',
    slug: '',
    logo: '',
    coverImage: '',
    address: '',
    city: '',
    description: '',
    currency: 'TND',
    language: 'fr',
    status: 'trial'
  };

  themeDocId!: string;
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

  isSaving = false;
  notificationMessage = '';
  isError = false;
  addedProducts: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private storage: Storage
  ) {}

  ngOnInit(): void {
    // 1. Fetch Route UID Parameter: home-partner/:id
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.loadPartnerAndRestaurant();
    } else {
      this.triggerAlert('Invalid session ID. Please log in again.', true);
    }
  }

  /**
   * Retrieves user configuration first, then grabs the associated Restaurant document
   */
  private loadPartnerAndRestaurant(): void {
    const userDocRef = doc(this.firestore, `users/${this.userId}`);
    docData(userDocRef).subscribe({
      next: (user: any) => {
        if (user) {
          this.userProfile = user as UserProfile;
          if (user.currentRestaurantId) {
            this.fetchRestaurant(user.currentRestaurantId);
          } else {
            this.triggerAlert('No active restaurant profile linked to this account.', true);
          }
        } else {
          this.triggerAlert('User document not found in the platform database.', true);
        }
      },
      error: (err) => {
        console.error(err);
        this.triggerAlert('Error loading partner data.', true);
      }
    });
  }

  private fetchRestaurant(restaurantId: string): void {
    const restaurantDocRef = doc(this.firestore, `restaurants/${restaurantId}`);
    docData(restaurantDocRef).subscribe({
      next: (restaurant: any) => {
        if (restaurant) {
          this.restaurantData = { ...restaurant } as Restaurant;
          this.fetchTheme(restaurantId);
          this.fetchAddedProducts(restaurantId);
        }
      },
      error: (err) => {
        console.error(err);
        this.triggerAlert('Error loading restaurant data.', true);
      }
    });
  }

  private fetchTheme(restaurantId: string): void {
    this.themeDocId = `theme_${restaurantId}`;
    const themeDocRef = doc(this.firestore, `themes/${this.themeDocId}`);
    docData(themeDocRef).subscribe({
      next: (theme: any) => {
        if (theme) {
          this.themeData = { ...theme } as Theme;
        } else {
          this.themeData = {
            id: this.themeDocId,
            restaurantId: restaurantId,
            primaryColor: '#d97706',
            secondaryColor: '#78350f',
            background: '#ffffff',
            cardColor: '#f8fafc',
            font: 'Outfit',
            radius: 8,
            darkMode: false
          };
        }
      },
      error: (err) => {
        console.error('Error fetching theme:', err);
      }
    });
  }

  /**
   * Safely updates only the permitted attributes of the restaurant (Excludes phone/email)
   */
  onSave(): void {
    if (!this.restaurantData.id) return;
    this.isSaving = true;

    const payload = {
      businessName: this.restaurantData.businessName,
      slug: this.generateSlug(this.restaurantData.businessName),
      logo: this.restaurantData.logo,
      coverImage: this.restaurantData.coverImage,
      address: this.restaurantData.address,
      city: this.restaurantData.city,
      description: this.restaurantData.description,
      currency: this.restaurantData.currency,
      language: this.restaurantData.language,
      menuVersion: (this.restaurantData as any).menuVersion ? (this.restaurantData as any).menuVersion + 1 : 1
    };

    const restaurantDocRef = doc(this.firestore, `restaurants/${this.restaurantData.id}`);
    updateDoc(restaurantDocRef, payload)
      .then(() => {
        const themeDocRef = doc(this.firestore, `themes/${this.themeDocId}`);
        return setDoc(themeDocRef, {
          restaurantId: this.restaurantData.id,
          primaryColor: this.themeData.primaryColor,
          secondaryColor: this.themeData.secondaryColor,
          background: this.themeData.background,
          cardColor: this.themeData.cardColor,
          font: this.themeData.font || 'Outfit',
          radius: Number(this.themeData.radius) || 8,
          darkMode: !!this.themeData.darkMode
        }, { merge: true });
      })
      .then(() => {
        this.isSaving = false;
        this.triggerAlert('Restaurant profile and theme configuration successfully updated!', false);
      })
      .catch((err) => {
        this.isSaving = false;
        this.triggerAlert('Error updating profile: ' + err.message, true);
      });
  }

  /**
   * Performs dynamic media file upload directly to Firebase Cloud Storage
   */
  uploadMedia(event: Event, targetField: 'logo' | 'coverImage'): void {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement.files || inputElement.files.length === 0) return;

    const file = inputElement.files[0];
    const path = `restaurants/${this.restaurantData.id}/${targetField}_${Date.now()}`;
    const storageRef = ref(this.storage, path);

    this.isSaving = true;

    uploadBytes(storageRef, file)
      .then((snapshot) => getDownloadURL(snapshot.ref))
      .then((url) => {
        if (targetField === 'logo') {
          this.restaurantData.logo = url;
        } else {
          this.restaurantData.coverImage = url;
        }
        this.isSaving = false;
        this.triggerAlert(`${targetField === 'logo' ? 'Logo' : 'Cover image'} uploaded. Save changes to finalize.`, false);
      })
      .catch((err) => {
        this.isSaving = false;
        this.triggerAlert('Upload failed: ' + err.message, true);
      });
  }

  /**
   * Generates a cleaner SEO-ready slug mapping from user business inputs
   */
  private generateSlug(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start
      .replace(/-+$/, '');            // Trim - from end
  }

  private triggerAlert(msg: string, isErr: boolean): void {
    this.notificationMessage = msg;
    this.isError = isErr;
    setTimeout(() => {
      this.notificationMessage = '';
    }, 6000);
  }

  private async fetchAddedProducts(restaurantId: string): Promise<void> {
    try {
      const localProductsRef = collection(this.firestore, 'restaurant_products');
      const localQuery = query(localProductsRef, where('restaurantId', '==', restaurantId));
      const snapshot = await getDocs(localQuery);

      const fetchPromises = snapshot.docs.map(async (d) => {
        const prodData = d.data();
        const masterProductId = prodData['masterProductId'];
        
        let name = 'Produit';
        let defaultImage = '';
        let description = '';
        
        if (masterProductId) {
          const masterDocRef = doc(this.firestore, `master_products/${masterProductId}`);
          const masterSnap = await getDoc(masterDocRef);
          if (masterSnap.exists()) {
            const masterData = masterSnap.data();
            name = masterData['name'] || name;
            defaultImage = masterData['image'] || defaultImage;
            description = masterData['description'] || description;
          }
        }

        return {
          id: d.id,
          name: name,
          image: prodData['imageOverride'] || defaultImage,
          description: prodData['descriptionOverride'] || description,
          price: prodData['priceVariant'] || 12.00,
          visible: prodData['visible'] !== false,
          displayOrder: prodData['displayOrder'] || 0
        };
      });

      this.addedProducts = await Promise.all(fetchPromises);
      this.addedProducts.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (err) {
      console.error('Error fetching active products:', err);
    }
  }

}
