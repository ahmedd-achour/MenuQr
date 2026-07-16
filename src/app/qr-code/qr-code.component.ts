import { Component, OnInit, OnDestroy, Inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, query, where, getDocs, limit, doc, getDoc } from '@angular/fire/firestore';
import { DOCUMENT } from '@angular/common';
import { Subject, from, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { HeaderPartnerComponent } from "../header-partner/header-partner.component";

interface Restaurant {
  id: string;
  ownerId: string;
  name?: string;
  coverImage?: string;
  description?: string;
  logo?: string;
}

interface Product {
  id?: string;
  name?: string;
  imageOverride?: string;
  descriptionOverride?: string;
  description?: string;
  priceVariant?: number | string;
  categoryId?: string;
}

interface ThemeConfig {
  restaurantId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  font?: string;
  darkMode?: boolean;
  cardColor?: string;
  background?: string;
}

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule, HeaderPartnerComponent],
  templateUrl: './qr-code.component.html',
  styleUrls: ['./qr-code.component.css']
})
export class QrCodeComponent implements OnInit, OnDestroy {
  restaurantId: string | null = null;
  restaurant: Restaurant | null = null;
  products: Product[] = [];
  theme: ThemeConfig | null = null;
  loading = true;
  errorMessage: string | null = null;

  categories: any[] = [];
  selectedCategoryId: string = 'all';
  currentYear: number = new Date().getFullYear();

  // Debug Variables
  showRawData = false;
  routeParamsJson = '{}';

  get filteredProducts(): Product[] {
    if (this.selectedCategoryId === 'all') {
      return this.products;
    }
    return this.products.filter(p => p.categoryId === this.selectedCategoryId);
  }

  selectCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
  }

  // Safe Hex-Color Defaults
  readonly defaultPrimaryColor: string = '#2f3542';
  readonly defaultSecondaryColor: string = '#ff4757';
  readonly defaultBackgroundColor: string = '#f7f9fb';
  readonly defaultCardColor: string = '#ffffff';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {

    this.route.paramMap.pipe(
      switchMap(params => {
        this.loading = true;
        this.errorMessage = null;

        // Save parameters stringified for our raw visual drawer
        const keys = params.keys;
        const paramMapObj: Record<string, string | null> = {};
        keys.forEach(k => paramMapObj[k] = params.get(k));
        this.routeParamsJson = JSON.stringify(paramMapObj, null, 2);

        const ownerId = params.get('id');
        if (!ownerId) {
          throw new Error('Url Router Parameter ":id" is undefined. Please inspect your RouterModule setup.');
        }

        return from(this.fetchRestaurantData(ownerId)).pipe(
          catchError(err => {
            this.errorMessage = err?.message || 'Error processing backend requests.';
            return of(null);
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = `Fatal Stream Error: ${err?.message || err}`;
        this.loading = false;
      }
    });
  }



  private async fetchRestaurantData(ownerId: string): Promise<void> {
    try {
      let restaurantDocData: any = null;
      let restaurantDocId = '';

      // First try: Get user doc and look up currentRestaurantId
      try {
        const userDocRef = doc(this.firestore, `users/${ownerId}`);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentRestaurantId = userData['currentRestaurantId'];
          if (currentRestaurantId) {
            const restDocRef = doc(this.firestore, `restaurants/${currentRestaurantId}`);
            const restSnap = await getDoc(restDocRef);
            if (restSnap.exists()) {
              restaurantDocData = restSnap.data();
              restaurantDocId = restSnap.id;
              console.log('[QR Code] Resolved restaurant via user currentRestaurantId:', restaurantDocId);
            }
          }
        }
      } catch (err) {
        console.warn('[QR Code] Failed resolving restaurant via user doc:', err);
      }

      // Second try: Query restaurants collection by ownerId
      if (!restaurantDocData) {
        const restaurantRef = collection(this.firestore, 'restaurants');
        const restaurantQuery = query(restaurantRef, where('ownerId', '==', ownerId), limit(1));
        const restaurantSnap = await getDocs(restaurantQuery);

        if (!restaurantSnap.empty) {
          const restaurantDoc = restaurantSnap.docs[0];
          restaurantDocData = restaurantDoc.data();
          restaurantDocId = restaurantDoc.id;
          console.log('[QR Code] Resolved restaurant via ownerId query:', restaurantDocId);
        }
      }

      if (!restaurantDocData) {
        this.errorMessage = `Could not find a restaurant linked to user/owner ID "${ownerId}".`;
        return;
      }

      this.restaurant = {
        id: restaurantDocData['id'] || restaurantDocId,
        ownerId: restaurantDocData['ownerId'] || '',
        name: restaurantDocData['businessName'] || restaurantDocData['name'] || 'Restaurant Loaded',
        coverImage: restaurantDocData['coverImage'] || '',
        description: restaurantDocData['description'] || '',
        logo: restaurantDocData['logo'] || ''
      };

      this.restaurantId = this.restaurant.id;

      if (this.restaurantId) {
        await Promise.all([
          this.fetchCategories().catch(e => console.warn(e)),
          this.fetchProducts(this.restaurantId).catch(e => {
            this.errorMessage = `Products Query Failed: ${e.message}`;
          }),
          this.fetchTheme(this.restaurantId).catch(e => {
            this.errorMessage = `Themes Query Failed: ${e.message}`;
          })
        ]);
      }
    } catch (error: any) {
      this.errorMessage = `Database query execution timed out or failed: ${error?.message || error}`;
      throw error;
    }
  }

   async fetchProducts(restaurantId: string): Promise<void> {
  try {
    const productsRef = collection(this.firestore, 'restaurant_products');

    // Fallback Query Array: We try checking 'id', 'restaurantId', and 'ownerId'
    const queriesToTry = [
      query(productsRef, where('id', '==', restaurantId)),
      query(productsRef, where('restaurantId', '==', restaurantId)),
      query(productsRef, where('ownerId', '==', restaurantId))
    ];

    console.log(`[Products Sync] Testing queries for restaurantId: ${restaurantId}`);

    let resolvedDocs: any[] = [];

    // Run queries in parallel to see which field is actually used in your DB
    const snapshots = await Promise.all(queriesToTry.map(q => getDocs(q)));

    // Find the first query that actually yields products
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (!snap.empty) {
        console.log(`[Products Sync] Success! Query option #${i + 1} found ${snap.docs.length} products.`);
        resolvedDocs = snap.docs;
        break; // Stop at the first successful match
      }
    }

    let restaurantProds = resolvedDocs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data
      };
    });

    // Only display visible products
    restaurantProds = restaurantProds.filter((rp: any) => rp.visible !== false);

    if (restaurantProds.length > 0) {
      // Fetch all master products so we can merge their details (name, image, description)
      const masterRef = collection(this.firestore, 'master_products');
      const masterSnap = await getDocs(masterRef);
      const mastersMap = new Map(masterSnap.docs.map(d => [d.id, d.data()]));

      this.products = restaurantProds.map((rp: any) => {
        const master: any = mastersMap.get(rp.masterProductId) || {};
        return {
          id: rp.id,
          name: rp.nameSnapshot || master['name'] || 'Unnamed Product',
          imageOverride: rp.imageOverride || master['image'] || 'assets/placeholder-food.png',
          descriptionOverride: rp.descriptionOverride || '',
          description: master['description'] || '',
          priceVariant: rp.priceVariant ?? master['price'] ?? '0',
          categoryId: master['categoryId'] || ''
        };
      });
      console.log(`[Products Sync] Successfully loaded and mapped ${this.products.length} products.`);
    } else {
      console.warn(`[Products Sync] All fallback fields ('id', 'restaurantId', 'ownerId') returned 0 products for: ${restaurantId}`);
      this.products = [];
    }

  } catch (error: any) {
    console.error('[Products Sync] Failed to execute products fetch:', error);
    this.errorMessage = `Products Fetch Error: ${error?.message || error}`;
  }
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
      console.warn('[QR Code] Failed to fetch categories:', e);
    }
  }
  private async fetchTheme(restaurantId: string): Promise<void> {
    try {
      const themeDocRef = doc(this.firestore, `themes/theme_${restaurantId}`);
      const themeSnap = await getDoc(themeDocRef);

      if (themeSnap.exists()) {
        const data = themeSnap.data() || {};
        this.theme = {
          restaurantId: data['restaurantId'] || restaurantId,
          primaryColor: data['primaryColor'] || '',
          secondaryColor: data['secondaryColor'] || '',
          font: data['font'] || 'inherit',
          darkMode: !!data['darkMode'],
          cardColor: data['cardColor'] || '',
          background: data['background'] || ''
        };
      } else {
        // Fallback to checking via query just in case it was saved under another ID
        const themesRef = collection(this.firestore, 'themes');
        const themeQuery = query(themesRef, where('restaurantId', '==', restaurantId), limit(1));
        const themeSnapQuery = await getDocs(themeQuery);

        if (!themeSnapQuery.empty) {
          const data = themeSnapQuery.docs[0].data() || {};
          this.theme = {
            restaurantId: data['restaurantId'] || restaurantId,
            primaryColor: data['primaryColor'] || '',
            secondaryColor: data['secondaryColor'] || '',
            font: data['font'] || 'inherit',
            darkMode: !!data['darkMode'],
            cardColor: data['cardColor'] || '',
            background: data['background'] || ''
          };
        } else {
          this.theme = {};
        }
      }
    } catch (e: any) {
      console.warn('[QR Code] Failed to fetch theme:', e);
      this.theme = {};
    }

    this.applyDynamicTheme(this.theme);
  }

  private applyDynamicTheme(theme: ThemeConfig | null): void {
    try {
      const root = this.document?.documentElement;
      if (!root) return;

      const primary = (theme?.primaryColor && typeof theme.primaryColor === 'string' && theme.primaryColor.startsWith('#'))
        ? theme.primaryColor
        : this.defaultPrimaryColor;

      const secondary = (theme?.secondaryColor && typeof theme.secondaryColor === 'string' && theme.secondaryColor.startsWith('#'))
        ? theme.secondaryColor
        : this.defaultSecondaryColor;

      const background = (theme?.background && typeof theme.background === 'string' && theme.background.startsWith('#'))
        ? theme.background
        : this.defaultBackgroundColor;

      const card = (theme?.cardColor && typeof theme.cardColor === 'string' && theme.cardColor.startsWith('#'))
        ? theme.cardColor
        : this.defaultCardColor;

      const font = theme?.font || 'inherit';

      this.renderer.setStyle(root, '--primary-color', primary);
      this.renderer.setStyle(root, '--secondary-color', secondary);
      this.renderer.setStyle(root, '--background-color', background);
      this.renderer.setStyle(root, '--card-color', card);
      this.renderer.setStyle(root, '--font-family', font);

      if (theme?.darkMode) {
        this.renderer.addClass(this.document.body, 'dark-theme');
      } else {
        this.renderer.removeClass(this.document.body, 'dark-theme');
      }
    } catch (error) {
      console.error('[QR Component] Style assignment failed:', error);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
