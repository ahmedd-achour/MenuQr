import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  documentId
} from '@angular/fire/firestore';

export interface PublishedMenu {
  restaurantId: string;
  theme: any;
  categories: any[];
  products: any[];
  publishedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private firestore = inject(Firestore);

  /**
   * Compiles the entire menu data (theme, active categories, restaurant products, master product details, and options)
   * into a single document under `menus/${restaurantId}` to achieve maximum read optimization.
   */
  async publishMenu(restaurantId: string): Promise<void> {
    if (!restaurantId) return;

    try {
      console.log(`[MenuService] Compiling menu for restaurant: ${restaurantId}`);

      // 1. Fetch Theme
      let theme: any = null;
      try {
        const themeSnap = await getDoc(doc(this.firestore, `themes/theme_${restaurantId}`));
        if (themeSnap.exists()) {
          theme = themeSnap.data();
        }
      } catch (err) {
        console.warn('[MenuService] Warning fetching theme during publish:', err);
      }

      // 2. Fetch Active Categories
      const categoriesRef = collection(this.firestore, 'master_categories');
      const categoriesQuery = query(categoriesRef, where('active', '==', true));
      const categoriesSnap = await getDocs(categoriesQuery);
      const categories = categoriesSnap.docs.map(d => ({
        id: d.id,
        name: d.data()['name'],
        icon: d.data()['icon'] || '',
        order: d.data()['order'] !== undefined ? d.data()['order'] : 99,
        productIds: d.data()['productIds'] || []
      })).sort((a, b) => a.order - b.order);

      // 3. Fetch Restaurant Products
      const productsRef = collection(this.firestore, 'restaurant_products');
      const productsQuery = query(productsRef, where('restaurantId', '==', restaurantId));
      const productsSnap = await getDocs(productsQuery);
      const restaurantProducts = productsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];

      // Filter to only visible products
      const visibleProducts = restaurantProducts.filter(rp => rp.visible !== false);

      // 4. Fetch Master Products (only the ones referenced by visible restaurant products to optimize reads)
      const masterProductsMap = new Map<string, any>();
      const masterProductIds = visibleProducts.map(rp => rp.masterProductId).filter(Boolean);

      if (masterProductIds.length > 0) {
        // Firestore 'in' query has a limit of 30. If a restaurant has more than 30 products, batch them.
        const batchSize = 30;
        const batches = [];
        for (let i = 0; i < masterProductIds.length; i += batchSize) {
          batches.push(masterProductIds.slice(i, i + batchSize));
        }

        const masterRef = collection(this.firestore, 'master_products');
        for (const batch of batches) {
          const masterQuery = query(masterRef, where(documentId(), 'in', batch));
          const masterSnap = await getDocs(masterQuery);
          masterSnap.docs.forEach(d => {
            masterProductsMap.set(d.id, d.data());
          });
        }
      }

      // 5. Fetch Restaurant Product Options
      const optionsRef = collection(this.firestore, 'restaurant_product_options');
      const optionsQuery = query(optionsRef, where('restaurantId', '==', restaurantId));
      const optionsSnap = await getDocs(optionsQuery);
      const optionsList = optionsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];

      // Map options by masterProductId
      const optionsMap = new Map<string, any[]>();
      optionsList.forEach(opt => {
        const mId = opt.masterProductId;
        if (mId) {
          if (!optionsMap.has(mId)) {
            optionsMap.set(mId, []);
          }
          optionsMap.get(mId)!.push(opt);
        }
      });

      // 6. Merge products with their master details and options
      const mergedProducts = visibleProducts.map(rp => {
        const master = masterProductsMap.get(rp.masterProductId) || {};
        const pOptions = (optionsMap.get(rp.masterProductId) || [])
          .filter(opt => opt.available)
          .map(opt => ({
            size: opt.size,
            price: opt.price,
            available: opt.available
          }));

        return {
          id: rp.id,
          masterProductId: rp.masterProductId,
          name: rp.nameSnapshot || master['name'] || 'Unnamed Product',
          image: rp.imageOverride || master['image'] || 'assets/placeholder-food.png',
          descriptionOverride: rp.descriptionOverride || '',
          description: master['description'] || '',
          price: rp.priceVariant ?? master['price'] ?? 0,
          categoryId: master['categoryId'] || '',
          displayOrder: rp.displayOrder || 0,
          options: pOptions
        };
      });

      // Sort merged products by displayOrder
      mergedProducts.sort((a, b) => a.displayOrder - b.displayOrder);

      // 7. Write consolidated menu to menus/${restaurantId}
      const menuPayload: PublishedMenu = {
        restaurantId,
        theme: theme || {},
        categories,
        products: mergedProducts,
        publishedAt: new Date()
      };

      const menuDocRef = doc(this.firestore, `menus/${restaurantId}`);
      await setDoc(menuDocRef, menuPayload);
      console.log(`[MenuService] Menu published successfully for ${restaurantId}!`);

    } catch (error) {
      console.error('[MenuService] Failed to publish menu:', error);
      throw error;
    }
  }

  /**
   * Retrieves the compiled published menu document for a restaurant.
   */
  async getPublishedMenu(restaurantId: string): Promise<PublishedMenu | null> {
    if (!restaurantId) return null;
    try {
      const menuSnap = await getDoc(doc(this.firestore, `menus/${restaurantId}`));
      if (menuSnap.exists()) {
        return menuSnap.data() as PublishedMenu;
      }
      return null;
    } catch (error) {
      console.error('[MenuService] Error fetching published menu:', error);
      return null;
    }
  }
}
