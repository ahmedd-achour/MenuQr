import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
  setDoc
} from '@angular/fire/firestore';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './partners-menu.component.html',
  styleUrls: ['./partners-menu.component.css']
})
export class PartnersMenuComponent implements OnInit {
  // Bound context for the authenticated merchant profile
  currentRestaurantId = 'rest_123_tn';

  categories: any[] = [];
  selectedCategory: string = 'Café & Boissons';
  mealdbProducts: any[] = [];
  localDbProducts: Map<string, RestaurantProduct> = new Map();

  editingProductId: string | null = null;
  editform!: FormGroup;

  constructor(private fb: FormBuilder, private firestore: Firestore) {}

  ngOnInit(): void {
    this.initEditForm();
    this.loadMenuData();
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
 /**
   * Orchestrates the loading chain using direct Firestore reads.
   */
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
            order: data['order'] !== undefined ? data['order'] : 99
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
   * Pulls dynamic category lists from master_products and checks sync states.
   */
/**
   * Pulls dynamic category lists from master_products by mapping correct category ID references.
   */
 /**
   * Pulls dynamic category lists from master_products and checks sync states.
   */
/**
   * Pulls dynamic category lists from master_products and checks sync states.
   */
  fetchMealsByCategory(category: string): Observable<any[]> {
    this.selectedCategory = category;
    const masterProductsRef = collection(this.firestore, 'master_products');

    // Cross-reference the name string to grab the true Firestore FK Document ID
    const matchingCategory = this.categories.find(c => c.strCategory === category);
    const databaseLookupId = matchingCategory ? matchingCategory.idCategory : category;

    // Query master_products using the matching Foreign Key ID reference
    const productsQuery = query(
      masterProductsRef,
      where('categoryId', '==', databaseLookupId),
      where('active', '==', true)
    );

    return from(getDocs(productsQuery)).pipe(
      map(snapshot => {
        this.mealdbProducts = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();

          // Fallback to doc ID if your database keeps the key values as document names
          const parsedId = data['masterProductId'] || docSnapshot.id;

          // Aligning Firestore model fields precisely into original template hooks
          return {
            idMeal: parsedId,
            strMeal: data['name'],            // From your 'name' field
            strMealThumb: data['image'],      // From your 'image' field
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
        console.error(`Failed to execute master query for category: ${category}`, err);
        this.mealdbProducts = [];
        return of([]);
      })
    );
  }

  /**
   * Triggers Form Edit mode state machine, mapping records to view models.
   */
  startEdit(meal: any) {
    this.editingProductId = meal.idMeal;
    const local = meal.localData;

    this.editform.patchValue({
      id: local?.id || `p_${meal.idMeal}`,
      visible: local ? local.visible : true,
      descriptionOverride: local ? local.descriptionOverride : `Standard preparation of freshly sourced ${meal.strMeal}.`,
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
  saveProductUpdate(meal: any) {
    if (this.editform.invalid) {
      this.editform.markAllAsTouched();
      return;
    }

    const formValues = this.editform.value;
    const documentId = formValues.id || `p_${meal.idMeal}`;

    const updatedProductPayload: RestaurantProduct = {
      id: documentId,
      restaurantId: this.currentRestaurantId,
      masterProductId: meal.idMeal,
      visible: formValues.visible,
      imageOverride: formValues.imageOverride,
      descriptionOverride: formValues.descriptionOverride,
      displayOrder: formValues.displayOrder,
      priceVariant: formValues.priceVariant
    };

    // Reference pointing directly into your write-ready collection
    const productDocRef = doc(this.firestore, `restaurant_products/${documentId}`);

    from(setDoc(productDocRef, updatedProductPayload, { merge: true })).subscribe({
      next: () => {
        // Synchronize state references locally inside the view map
        this.localDbProducts.set(meal.idMeal, updatedProductPayload);

        meal.isSynced = true;
        meal.localData = updatedProductPayload;
        this.editingProductId = null;

        console.log('Successfully pushed changes to Firestore layer:', updatedProductPayload);
      },
      error: err => {
        console.error('Failed saving partner modifications onto Cloud infrastructure:', err);
      }
    });
  }
}
