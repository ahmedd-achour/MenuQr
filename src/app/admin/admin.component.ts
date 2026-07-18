import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, doc, updateDoc } from '@angular/fire/firestore';
import { Auth, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

interface UserDoc {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  isVerified: boolean;
  paid: boolean;
  trialEndsAt?: any;
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
  activeTab: 'dashboard' | 'users' | 'products' = 'dashboard';
  sidebarMini = false;
  currentYear = new Date().getFullYear();

  users: UserDoc[] = [];
  restaurants: RestaurantDoc[] = [];

  // Editing state
  editingUser: (Partial<UserDoc> & { trialEndsAtStr?: string }) | null = null;
  editingRestaurant: Partial<RestaurantDoc> | null = null;

  saving = false;
  successMsg = '';
  errorMsg = '';

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);

  // Helper to determine if a user is blocked (not paid and past their trial date)
  isUserBlocked(user: UserDoc): boolean {
    if (user.paid) return false;

    let trialEndsDate: Date;
    if (user.trialEndsAt) {
      if (typeof user.trialEndsAt.toDate === 'function') {
        trialEndsDate = user.trialEndsAt.toDate();
      } else {
        trialEndsDate = new Date(user.trialEndsAt);
      }
    } else if (user.createdAt) {
      let createdDate = typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate() : new Date(user.createdAt);
      trialEndsDate = new Date(createdDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    } else {
      return true; // blocked if no trial/createdAt info
    }

    return new Date().getTime() > trialEndsDate.getTime();
  }

  // Format trial end date to local date string for table
  formatTrialEnd(user: UserDoc): string {
    if (user.paid) return 'N/A';
    
    let trialEndsDate: Date;
    if (user.trialEndsAt) {
      trialEndsDate = typeof user.trialEndsAt.toDate === 'function' ? user.trialEndsAt.toDate() : new Date(user.trialEndsAt);
    } else if (user.createdAt) {
      let createdDate = typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate() : new Date(user.createdAt);
      trialEndsDate = new Date(createdDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    } else {
      return '—';
    }

    return trialEndsDate.toLocaleDateString();
  }

  // Getters for metrics
  get paidCount(): number {
    return this.users.filter(u => u.paid).length;
  }

  get trialCount(): number {
    return this.users.filter(u => !u.paid && !this.isUserBlocked(u)).length;
  }

  get blockedCount(): number {
    return this.users.filter(u => this.isUserBlocked(u)).length;
  }

  get activeRestaurantsCount(): number {
    return this.restaurants.filter(r => r.active).length;
  }

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

  toggleSidebar() {
    this.sidebarMini = !this.sidebarMini;
  }

  closeSidebar() {
    this.sidebarMini = false;
  }

  async logout() {
    try {
      await signOut(this.auth);
      await this.router.navigate(['/']);
    } catch (e: any) {
      console.error('Logout failed', e);
    }
  }

  // ─── USERS ───────────────────────────────────────────────────────────────

  openEditUser(user: UserDoc) {
    let trialEndsDate: Date | null = null;
    if (user.trialEndsAt) {
      trialEndsDate = typeof user.trialEndsAt.toDate === 'function' ? user.trialEndsAt.toDate() : new Date(user.trialEndsAt);
    } else if (user.createdAt) {
      let createdDate = typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate() : new Date(user.createdAt);
      trialEndsDate = new Date(createdDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    }

    let trialEndsAtStr = '';
    if (trialEndsDate) {
      // YYYY-MM-DD format for date input
      trialEndsAtStr = trialEndsDate.toISOString().substring(0, 10);
    }

    this.editingUser = {
      ...user,
      trialEndsAtStr: trialEndsAtStr
    };
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
      
      let trialEndsAtDate: Date | null = null;
      if (this.editingUser.trialEndsAtStr) {
        trialEndsAtDate = new Date(this.editingUser.trialEndsAtStr + 'T23:59:59'); // set to end of day
      }

      const updateData: any = {
        fullName: this.editingUser.fullName,
        email: this.editingUser.email,
        phone: this.editingUser.phone,
        role: this.editingUser.role,
        status: this.editingUser.status,
        paid: this.editingUser.paid,
        isAdmin: this.editingUser.isAdmin,
      };

      if (trialEndsAtDate) {
        updateData.trialEndsAt = trialEndsAtDate;
      }

      await updateDoc(ref, updateData);
      this.successMsg = 'User updated successfully.';
      this.editingUser = null;
    } catch (e: any) {
      this.errorMsg = e.message || 'Failed to update user.';
    } finally {
      this.saving = false;
    }
  }

  async togglePaid(user: UserDoc) {
    const ref = doc(this.firestore, `users/${user.id}`);
    await updateDoc(ref, { paid: !user.paid });
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
