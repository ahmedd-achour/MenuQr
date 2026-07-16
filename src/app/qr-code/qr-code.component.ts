import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

interface Theme {
  primaryColor?: string;
  secondaryColor?: string;
  background?: string;
  cardColor?: string;
  font?: string;
  radius?: number;
  logo?: string;
  cover?: string;
  buttonStyle?: string;
  darkMode?: boolean;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  active?: boolean;
}

interface MenuProduct {
  id: string;
  displayName: string;
  displayDesc: string;
  displayImage: string;
  price: number;
  categoryId?: string;
}

interface CartItem extends MenuProduct {
  cartId: number;
}

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-code.component.html',
  styleUrls: ['./qr-code.component.css']
})
export class QrCodeComponent implements OnInit {

  userId: string = '';
  currentRestaurantId: string = '';
  restaurantName = 'My Restaurant';

  theme: Theme = {};
  products: MenuProduct[] = [];
  categories: Category[] = [];
  filteredProducts: MenuProduct[] = [];
  currentCategory = 'all';

  cart: CartItem[] = [];
  cartOpen = false;
  selectedProduct: MenuProduct | null = null;
  isDark = false;
  isLoading = true;
  errorMessage = '';

  private db: any;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.userId) {
      this.errorMessage = 'Missing user ID';
      this.isLoading = false;
      return;
    }

    this.loadQRMenu();
  }

  private async loadQRMenu() {
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);

    try {
      // 1. Get currentRestaurantId from user
      const userRef = doc(this.db, `users/${this.userId}`);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        this.currentRestaurantId = userData['currentRestaurantId'];
        this.restaurantName = userData['restaurantName'] || userData['fullName'] || 'My Restaurant';
      }

      if (!this.currentRestaurantId) {
        this.errorMessage = "No restaurant linked to this account";
        return;
      }

      // 2. Load data in parallel
      await Promise.all([
        this.loadTheme(),
        this.loadCategories(),
        this.loadProducts()
      ]);

      this.filteredProducts = [...this.products];

    } catch (err) {
      console.error(err);
      this.errorMessage = "Failed to load menu";
    } finally {
      this.isLoading = false;
    }
  }

  private async loadTheme() {
    try {
      const themeRef = doc(this.db, `themes/${this.currentRestaurantId}`);
      const snap = await getDoc(themeRef);
      if (snap.exists()) this.theme = snap.data() as Theme;
    } catch (e) { console.warn(e); }
  }

  private async loadCategories() {
    try {
      const q = query(collection(this.db, "master_categories"), where("active", "==", true));
      const snap = await getDocs(q);
      this.categories = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (e) { console.warn(e); }
  }

  private async loadProducts() {
    try {
      // Get restaurant specific products
      const rpQuery = query(
        collection(this.db, "restaurant_products"),
        where("restaurantId", "==", this.currentRestaurantId)
      );
      const rpSnap = await getDocs(rpQuery);

      const restaurantProds = rpSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Get master products
      const masterSnap = await getDocs(collection(this.db, "master_products"));
      const mastersMap = new Map(masterSnap.docs.map(d => [d.id, d.data()]));

      this.products = restaurantProds.map((rp: any) => {
        const master = mastersMap.get(rp.masterProductId) || {};

        return {
          id: rp.id,
          displayName: rp.nameOverride || master['name'] || 'Product',
          displayDesc: rp.descriptionOverride || master['description'] || '',
          displayImage: rp.imageOverride || master['image'] || 'https://picsum.photos/id/201/600/400',
          price: rp.priceVariant || 12.99,
          categoryId: master['categoryId']
        } as MenuProduct;
      });
    } catch (e) {
      console.error("Products loading error", e);
    }
  }

  filterByCategory(catId: string) {
    this.currentCategory = catId;
    this.filteredProducts = catId === 'all'
      ? [...this.products]
      : this.products.filter(p => p.categoryId === catId);
  }

  openProductModal(product: MenuProduct) {
    this.selectedProduct = product;
  }

  closeModal() {
    this.selectedProduct = null;
  }

  addToCart(event: any, product: MenuProduct) {
    if (event) event.stopImmediatePropagation();
    this.cart.push({ ...product, cartId: Date.now() });
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
  }

  toggleCart() {
    this.cartOpen = !this.cartOpen;
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, item) => sum + (item.price || 0), 0);
  }

  checkout() {
    alert('Thank you! (Demo Checkout)');
    this.cart = [];
    this.cartOpen = false;
  }

  toggleDarkMode() {
    this.isDark = !this.isDark;
    document.documentElement.classList.toggle('dark', this.isDark);
  }
}
