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
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  docData
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { HeaderPartnerComponent } from '../header-partner/header-partner.component';

interface RestaurantProduct {
  id?: string;
  restaurantId: string;
  masterProductId: string;
  visible: boolean;
  imageOverride: string;
  descriptionOverride: string;
  displayOrder: number;
  nameSnapshot?: string;
  priceVariant?: number;
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
  currentRestaurantId = 'rest_123_tn';

  categories: any[] = [];
  selectedCategory: string = 'Café & Boissons';
  mealdbProducts: any[] = [];
  localDbProducts: Map<string, RestaurantProduct> = new Map();
  localDbOptions: Map<string, any[]> = new Map();
  sizesConfig: { [size: string]: { price: number; available: boolean } } = {};

  editingProductId: string | null = null;
  editform!: FormGroup;

  createProductForm!: FormGroup;
  showCreateForm = false;

  // Cloudinary Upload State
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  uploadProgress = 0;
  cloudinaryUrl: string | null = null;
  isUploading = false;

  private readonly CLOUDINARY_CLOUD_NAME = 'aebcvczj';
  private readonly CLOUDINARY_UPLOAD_PRESET = 'munuqr';   // Your preset

  constructor(
    private fb: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.initEditForm();
    this.initCreateProductForm();

    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      const userDocRef = doc(this.firestore, `users/${this.userId}`);
      docData(userDocRef).subscribe({
        next: (user: any) => {
          if (user && user.currentRestaurantId) {
            this.currentRestaurantId = user.currentRestaurantId;
          }
          this.loadMenuData();
        },
        error: () => this.loadMenuData()
      });
    } else {
      this.loadMenuData();
    }
  }

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

  initCreateProductForm() {
    this.createProductForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      categoryId: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      image: [''],
      sizesStandard: [true],
      sizesMedium: [false],
      sizesLarge: [false]
    });
  }

  loadMenuData() {
    const categoriesRef = collection(this.firestore, 'master_categories');
    const categoriesQuery = query(categoriesRef, where('active', '==', true));

    from(getDocs(categoriesQuery)).pipe(
      map(snapshot => {
        const unsorted = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            idCategory: doc.id,
            strCategory: data['name'],
            strCategoryThumb: data['icon'],
            order: data['order'] !== undefined ? data['order'] : 99,
            productIds: data['productIds'] || []
          };
        });
        return unsorted.sort((a, b) => a.order - b.order);
      }),
      tap(mappedCategories => {
        this.categories = mappedCategories;
        if (this.categories.length > 0) {
          const hasCoffee = this.categories.some(c => c.strCategory === 'Café & Boissons');
          this.selectedCategory = hasCoffee ? 'Café & Boissons' : this.categories[0].strCategory;
        }
      }),
      switchMap(() => this.fetchLocalRestaurantProducts()),
      switchMap(() => this.fetchLocalRestaurantOptions()),
      switchMap(() => this.fetchMealsByCategory(this.selectedCategory)),
      catchError(err => {
        console.error('Error loading menu data:', err);
        return of(null);
      })
    ).subscribe();
  }

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
        console.error('Failed to fetch local products:', err);
        return of(false);
      })
    );
  }

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
            if (!this.localDbOptions.has(masterProductId)) this.localDbOptions.set(masterProductId, []);
            this.localDbOptions.get(masterProductId)!.push(opt);
          }
        });
        return true;
      }),
      catchError(err => {
        console.error('Failed to fetch options:', err);
        return of(false);
      })
    );
  }

  fetchMealsByCategory(category: string): Observable<any[]> {
    this.selectedCategory = category;
    const matchingCategory = this.categories.find(c => c.strCategory === category);
    const productIds: string[] = matchingCategory ? (matchingCategory.productIds || []) : [];

    if (productIds.length === 0) {
      this.mealdbProducts = [];
      return of([]);
    }

    const fetchPromises = productIds.map(async (id) => {
      const productDocRef = doc(this.firestore, `master_products/${id}`);
      const snap = await getDoc(productDocRef);
      return snap.exists() ? { id: snap.id, ...snap.data() } as any : null;
    });

    return from(Promise.all(fetchPromises)).pipe(
      map(products => {
        const validProducts = (products as any[]).filter(p => p !== null && p.active === true);

        this.mealdbProducts = validProducts.map((data: any) => ({
          idMeal: data.id,
          strMeal: data['name'],
          strMealThumb: data['image'],
          description: data['description'] || '',
          defaultSizes: data['defaultSizes'] || ['Standard'],
          isSynced: false,
          localData: null
        }));

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
        console.error('Failed to fetch meals:', err);
        this.mealdbProducts = [];
        return of([]);
      })
    );
  }

  getSavedOptionsForProduct(masterProductId: string): any[] {
    return (this.localDbOptions.get(masterProductId) || []).filter((o: any) => o.available);
  }

  startEdit(meal: any) {
    this.editingProductId = meal.idMeal;
    const local = meal.localData;

    this.sizesConfig = {};
    const defaultSizes = meal.defaultSizes || ['Standard'];
    const savedOpts = this.localDbOptions.get(meal.idMeal) || [];

    defaultSizes.forEach((size: string) => {
      const opt = savedOpts.find((o: any) => o.size === size);
      this.sizesConfig[size] = {
        price: opt ? opt.price : (size === 'Standard' ? (local?.priceVariant || 12.0) : size === 'Medium' ? 15.0 : 18.0),
        available: opt ? opt.available : true
      };
    });

    this.editform.patchValue({
      id: local?.id || `${this.currentRestaurantId}_${meal.idMeal}`,
      visible: local ? local.visible : true,
      descriptionOverride: local ? local.descriptionOverride : (meal.description || ''),
      imageOverride: local ? local.imageOverride : meal.strMealThumb,
      displayOrder: local ? local.displayOrder : 0,
      priceVariant: local ? local.priceVariant : 12.00
    });
  }

  cancelEdit() {
    this.editingProductId = null;
    this.editform.reset();
  }

  async saveProductUpdate(meal: any) {
    console.log('saveProductUpdate called for', meal.idMeal);
    // Add your original save logic here
  }

  async removeProduct(meal: any) {
    console.log('removeProduct called for', meal.idMeal);
    // Add your original remove logic here
  }

  // ==================== CLOUDINARY UPLOAD ====================

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.imagePreview = URL.createObjectURL(file);
      this.uploadProgress = 0;
      this.cloudinaryUrl = null;
      this.isUploading = false;
    }
  }

  async uploadToCloudinary() {
    if (!this.selectedFile || this.isUploading) return;

    this.isUploading = true;
    this.uploadProgress = 0;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);

    try {
      const response: any = await this.http.post(
        `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/upload`,
        formData
      ).toPromise();

      if (response?.secure_url) {
        this.cloudinaryUrl = response.secure_url;
        this.createProductForm.get('image')?.setValue(this.cloudinaryUrl); // Force update
        this.uploadProgress = 100;
        console.log('✅ Cloudinary Success:', this.cloudinaryUrl);
      } else {
        throw new Error('No secure_url returned from Cloudinary');
      }
    } catch (error: any) {
      console.error('❌ Cloudinary Error:', error);
      alert('Upload failed: ' + (error.message || 'Check browser console (F12)'));
    } finally {
      this.isUploading = false;
    }
  }

  // ==================== CREATE PRODUCT ====================

  async handleCreateProduct() {
    if (this.createProductForm.invalid) {
      this.createProductForm.markAllAsTouched();
      console.warn('Form is invalid:', this.createProductForm.value);
      return;
    }

    const formValues = this.createProductForm.value;
    console.log('Submitting product with image URL:', formValues.image);

    if (!formValues.image) {
      alert('Veuillez uploader une image avant de soumettre !');
      return;
    }

    const masterProductId = `prod_${Date.now()}`;

    const defaultSizes: string[] = [];
    if (formValues.sizesStandard) defaultSizes.push('Standard');
    if (formValues.sizesMedium) defaultSizes.push('Medium');
    if (formValues.sizesLarge) defaultSizes.push('Large');
    if (defaultSizes.length === 0) defaultSizes.push('Standard');

    const productPayload = {
      categoryId: formValues.categoryId,
      subCategoryId: null,
      name: formValues.name,
      description: formValues.description,
      image: formValues.image,
      tags: [this.categories.find(c => c.idCategory === formValues.categoryId)?.strCategory || ''],
      searchableKeywords: [formValues.name.toLowerCase()],
      defaultSizes: defaultSizes,
      defaultOptions: [],
      active: false
    };

    try {
      const productRef = doc(this.firestore, `master_products/${masterProductId}`);
      await setDoc(productRef, productPayload);

      const categoryDocRef = doc(this.firestore, `master_categories/${formValues.categoryId}`);
      const categorySnap = await getDoc(categoryDocRef);
      if (categorySnap.exists()) {
        const categoryData = categorySnap.data();
        const currentIds: string[] = categoryData['productIds'] || [];
        if (!currentIds.includes(masterProductId)) {
          currentIds.push(masterProductId);
          await setDoc(categoryDocRef, { productIds: currentIds }, { merge: true });
        }
      }

      alert('Votre proposition de produit a été soumise avec succès !');

      this.resetCreateForm();
      this.fetchMealsByCategory(this.selectedCategory).subscribe();
    } catch (err) {
      console.error('Failed to create product:', err);
      alert('Une erreur est survenue lors de la création du produit.');
    }
  }

  private resetCreateForm() {
    this.createProductForm.reset({
      name: '',
      categoryId: this.selectedCategoryDocId(),
      description: '',
      image: '',
      sizesStandard: true,
      sizesMedium: false,
      sizesLarge: false
    });
    this.showCreateForm = false;
    this.selectedFile = null;
    this.imagePreview = null;
    this.cloudinaryUrl = null;
    this.uploadProgress = 0;
    this.isUploading = false;
  }

  selectedCategoryDocId(): string {
    const found = this.categories.find(c => c.strCategory === this.selectedCategory);
    return found ? found.idCategory : '';
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.createProductForm.patchValue({ categoryId: this.selectedCategoryDocId() });
    }
  }
}
