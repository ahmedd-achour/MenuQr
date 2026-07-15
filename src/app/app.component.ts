import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';

import { Firestore, doc, setDoc, collection, getDocs } from '@angular/fire/firestore';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HomepageComponent , FooterComponent , HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {

  constructor(private firestore: Firestore, public router: Router) {}

  async ngOnInit(): Promise<void> {
    //await this.updateMasterCategoriesAndProducts();
  }

  isAdminRoute(): boolean {
    return this.router.url.includes('/admin-panel');
  }

  async writeTest() {
    try {
      await setDoc(
        doc(this.firestore, 'hello/123123'),
        {
          test: 'hello, firebase is working good'
        }
      );

      console.log('✅ Document written!');
      alert('Document written successfully!');
    } catch (error) {
      console.error(error);
      alert('Error writing document. Check the browser console.');
    }
  }

  async updateMasterCategoriesAndProducts() {
    try {
      console.log('Starting sync of master categories and products...');

      // 1. Define new categories and add/merge them to Firestore
      const newCategories = [
        { id: 'coffes', name: 'coffes', icon: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', order: 15, active: true, parentId: null },
        { id: 'chicha', name: 'chicha', icon: 'https://images.unsplash.com/photo-1527156278071-6bdc6b43b2f5?w=400', order: 16, active: true, parentId: null },
        { id: 'jus', name: 'jus', icon: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400', order: 17, active: true, parentId: null },
        { id: 'deserts', name: 'deserts', icon: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400', order: 18, active: true, parentId: null }
      ];

      for (const cat of newCategories) {
        const catRef = doc(this.firestore, `master_categories/${cat.id}`);
        await setDoc(catRef, {
          name: cat.name,
          icon: cat.icon,
          order: cat.order,
          active: cat.active,
          parentId: cat.parentId
        }, { merge: true });
      }
      console.log('New categories checked/created.');

      // 2. Define default products for new categories and add/merge them to Firestore
      const defaultProducts = [
        // coffes
        {
          id: 'mp_c_espresso',
          categoryId: 'coffes',
          subCategoryId: null,
          name: 'Espresso',
          description: 'Rich and bold espresso shot.',
          image: 'https://images.unsplash.com/photo-1510707577719-0d1585799d66?w=500',
          tags: ['coffes', 'Coffee', 'Drink'],
          searchableKeywords: ['espresso', 'coffee', 'caffeine'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        {
          id: 'mp_c_cappuccino',
          categoryId: 'coffes',
          subCategoryId: null,
          name: 'Cappuccino',
          description: 'Classic espresso with steamed milk foam.',
          image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500',
          tags: ['coffes', 'Coffee', 'Drink'],
          searchableKeywords: ['cappuccino', 'coffee', 'caffeine'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        {
          id: 'mp_c_latte',
          categoryId: 'coffes',
          subCategoryId: null,
          name: 'Café Latte',
          description: 'Espresso with steamed milk and a light layer of foam.',
          image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fc9f?w=500',
          tags: ['coffes', 'Coffee', 'Drink'],
          searchableKeywords: ['latte', 'coffee', 'caffeine'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        // chicha
        {
          id: 'mp_ch_double_apple',
          categoryId: 'chicha',
          subCategoryId: null,
          name: 'Double Apple Chicha',
          description: 'Traditional double apple flavored hookah.',
          image: 'https://images.unsplash.com/photo-1527156278071-6bdc6b43b2f5?w=500',
          tags: ['chicha', 'Hookah', 'Shisha'],
          searchableKeywords: ['chicha', 'double apple', 'hookah', 'shisha'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        {
          id: 'mp_ch_mint',
          categoryId: 'chicha',
          subCategoryId: null,
          name: 'Mint Chicha',
          description: 'Refreshing mint flavored hookah.',
          image: 'https://images.unsplash.com/photo-1527156278071-6bdc6b43b2f5?w=500',
          tags: ['chicha', 'Hookah', 'Shisha'],
          searchableKeywords: ['chicha', 'mint', 'hookah', 'shisha'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        // jus
        {
          id: 'mp_j_orange',
          categoryId: 'jus',
          subCategoryId: null,
          name: 'Fresh Orange Juice',
          description: 'Freshly squeezed orange juice.',
          image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500',
          tags: ['jus', 'Juice', 'Drink'],
          searchableKeywords: ['juice', 'orange', 'fresh'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        {
          id: 'mp_j_lemon_mint',
          categoryId: 'jus',
          subCategoryId: null,
          name: 'Lemon Mint Juice',
          description: 'Fresh lemon juice blended with fresh mint leaves.',
          image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500',
          tags: ['jus', 'Juice', 'Drink'],
          searchableKeywords: ['juice', 'lemon', 'mint'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        // deserts
        {
          id: 'mp_d_fondant',
          categoryId: 'deserts',
          subCategoryId: null,
          name: 'Chocolate Fondant',
          description: 'Warm chocolate cake with a molten center.',
          image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500',
          tags: ['deserts', 'Dessert', 'Sweet'],
          searchableKeywords: ['fondant', 'chocolate', 'dessert'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        },
        {
          id: 'mp_d_cheesecake',
          categoryId: 'deserts',
          subCategoryId: null,
          name: 'Cheesecake',
          description: 'Creamy cheesecake with a graham cracker crust.',
          image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500',
          tags: ['deserts', 'Dessert', 'Sweet'],
          searchableKeywords: ['cheesecake', 'dessert'],
          defaultSizes: ['Standard'],
          defaultOptions: [],
          active: true
        }
      ];

      for (const prod of defaultProducts) {
        const prodRef = doc(this.firestore, `master_products/${prod.id}`);
        await setDoc(prodRef, {
          categoryId: prod.categoryId,
          subCategoryId: prod.subCategoryId,
          name: prod.name,
          description: prod.description,
          image: prod.image,
          tags: prod.tags,
          searchableKeywords: prod.searchableKeywords,
          defaultSizes: prod.defaultSizes,
          defaultOptions: prod.defaultOptions,
          active: prod.active
        }, { merge: true });
      }
      console.log('New default products checked/created.');

      // 3. Fetch all master products to get the full mapping
      const prodSnap = await getDocs(collection(this.firestore, 'master_products'));
      const productIdsByCategory: { [key: string]: string[] } = {};

      prodSnap.forEach(d => {
        const data = d.data();
        const catId = data['categoryId'];
        if (catId) {
          if (!productIdsByCategory[catId]) {
            productIdsByCategory[catId] = [];
          }
          productIdsByCategory[catId].push(d.id);
        }
      });

      console.log('Grouped products by category successfully:', productIdsByCategory);

      // 4. Fetch all master categories to check/update the productIds field
      const catSnap = await getDocs(collection(this.firestore, 'master_categories'));

      for (const d of catSnap.docs) {
        const catId = d.id;
        const data = d.data();
        const currentProductIds: string[] = data['productIds'] || [];
        const targetProductIds: string[] = productIdsByCategory[catId] || [];

        // Compare arrays to avoid unnecessary updates
        const currentSorted = [...currentProductIds].sort();
        const targetSorted = [...targetProductIds].sort();

        if (JSON.stringify(currentSorted) !== JSON.stringify(targetSorted)) {
          console.log(`Updating category '${catId}' with product IDs:`, targetProductIds);
          const catRef = doc(this.firestore, `master_categories/${catId}`);
          await setDoc(catRef, { productIds: targetProductIds }, { merge: true });
        } else {
          console.log(`Category '${catId}' is already up-to-date.`);
        }
      }

      console.log('Firestore synchronization completed successfully!');
    } catch (error) {
      console.error('Error synchronizing master data in OnInit:', error);
    }
  }
}
