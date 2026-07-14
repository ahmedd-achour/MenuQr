import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Firestore, doc, docData, updateDoc } from '@angular/fire/firestore';
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

  isSaving = false;
  notificationMessage = '';
  isError = false;

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
        }
      },
      error: (err) => {
        console.error(err);
        this.triggerAlert('Error loading restaurant data.', true);
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
        this.isSaving = false;
        this.triggerAlert('Restaurant profile successfully updated!', false);
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

}
