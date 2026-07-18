import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return new Promise<boolean>((resolve) => {
    // onAuthStateChanged fires once immediately with the current user
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // only need the first emission
      if (!user) {
        router.navigate(['/']);
        resolve(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(firestore, `users/${user.uid}`));
        const data = userSnap.data() as { isAdmin?: boolean } | undefined;
        if (data?.isAdmin === true) {
          resolve(true);
        } else {
          router.navigate(['/']);
          resolve(false);
        }
      } catch {
        router.navigate(['/']);
        resolve(false);
      }
    });
  });
};
