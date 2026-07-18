import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, doc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

interface UserDoc {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  isVerified: boolean;
  isAdmin: boolean;
  currentRestaurantId: string;
  createdAt: any;
}

interface RestaurantDoc {
  id: string;
  businessName: string;
  ownerId: string;
  email: string;
  phone: string;
  city: string;
  type: string;
  status: string;
  active: boolean;
  licenseStatus: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  activeTab: 'users' | 'products' = 'users';

  users: UserDoc[] = [];
  restaurants: RestaurantDoc[] = [];

  // Editing state
  editingUser: Partial<UserDoc> | null = null;
  editingRestaurant: Partial<RestaurantDoc> | null = null;

  saving = false;
  successMsg = '';
  errorMsg = '';

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    // Load users
    const usersRef = collection(this.firestore, 'users');
    (collectionData(usersRef, { idField: 'id' }) as Observable<UserDoc[]>)
      .subscribe(data => this.users = data);

    // Load restaurants
    const restRef = collection(this.firestore, 'restaurants');
    (collectionData(restRef, { idField: 'id' }) as Observable<RestaurantDoc[]>)
      .subscribe(data => this.restaurants = data);
  }

  // ─── USERS ───────────────────────────────────────────────────────────────

  openEditUser(user: UserDoc) {
    this.editingUser = { ...user };
    this.successMsg = '';
    this.errorMsg = '';
  }

  cancelEditUser() {
    this.editingUser = null;
  }

  async saveUser() {
    if (!this.editingUser?.id) return;
    this.saving = true;
    this.successMsg = '';
    this.errorMsg = '';
    try {
      const ref = doc(this.firestore, `users/${this.editingUser.id}`);
      await updateDoc(ref, {
        fullName: this.editingUser.fullName,
        email: this.editingUser.email,
        phone: this.editingUser.phone,
        role: this.editingUser.role,
        status: this.editingUser.status,
        isVerified: this.editingUser.isVerified,
        isAdmin: this.editingUser.isAdmin,
      });
      this.successMsg = 'User updated successfully.';
      this.editingUser = null;
    } catch (e: any) {
      this.errorMsg = e.message || 'Failed to update user.';
    } finally {
      this.saving = false;
    }
  }

  async toggleVerified(user: UserDoc) {
    const ref = doc(this.firestore, `users/${user.id}`);
    await updateDoc(ref, { isVerified: !user.isVerified });
  }

  // ─── RESTAURANTS / PRODUCTS ───────────────────────────────────────────────

  openEditRestaurant(r: RestaurantDoc) {
    this.editingRestaurant = { ...r };
    this.successMsg = '';
    this.errorMsg = '';
  }

  cancelEditRestaurant() {
    this.editingRestaurant = null;
  }

  async saveRestaurant() {
    if (!this.editingRestaurant?.id) return;
    this.saving = true;
    this.successMsg = '';
    this.errorMsg = '';
    try {
      const ref = doc(this.firestore, `restaurants/${this.editingRestaurant.id}`);
      await updateDoc(ref, {
        businessName: this.editingRestaurant.businessName,
        email: this.editingRestaurant.email,
        phone: this.editingRestaurant.phone,
        city: this.editingRestaurant.city,
        type: this.editingRestaurant.type,
        status: this.editingRestaurant.status,
        active: this.editingRestaurant.active,
        licenseStatus: this.editingRestaurant.licenseStatus,
      });
      this.successMsg = 'Restaurant updated successfully.';
      this.editingRestaurant = null;
    } catch (e: any) {
      this.errorMsg = e.message || 'Failed to update restaurant.';
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(r: RestaurantDoc) {
    const ref = doc(this.firestore, `restaurants/${r.id}`);
    await updateDoc(ref, { active: !r.active });
  }
}
