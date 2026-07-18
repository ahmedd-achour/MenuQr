import { Component, OnInit, OnDestroy, Inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, query, where, getDocs, limit, doc, getDoc } from '@angular/fire/firestore';
import { DOCUMENT } from '@angular/common';
import { Subject, from, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { HeaderPartnerComponent } from "../header-partner/header-partner.component";
import { MenuService } from '../services/menu.service';

interface Restaurant {
  id: string;
  ownerId: string;
  name?: string;
  coverImage?: string;
  description?: string;
  logo?: string;
  businessName?: string;
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
  radius?: number;
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
  hasAccess: boolean = true;
  trialMessage: string = '';

  get filteredProducts(): Product[] {
    if (this.selectedCategoryId === 'all') return this.products;
    return this.products.filter(p => p.categoryId === this.selectedCategoryId);
  }

  get activeCategories(): any[] {
    return this.categories.filter(cat => this.products.some(p => p.categoryId === cat.id));
  }

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        this.loading = true;
        const ownerId = params.get('id');
        if (!ownerId) throw new Error('Missing user ID in URL');

        return from(this.fetchRestaurantData(ownerId));
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => this.loading = false,
      error: (err) => {
        this.errorMessage = err?.message || 'Failed to load menu';
        this.loading = false;
      }
    });
  }

  private async fetchRestaurantData(ownerId: string): Promise<void> {
    try {
      // 1. Get User + Access Check
      const userRef = doc(this.firestore, `users/${ownerId}`);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;

      if (userData) {
        if (!this.checkUserAccess(userData)) {
          this.hasAccess = false;
          this.trialMessage = "Your free trial has ended. Please subscribe for continued access.";
          return;
        }
      }

      // 2. Get Restaurant
      let restaurantData: any = null;
      let restaurantId: string = '';

      const userRestaurantId = userData?.['currentRestaurantId'];
      if (userRestaurantId) {
        const restRef = doc(this.firestore, `restaurants/${userRestaurantId}`);
        const restSnap = await getDoc(restRef);
        if (restSnap.exists()) {
          restaurantData = restSnap.data();
          restaurantId = userRestaurantId;
        }
      }

      if (!restaurantData) {
        const restQuery = query(collection(this.firestore, 'restaurants'), where('ownerId', '==', ownerId), limit(1));
        const restSnap = await getDocs(restQuery);
        if (!restSnap.empty) {
          restaurantData = restSnap.docs[0].data();
          restaurantId = restSnap.docs[0].id;
        }
      }

      if (!restaurantData || !restaurantId) {
        this.errorMessage = 'Restaurant not found';
        return;
      }

      this.restaurant = {
        id: restaurantId,
        ownerId: restaurantData.ownerId || ownerId,
        name: restaurantData.businessName || restaurantData.name || 'Restaurant',
        coverImage: restaurantData.coverImage,
        description: restaurantData.description,
        logo: restaurantData.logo,
        businessName: restaurantData.businessName
      };
      this.restaurantId = restaurantId;

      // 3. Load Latest Theme + Products
      await Promise.all([
        this.fetchTheme(restaurantId),
        this.fetchProducts(restaurantId),
        this.fetchCategories()
      ]);

      // 4. Try to refresh published menu in background
      this.menuService.publishMenu(restaurantId).catch(() => {});

    } catch (error: any) {
      console.error('[QR Code] Error:', error);
      this.errorMessage = error.message || 'Failed to load menu';
    }
  }

  private checkUserAccess(userData: any): boolean {
    if (userData?.paid === true) return true;
    // Trial logic (14 days)
    const createdAt = userData?.createdAt;
    if (!createdAt) return false;
    const createdDate = createdAt?.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    const diffDays = Math.ceil((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 14;
  }

  private async fetchTheme(restaurantId: string): Promise<void> {
    const themeRef = doc(this.firestore, `themes/theme_${restaurantId}`);
    const snap = await getDoc(themeRef);

    if (snap.exists()) {
      const data = snap.data();
      this.theme = {
        primaryColor: data['primaryColor'],
        secondaryColor: data['secondaryColor'],
        background: data['background'],
        cardColor: data['cardColor'],
        font: data['font'],
        radius: data['radius'],
        darkMode: !!data['darkMode']
      };
    } else {
      this.theme = {};
    }

    this.applyDynamicTheme(this.theme);
  }

  private async fetchProducts(restaurantId: string): Promise<void> {
    const prodRef = collection(this.firestore, 'restaurant_products');
    const q = query(prodRef, where('restaurantId', '==', restaurantId));
    const snapshot = await getDocs(q);

    const masterSnap = await getDocs(collection(this.firestore, 'master_products'));
    const mastersMap = new Map(masterSnap.docs.map(d => [d.id, d.data()]));

    this.products = snapshot.docs
      .map(d => {
        const data = d.data();
        const master = mastersMap.get(data['masterProductId']) || {};
        return {
          id: d.id,
          name: data['nameSnapshot'] || master['name'],
          imageOverride: data['imageOverride'] || master['image'],
          descriptionOverride: data['descriptionOverride'] || master['description'],
          priceVariant: data['priceVariant'] || master['price'] || 0,
          categoryId: master['categoryId'] || ''
        };
      })
      .filter(p => p.name);
  }

  private async fetchCategories(): Promise<void> {
    const catRef = collection(this.firestore, 'master_categories');
    const q = query(catRef, where('active', '==', true));
    const snap = await getDocs(q);
    this.categories = snap.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'],
      order: doc.data()['order'] || 99
    })).sort((a, b) => a.order - b.order);
  }

  private applyDynamicTheme(theme: ThemeConfig | null): void {
    const root = this.document.documentElement;
    if (!root || !theme) return;

    this.renderer.setStyle(root, '--primary-color', theme.primaryColor || '#d97706');
    this.renderer.setStyle(root, '--secondary-color', theme.secondaryColor || '#78350f');
    this.renderer.setStyle(root, '--background-color', theme.background || '#ffffff');
    this.renderer.setStyle(root, '--card-color', theme.cardColor || '#f8fafc');
    this.renderer.setStyle(root, '--font-family', theme.font || 'Poppins');
    this.renderer.setStyle(root, '--border-radius', `${theme.radius || 10}px`);

    if (theme.darkMode) {
      this.renderer.addClass(root, 'dark-theme');
    } else {
      this.renderer.removeClass(root, 'dark-theme');
    }
  }

  selectCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
