import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export const verifiedGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return new Promise<boolean>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        // Not logged in → send to register page
        router.navigate(['/register']);
        resolve(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(firestore, `users/${user.uid}`));
        const data = userSnap.data() as { isVerified?: boolean } | undefined;

        if (data?.isVerified === true) {
          resolve(true);
        } else {
          // Logged in but not verified → blocked screen
          router.navigate(['/blocked']);
          resolve(false);
        }
      } catch {
        router.navigate(['/blocked']);
        resolve(false);
      }
    });
  });
};
