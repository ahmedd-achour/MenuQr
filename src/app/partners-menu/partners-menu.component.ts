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
        this.categories = res.categories || [];
        return this.fetchLocalRestaurantProducts();
      }),
      switchMap(() => {
        return this.fetchMealsByCategory(this.selectedCategory);
      }),
      catchError(err => {
        console.error('Error orchestrating menu initialization pipeline:', err);
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
    return this.http.get<{ meals: any[] }>(`${this.apiBase}/filter.php?c=${category}`).pipe(
      map(res => {
        const rawMeals = res.meals || [];

        // Map and format with local data configurations if overrides exist
        this.mealdbProducts = rawMeals.map(meal => {
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
        console.error(`Failed to gather ingredients/meals for category: ${category}`, err);
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
