import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc, updateDoc, collection } from '@angular/fire/firestore';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule , RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  formData = {
    businessName: '',
    email: '',
    phone: '',
    countryCode: '+216',
    password: '',
    businessType: '',
    referralCode: ''
  };

  loading = false;
  errorMessage = '';
  isLogin = false;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router
  ) {}

  async signup() {
    if (!this.formData.email || !this.formData.password || !this.formData.businessName || !this.formData.phone || !this.formData.businessType) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      // 1 - Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        this.formData.email,
        this.formData.password
      );

      const uid = credential.user?.uid;
      if (!uid) {
        throw new Error("User creation failed");
      }

      const fullPhone = this.formData.countryCode + this.formData.phone;

      // 2 - Create user document
      const userData = {
        id: uid,
        email: this.formData.email,
        fullName: this.formData.businessName,
        phone: fullPhone,
        photoUrl: "",
        createdAt: new Date(),
        lastLogin: new Date(),
        isVerified: false,
        status: "active",
        currentRestaurantId: "",
        role: "owner",
        referralCode: this.formData.referralCode || ""
      };

      const userDocRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userDocRef, userData);

      // 3 - Create restaurant document
      const restaurantsCollection = collection(this.firestore, 'restaurants');
      const restaurantDocRef = doc(restaurantsCollection);
      const restaurantId = restaurantDocRef.id;

      const restaurantData = {
        id: restaurantId,
        ownerId: uid,
        businessName: this.formData.businessName,
        slug: this.createSlug(this.formData.businessName),
        logo: "",
        coverImage: "",
        phone: fullPhone,
        email: this.formData.email,
        address: "",
        city: "",
        description: "",
        currency: "TND",
        language: "fr",
        createdAt: new Date(),
        status: "trial",
        trialEndsAt: this.addDays(new Date(), 14),
        licenseStatus: "trial",
        menuVersion: 1,
        type: this.formData.businessType
      };

      await setDoc(restaurantDocRef, restaurantData);

      // 4 - Link restaurant to user
      await updateDoc(userDocRef, {
        currentRestaurantId: restaurantId
      });

      // 5 - Redirect to admin panel
      await this.router.navigate(['/admin-panel', uid]);

    } catch (error: any) {
      console.error(error);
      this.errorMessage = error.message || "Signup failed";
    } finally {
      this.loading = false;
    }
  }

  async login() {
    if (!this.formData.email || !this.formData.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      const credential = await signInWithEmailAndPassword(
        this.auth,
        this.formData.email,
        this.formData.password
      );

      const uid = credential.user?.uid;
      if (!uid) {
        throw new Error("Login failed");
      }

      // Update lastLogin
      const userDocRef = doc(this.firestore, `users/${uid}`);
      try {
        await updateDoc(userDocRef, {
          lastLogin: new Date()
        });
      } catch (err) {
        console.warn('Failed to update lastLogin:', err);
      }

      // Redirect to admin panel
      await this.router.navigate(['/admin-panel', uid]);

    } catch (error: any) {
      console.error(error);
      this.errorMessage = error.message || "Login failed. Please check your credentials.";
    } finally {
      this.loading = false;
    }
  }

  createSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-');
  }

  addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.errorMessage = '';
  }
}
