import { Injectable, inject } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth'; // Ensure this matches your @angular/fire version setup
import { Observable, of } from 'rxjs';
import { switchMap, shareReplay } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string;
  role?: 'admin' | 'partner' | 'client';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private afAuth = inject(AngularFireAuth);
  private firestore = inject(AngularFirestore);

  /**
   * The core reactive user stream.
   * Emits the custom UserProfile when logged in, or null when logged out.
   * shareReplay(1) caches the latest emission so new component subscribers get it immediately.
   */

  readonly user$: Observable<UserProfile | null> = this.afAuth.authState.pipe(
    switchMap(user => {
      if (user) {
        // Option A: If you store custom user profile roles/metadata in a Firestore collection
        return this.firestore.doc<UserProfile>(`users/${user.uid}`).valueChanges().pipe(
          switchMap(profile => {
            if (profile) return of(profile);

            // Fallback if document doesn't exist yet
            return of({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Partner'
            } as UserProfile);
          })
        );
      } else {
        // User is logged out
        return of(null);
      }
    }),
    shareReplay(1)
  );

  /**
   * Triggers the Firebase Google Authentication sign-in flow.
   */
  async loginWithGoogle(): Promise<any> {
    try {
      // If compat layer is used:
      const provider = new (await import('firebase/compat/app')).default.auth.GoogleAuthProvider();
      return await this.afAuth.signInWithPopup(provider);
    } catch (error) {
      console.error('Login process encountered an error:', error);
      throw error;
    }
  }

  /**
   * Ends the current session and logs the user out.
   */
  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
}
