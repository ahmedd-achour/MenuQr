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
        const data = userSnap.data() as { paid?: boolean; createdAt?: any; trialEndsAt?: any } | undefined;

        const isPaid = data?.paid === true;

        let trialEndsDate: Date;
        if (data?.trialEndsAt) {
          if (typeof data.trialEndsAt.toDate === 'function') {
            trialEndsDate = data.trialEndsAt.toDate();
          } else {
            trialEndsDate = new Date(data.trialEndsAt);
          }
        } else {
          // Fallback if no trialEndsAt: calculate 15 days from createdAt
          let createdDate: Date;
          if (data?.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdDate = data.createdAt.toDate();
            } else {
              createdDate = new Date(data.createdAt);
            }
          } else {
            createdDate = new Date();
          }
          trialEndsDate = new Date(createdDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        }

        const isTrialActive = new Date().getTime() <= trialEndsDate.getTime();

        if (isPaid || isTrialActive) {
          resolve(true);
        } else {
          // Logged in but not paid/trial expired → blocked screen
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
