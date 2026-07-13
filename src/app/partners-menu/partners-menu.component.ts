import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

// Structured data models mapping directly to your Firestore layout
interface RestaurantProduct {
  id?: string;
  restaurantId: string; // FK to restaurants collection
  masterProductId: string; // Mapping reference to TheMealDB ID
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
  selectedCategory: string = 'Beef';
  mealdbProducts: any[] = [];
  localDbProducts: Map<string, RestaurantProduct> = new Map();

  editingProductId: string | null = null;
  editform!: FormGroup;

  private apiBase = 'https://www.themealdb.com/api/json/v1/1';

  constructor(private http: HttpClient, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initEditForm();
    this.loadMenuData();
  }

  /**
   * Initializes the form with explicit validators matching the HTML required guidelines.
   * Form fields line up with HTML validation dependencies.
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
   * Orchestrates the loading chain for the partner dashboard interface.
   */
 loadMenuData() {
  this.http.get<{ categories: any[] }>(`${this.apiBase}/categories.php`).pipe(
    switchMap(res => {
      const rawCategories = res.categories || [];

      // 1. Enforce secure HTTPS paths on the dynamic API assets
      this.categories = rawCategories.map(cat => {
        if (cat.strCategoryThumb && cat.strCategoryThumb.startsWith('http://')) {
          cat.strCategoryThumb = cat.strCategoryThumb.replace('http://', 'https://');
        }
        return cat;
      });

      // 2. Inject a customized Tunisian Coffee category at the top of the list
      const tunisianCoffeeCategory = {
        idCategory: 'custom_cafe_tn',
        strCategory: 'Café & Boissons',
        strCategoryThumb: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150', // High-quality fallback image
        strCategoryDescription: 'Cafés tunisiens traditionnels, Direct, Capucin, et boissons chaudes.'
      };

      this.categories.unshift(tunisianCoffeeCategory);

      return this.fetchLocalRestaurantProducts();
    }),
    switchMap(() => {
      // 3. Set the initial active view selection to our new Coffee category
      this.selectedCategory = 'Café & Boissons';
      return this.fetchMealsByCategory(this.selectedCategory);
    }),
    catchError(err => {
      console.error('Error orchestrating Tunisian localized menu pipeline:', err);
      return of(null);
    })
  ).subscribe();
}
  /**
   * Simulates loading synchronized restaurant items from the database.
   */
  fetchLocalRestaurantProducts(): Observable<boolean> {
    const mockDbRecords: RestaurantProduct[] = [
      {
        id: 'p_52772',
        restaurantId: this.currentRestaurantId,
        masterProductId: '52772',
        visible: true,
        imageOverride: '',
        descriptionOverride: 'Premium beef prepared with local Tunisian spices and standards.',
        displayOrder: 1,
        priceVariant: 18.50
      }
    ];

    mockDbRecords.forEach(prod => this.localDbProducts.set(prod.masterProductId, prod));
    return of(true);
  }

  /**
   * Pulls dynamic category lists from the remote API endpoint and checks sync states.
   */
fetchMealsByCategory(category: string): Observable<any[]> {
  this.selectedCategory = category;

  // Intercept and return localized Tunisian Coffee items directly
  if (category === 'Café & Boissons') {
    const localCoffeeMeals = [
      { idMeal: 'c_capucin', strMeal: 'Café Capucin Express', strMealThumb: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=400' },
      { idMeal: 'c_direct', strMeal: 'Café Direct', strMealThumb: 'https://images.unsplash.com/photo-1570968915860-54d5c301fc9f?w=400' },
      { idMeal: 'c_turc', strMeal: 'Café Turc (Zahr)', strMealThumb: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400' },
      { idMeal: 'c_the', strMeal: 'Thé Vert aux Pignons / Amandes', strMealThumb: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400' },
      { idMeal: 'c_express', strMeal: 'Express Allongé', strMealThumb: 'https://images.unsplash.com/photo-1510972527409-ace1dbdfd176?w=400' }
    ];

    this.mealdbProducts = localCoffeeMeals.map(meal => {
      const localMatch = this.localDbProducts.get(meal.idMeal);
      return {
        ...meal,
        isSynced: !!localMatch,
        localData: localMatch || null
      };
    });

    return of(this.mealdbProducts);
  }

  // Fallback to standard MealDB API for standard food categories
  return this.http.get<{ meals: any[] }>(`${this.apiBase}/filter.php?c=${category}`).pipe(
    map(res => {
      const rawMeals = res.meals || [];
      this.mealdbProducts = rawMeals.map(meal => {
        if (meal.strMealThumb && meal.strMealThumb.startsWith('http://')) {
          meal.strMealThumb = meal.strMealThumb.replace('http://', 'https://');
        }
        const localMatch = this.localDbProducts.get(meal.idMeal);
        return {
          ...meal,
          isSynced: !!localMatch,
          localData: localMatch || null
        };
      });
      return this.mealdbProducts;
    }),
    catchError(() => {
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
   * Clear current form states securely
   */
  cancelEdit() {
    this.editingProductId = null;
    this.editform.reset();
  }

  /**
   * Persists client modifications straight back into local structure maps
   */
  saveProductUpdate(meal: any) {
    if (this.editform.invalid) {
      this.editform.markAllAsTouched();
      return;
    }

    const formValues = this.editform.value;

    // Construct the structured model mapping perfectly to architectural field layouts
    const updatedProductPayload: RestaurantProduct = {
      id: formValues.id,
      restaurantId: this.currentRestaurantId,
      masterProductId: meal.idMeal,
      visible: formValues.visible,
      imageOverride: formValues.imageOverride,
      descriptionOverride: formValues.descriptionOverride,
      displayOrder: formValues.displayOrder,
      priceVariant: formValues.priceVariant
    };

    // Save update cleanly to local reference map matching schema fields
    this.localDbProducts.set(meal.idMeal, updatedProductPayload);

    // Update active UI reference objects live
    meal.isSynced = true;
    meal.localData = updatedProductPayload;

    // Terminate component edit state
    this.editingProductId = null;

    console.log('Successfully pushed changes to schema layer database:', updatedProductPayload);

    // Integration Hook Example:
    // this.firestore.collection('restaurant_products').doc(updatedProductPayload.id).set(updatedProductPayload, { merge: true });
  }
}
