import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of, from } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  docData
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { HeaderPartnerComponent } from '../header-partner/header-partner.component';

// Structured data models mapping directly to your Firestore layout
interface RestaurantProduct {
  id?: string;
  restaurantId: string; // FK to restaurants collection
  masterProductId: string; // Mapping reference to Firestore master product document ID
  visible: boolean;
  imageOverride: string;
  descriptionOverride: string;
  displayOrder: number;
  nameSnapshot?: string;
  priceVariant?: number; // Connected to options sub-pricing variables
}

@Component({
  selector: 'app-partners-menu',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HeaderPartnerComponent],
  templateUrl: './partners-menu.component.html',
  styleUrls: ['./partners-menu.component.css']
})
export class PartnersMenuComponent implements OnInit {
  userId = '';
  // Bound context for the authenticated merchant profile
  currentRestaurantId = 'rest_123_tn';

  categories: any[] = [];
  selectedCategory: string = 'Café & Boissons';
  mealdbProducts: any[] = [];
  localDbProducts: Map<string, RestaurantProduct> = new Map();
  localDbOptions: Map<string, any[]> = new Map();
  sizesConfig: { [size: string]: { price: number; available: boolean } } = {};

  editingProductId: string | null = null;
  editform!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initEditForm();
    
    // Read user ID dynamically
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      const userDocRef = doc(this.firestore, `users/${this.userId}`);
      docData(userDocRef).subscribe({
        next: (user: any) => {
          if (user && user.currentRestaurantId) {
            this.currentRestaurantId = user.currentRestaurantId;
            console.log('Successfully resolved dynamic restaurant context:', this.currentRestaurantId);
          }
          this.loadMenuData();
        },
        error: (err) => {
          console.error('Error loading user profile context:', err);
          this.loadMenuData();
        }
      });
    } else {
      this.loadMenuData();
    }
  }

  /**
   * Initializes the form with explicit validators matching the HTML required guidelines.
   */
  initEditForm() {
    this.editform = this.fb.group({
      id: [''],
      visible: [true],
      descriptionOverride: ['', [Validators.required, Validators.minLength(5)]],
      imageOverride: [''],
      displayOrder: [0, [Validators.required, Validators.min(0)]],
      priceVariant: [12.00, [Validators.required, Validators.min(0.1)]]
    });
  }

  /**
   * Orchestrates the loading chain using direct Firestore reads.
   */
  loadMenuData() {
    const categoriesRef = collection(this.firestore, 'master_categories');
    const categoriesQuery = query(categoriesRef, where('active', '==', true));

    from(getDocs(categoriesQuery)).pipe(
      map(snapshot => {
        const unsorted = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            idCategory: doc.id, // Store the true Firestore document ID
            strCategory: data['name'], // Keep the display name string for template bindings
            strCategoryThumb: data['icon'],
            strCategoryDescription: data['parentId'] || '',
            order: data['order'] !== undefined ? data['order'] : 99,
            productIds: data['productIds'] || [] // Read the productIds!
          };
        });
        return unsorted.sort((a, b) => a.order - b.order);
      }),
      tap(mappedCategories => {
        this.categories = mappedCategories;
        if (this.categories.length > 0) {
          // Default selection to Coffee if present, otherwise fallback to first category item
          const hasCoffee = this.categories.some(c => c.strCategory === 'Café & Boissons');
          this.selectedCategory = hasCoffee ? 'Café & Boissons' : this.categories[0].strCategory;
        }
      }),
      switchMap(() => this.fetchLocalRestaurantProducts()),
      switchMap(() => this.fetchLocalRestaurantOptions()),
      switchMap(() => this.fetchMealsByCategory(this.selectedCategory)),
      catchError(err => {
        console.error('Error orchestrating Firestore real-time menu pipeline:', err);
        return of(null);
      })
    ).subscribe();
  }

  /**
   * Loads synchronized restaurant menu items directly from your production collection.
   */
  fetchLocalRestaurantProducts(): Observable<boolean> {
    const localProductsRef = collection(this.firestore, 'restaurant_products');
    const localQuery = query(localProductsRef, where('restaurantId', '==', this.currentRestaurantId));

    return from(getDocs(localQuery)).pipe(
      map(snapshot => {
        this.localDbProducts.clear();
        snapshot.docs.forEach(doc => {
          const prod = { id: doc.id, ...doc.data() } as RestaurantProduct;
          this.localDbProducts.set(prod.masterProductId, prod);
        });
        return true;
      }),
      catchError(err => {
        console.error('Failed to retrieve synchronized partner data layers:', err);
        return of(false);
      })
    );
  }

  /**
   * Loads synchronized restaurant menu product options.
   */
  fetchLocalRestaurantOptions(): Observable<boolean> {
    const optionsRef = collection(this.firestore, 'restaurant_product_options');
    const optionsQuery = query(optionsRef, where('restaurantId', '==', this.currentRestaurantId));

    return from(getDocs(optionsQuery)).pipe(
      map(snapshot => {
        this.localDbOptions.clear();
        snapshot.docs.forEach(doc => {
          const opt = { id: doc.id, ...doc.data() } as any;
          const masterProductId = opt.masterProductId;
          if (masterProductId) {
            if (!this.localDbOptions.has(masterProductId)) {
              this.localDbOptions.set(masterProductId, []);
            }
            this.localDbOptions.get(masterProductId)!.push(opt);
          }
        });
        return true;
      }),
      catchError(err => {
        console.error('Failed to retrieve restaurant product options:', err);
        return of(false);
      })
    );
  }

  /**
   * Pulls dynamic category lists from master_products by mapping correct category ID references.
   * OPTIMIZED: Fetches products directly by document ID listed in the category.
   */
  fetchMealsByCategory(category: string): Observable<any[]> {
    this.selectedCategory = category;

    // Cross-reference the name string to grab the true Firestore Category Document ID
    const matchingCategory = this.categories.find(c => c.strCategory === category);
    
    // Optimized read: read pre-mapped productIds array directly
    const productIds: string[] = matchingCategory ? (matchingCategory.productIds || []) : [];

    if (productIds.length === 0) {
      console.log(`Optimized Read: Category '${category}' has 0 products in its list. Skipping Firestore query.`);
      this.mealdbProducts = [];
      return of([]);
    }

    console.log(`Optimized Read: Fetching ${productIds.length} products directly by ID:`, productIds);

    // Fetch master products directly by document reference in parallel (O(1) lookups)
    const fetchPromises = productIds.map(async (id) => {
      const productDocRef = doc(this.firestore, `master_products/${id}`);
      const snap = await getDoc(productDocRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: snap.id,
          ...data
        } as any;
      }
      return null;
    });

    return from(Promise.all(fetchPromises)).pipe(
      map(products => {
        // Filter out null values and inactive products
        const validProducts = (products as any[]).filter(p => p !== null && p.active !== false);

        this.mealdbProducts = validProducts.map((data: any) => {
          const parsedId = data.id;

          // Aligning Firestore model fields precisely into template hooks
          return {
            idMeal: parsedId,
            strMeal: data['name'],
            strMealThumb: data['image'],
            description: data['description'] || '',
            defaultSizes: data['defaultSizes'] || ['Standard'],
            isSynced: false,
            localData: null
          };
        });

        // Remap local merchant configurations
        this.mealdbProducts = this.mealdbProducts.map(meal => {
          const localMatch = this.localDbProducts.get(meal.idMeal);
          return {
            ...meal,
            isSynced: !!localMatch,
            localData: localMatch || null
          };
        });

        return this.mealdbProducts;
      }),
      catchError(err => {
        console.error(`Failed to execute optimized master query for category: ${category}`, err);
        this.mealdbProducts = [];
        return of([]);
      })
    );
  }

  getSavedOptionsForProduct(masterProductId: string): any[] {
    const opts = this.localDbOptions.get(masterProductId) || [];
    return opts.filter((o: any) => o.available);
  }

  /**
   * Triggers Form Edit mode state machine, mapping records to view models.
   */
  startEdit(meal: any) {
    this.editingProductId = meal.idMeal;
    const local = meal.localData;

    // Build size configuration
    this.sizesConfig = {};
    const defaultSizes = meal.defaultSizes || ['Standard'];
    const savedOpts = this.localDbOptions.get(meal.idMeal) || [];

    defaultSizes.forEach((size: string) => {
      const opt = savedOpts.find((o: any) => o.size === size);
      this.sizesConfig[size] = {
        price: opt ? opt.price : (size === 'Standard' && local?.priceVariant ? local.priceVariant : (size === 'Standard' ? 12.0 : size === 'Medium' ? 15.0 : 18.0)),
        available: opt ? opt.available : true
      };
    });

    this.editform.patchValue({
      id: local?.id || `${this.currentRestaurantId}_${meal.idMeal}`,
      visible: local ? local.visible : true,
      descriptionOverride: local ? local.descriptionOverride : (meal.description || `Standard preparation of freshly sourced ${meal.strMeal}.`),
      imageOverride: local ? local.imageOverride : meal.strMealThumb,
      displayOrder: local ? local.displayOrder : 0,
      priceVariant: local ? local.priceVariant : 12.00
    });
  }

  /**
   * Clear current form states securely.
   */
  cancelEdit() {
    this.editingProductId = null;
    this.editform.reset();
  }

  /**
   * Persists client modifications straight back into Firestore and updates local states.
   */
  async saveProductUpdate(meal: any) {
    if (this.editform.invalid) {
      this.editform.markAllAsTouched();
      return;
    }

    const formValues = this.editform.value;
    const documentId = formValues.id || `${this.currentRestaurantId}_${meal.idMeal}`;

    // Auto-resolve price variant to standard or first option size price
    const primaryPrice = Number(this.sizesConfig['Standard']?.price || Object.values(this.sizesConfig)[0]?.price || 12.00);

    const updatedProductPayload: RestaurantProduct = {
      id: documentId,
      restaurantId: this.currentRestaurantId,
      masterProductId: meal.idMeal,
      visible: formValues.visible,
      imageOverride: formValues.imageOverride,
      descriptionOverride: formValues.descriptionOverride,
      displayOrder: formValues.displayOrder,
      priceVariant: primaryPrice
    };

    try {
      // 1. Save Restaurant Product Document
      const productDocRef = doc(this.firestore, `restaurant_products/${documentId}`);
      await setDoc(productDocRef, updatedProductPayload, { merge: true });
      this.localDbProducts.set(meal.idMeal, updatedProductPayload);

      // 2. Save Restaurant Product Options
      const defaultSizes = meal.defaultSizes || ['Standard'];
      const updatedOpts: any[] = [];

      for (const size of defaultSizes) {
        const sizeConfig = this.sizesConfig[size];
        if (sizeConfig) {
          const optId = `opt_${this.currentRestaurantId}_${meal.idMeal}_${size}`;
          const optDocRef = doc(this.firestore, `restaurant_product_options/${optId}`);
          
          const optPayload = {
            id: optId,
            restaurantId: this.currentRestaurantId,
            restaurantProductId: documentId,
            masterProductId: meal.idMeal,
            size: size,
            price: Number(sizeConfig.price) || 0,
            available: !!sizeConfig.available,
            optionPrices: {}
          };
          
          await setDoc(optDocRef, optPayload, { merge: true });
          updatedOpts.push(optPayload);
        }
      }

      this.localDbOptions.set(meal.idMeal, updatedOpts);

      // Synchronize state references locally inside the view map
      meal.isSynced = true;
      meal.localData = updatedProductPayload;
      this.editingProductId = null;

      console.log('Successfully saved overrides and variants for product:', documentId);
    } catch (err) {
      console.error('Failed saving product overrides & options:', err);
    }
  }

  async removeProduct(meal: any) {
    const documentId = `${this.currentRestaurantId}_${meal.idMeal}`;
    
    try {
      // 1. Delete Restaurant Product Document
      const productDocRef = doc(this.firestore, `restaurant_products/${documentId}`);
      await deleteDoc(productDocRef);
      this.localDbProducts.delete(meal.idMeal);

      // 2. Delete Restaurant Product Options
      const defaultSizes = meal.defaultSizes || ['Standard'];
      for (const size of defaultSizes) {
        const optId = `opt_${this.currentRestaurantId}_${meal.idMeal}_${size}`;
        const optDocRef = doc(this.firestore, `restaurant_product_options/${optId}`);
        await deleteDoc(optDocRef);
      }

      this.localDbOptions.delete(meal.idMeal);

      // Synchronize state references locally inside the view map
      meal.isSynced = false;
      meal.localData = null;
      
      if (this.editingProductId === meal.idMeal) {
        this.editingProductId = null;
      }

      console.log('Successfully deleted overrides and variants for product:', documentId);
    } catch (err) {
      console.error('Failed deleting product overrides & options:', err);
    }
  }
}
