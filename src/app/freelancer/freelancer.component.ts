import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, authState, User } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  Timestamp
} from '@angular/fire/firestore';
import { Subscription, Subject, from, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';
import Chart from 'chart.js/auto';

// ====================================================
// TYPES & INTERFACES
// ====================================================

export interface FreelancerProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  type: 'freelancer';
  paid: boolean;
  referralCode: string;
}

export interface BusinessOwner {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  createdAt: Timestamp;
  paid: boolean;
  trialEndsAt: Timestamp;
  status: 'active' | string;
  role: 'owner';
  type: string;
  referralCode: string;
}

export interface AppSettings {
  freelancerCommission: number;
  officeLocations: Array<{
    name: string;
    city: string;
  }>;
}

export interface ReferralTransaction {
  id?: string;
  freelancerUid: string;
  businessUid: string;
  amount: number;
  status: 'available' | 'paid';
  createdAt: Timestamp;
  businessName?: string;
}

@Component({
  selector: 'app-freelancer-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './freelancer.component.html',
  styleUrls: ['./freelancer.component.css']
})
export class FreelancerComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  @ViewChild('typeChartCanvas') typeChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyChartCanvas') monthlyChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('earningsChartCanvas') earningsChartCanvas!: ElementRef<HTMLCanvasElement>;

  // Component State
  loading = true;
  isFreelancer = false;
  accessDenied = false;
  errorMessage = '';
  copySuccess = false;

  // Data State
  currentUser: User | null = null;
  profile: FreelancerProfile | null = null;
  commission = 0;
  officeLocations: Array<{ name: string; city: string }> = [];

  // Statistics
  totalInvited = 0;
  paidCustomersCount = 0;
  conversionRate = 0;
  availableEarnings = 0;

  // Business Table State
  businesses: BusinessOwner[] = [];
  filteredBusinesses: BusinessOwner[] = [];
  searchTerm = '';
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;

  // Transaction History
  transactions: ReferralTransaction[] = [];

  private charts: Chart[] = [];

  constructor(private auth: Auth, private firestore: Firestore) {}

  ngOnInit(): void {
    authState(this.auth)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((user) => {
          if (!user) {
            this.loading = false;
            this.accessDenied = true;
            return of(null);
          }
          this.currentUser = user;
          return from(this.loadFreelancer(user.uid));
        }),
        catchError((err) => {
          this.errorMessage = 'Failed to authenticate dashboard user.';
          this.loading = false;
          return of(null);
        })
      )
      .subscribe();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.charts.forEach(chart => chart.destroy());
  }

  /**
   * Generates the referral code by pulling up to 5 sequential digits from the UID.
   * If fewer than 5 digits exist, it pads the missing slots using characters from
   * the beginning of the UID.
   */
  generateReferralCode(uid: string): string {
    if (!uid) return '';

    // Extract all individual digits in their exact order
    const digits = uid.replace(/\D/g, '');

    if (digits.length >= 5) {
      // Perfect case: take the first 5 discovered digits
      return digits.substring(0, 5);
    } else {
      // Missing digits fallback case: take whatever digits exist,
      // then slice the difference from the front of the raw UID string.
      const missingCount = 5 - digits.length;
      const paddingChars = uid.substring(0, missingCount);
      return digits + paddingChars;
    }
  }

  // ====================================================
  // DATA EXTRACTION METHODS
  // ====================================================

  async loadFreelancer(uid: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists() || userDocSnap.data()?.['type'] !== 'freelancer') {
        this.accessDenied = true;
        this.loading = false;
        return;
      }

      const data = userDocSnap.data();

      // Execute the newly assigned multi-conditional referral algorithm
      const derivedReferralCode = this.generateReferralCode(uid);

      this.profile = {
        uid: uid,
        email: data?.['email'] || '',
        fullName: data?.['fullName'] || 'Freelancer Partner',
        phone: data?.['phone'] || '',
        type: 'freelancer',
        paid: data?.['paid'] || false,
        referralCode: derivedReferralCode
      };

      this.isFreelancer = true;

      await this.loadAppSettings();
      await this.loadReferralStats();
      await this.loadBusinesses();
      await this.loadTransactions();

      this.loading = false;

      setTimeout(() => this.loadCharts(), 0);

    } catch (error) {
      this.errorMessage = 'Error gathering profile assets.';
      this.loading = false;
    }
  }

  async loadAppSettings(): Promise<void> {
    try {
      const settingsRef = doc(this.firestore, 'settings/app');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data() as AppSettings;
        this.commission = settingsData.freelancerCommission || 50;
        this.officeLocations = settingsData.officeLocations || [];
      } else {
        this.commission = 50;
      }
    } catch {
      this.commission = 50;
    }
  }

  async loadReferralStats(): Promise<void> {
    if (!this.profile) return;
    const refCode = this.profile.referralCode;

    try {
      const usersRef = collection(this.firestore, 'users');

      const totalQuery = query(usersRef, where('referralCode', '==', refCode));
      const totalSnapshot = await getCountFromServer(totalQuery);
      this.totalInvited = totalSnapshot.data().count;

      const paidQuery = query(usersRef, where('referralCode', '==', refCode), where('paid', '==', true));
      const paidSnapshot = await getCountFromServer(paidQuery);
      this.paidCustomersCount = paidSnapshot.data().count;

      this.conversionRate = this.totalInvited > 0
        ? Math.round((this.paidCustomersCount / this.totalInvited) * 100)
        : 0;

      this.calculateEarnings();

    } catch (error) {
      console.error('Error fetching count optimizations:', error);
    }
  }

  calculateEarnings(): void {
    this.availableEarnings = this.paidCustomersCount * this.commission;
  }

  async loadBusinesses(): Promise<void> {
    if (!this.profile) return;
    try {
      const usersRef = collection(this.firestore, 'users');
      const bq = query(usersRef, where('referralCode', '==', this.profile.referralCode), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(bq);

      this.businesses = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        this.businesses.push({
          id: doc.id,
          email: data['email'],
          fullName: data['fullName'],
          phone: data['phone'],
          createdAt: data['createdAt'],
          paid: data['paid'] || false,
          trialEndsAt: data['trialEndsAt'],
          status: data['status'],
          role: data['role'],
          type: data['type'] || 'Other',
          referralCode: data['referralCode']
        } as BusinessOwner);
      });

      this.applyFilters();
    } catch (error) {
      console.error('Error fetching businesses table:', error);
    }
  }

  async loadTransactions(): Promise<void> {
    if (!this.profile) return;
    try {
      const txRef = collection(this.firestore, 'referralTransactions');
      const tq = query(txRef, where('freelancerUid', '==', this.profile.uid), orderBy('createdAt', 'desc'), limit(10));
      const snapshot = await getDocs(tq);

      this.transactions = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        this.transactions.push({
          id: docSnap.id,
          freelancerUid: data['freelancerUid'],
          businessUid: data['businessUid'],
          amount: data['amount'],
          status: data['status'],
          createdAt: data['createdAt'],
          businessName: 'Business Client'
        });
      });
    } catch (error) {
      console.error('Transaction listing errors:', error);
    }
  }

  // ====================================================
  // CHARTS IMPLEMENTATION (CHART.JS)
  // ====================================================

  loadCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];

    const paidBusinesses = this.businesses.filter(b => b.paid);

    const typesMap: { [key: string]: number } = {};
    paidBusinesses.forEach(b => {
      typesMap[b.type] = (typesMap[b.type] || 0) + 1;
    });

    if (this.typeChartCanvas) {
      const ctx = this.typeChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.charts.push(new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(typesMap),
            datasets: [{
              data: Object.values(typesMap),
              backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
            }]
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        }));
      }
    }

    const dynamicMonthlyData: { [key: string]: { conversions: number, earnings: number } } = {};

    paidBusinesses.forEach(b => {
      if (!b.createdAt) return;
      const date = b.createdAt.toDate();
      const monthLabel = date.toLocaleString('default', { month: 'short', year: 'numeric' });

      if (!dynamicMonthlyData[monthLabel]) {
        dynamicMonthlyData[monthLabel] = { conversions: 0, earnings: 0 };
      }
      dynamicMonthlyData[monthLabel].conversions += 1;
      dynamicMonthlyData[monthLabel].earnings += this.commission;
    });

    const monthsOrdered = Object.keys(dynamicMonthlyData);

    if (this.monthlyChartCanvas) {
      const ctx = this.monthlyChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.charts.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels: monthsOrdered,
            datasets: [{
              label: 'Conversions',
              data: monthsOrdered.map(m => dynamicMonthlyData[m].conversions),
              borderColor: '#10b981',
              tension: 0.3,
              fill: true,
              backgroundColor: 'rgba(16, 185, 129, 0.1)'
            }]
          },
          options: { responsive: true }
        }));
      }
    }

    if (this.earningsChartCanvas) {
      const ctx = this.earningsChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.charts.push(new Chart(ctx, {
          type: 'bar',
          data: {
            labels: monthsOrdered,
            datasets: [{
              label: 'Earnings (DT)',
              data: monthsOrdered.map(m => dynamicMonthlyData[m].earnings),
              backgroundColor: '#4f46e5'
            }]
          },
          options: { responsive: true }
        }));
      }
    }
  }

  // ====================================================
  // UX UTILITIES & INTERACTION
  // ====================================================

  copyReferralCode(): void {
    if (!this.profile) return;
    navigator.clipboard.writeText(this.profile.referralCode).then(() => {
      this.copySuccess = true;
      setTimeout(() => this.copySuccess = false, 2500);
    });
  }

  applyFilters(): void {
    if (!this.searchTerm.trim()) {
      this.filteredBusinesses = [...this.businesses];
    } else {
      const lower = this.searchTerm.toLowerCase();
      this.filteredBusinesses = this.businesses.filter(b =>
        b.fullName?.toLowerCase().includes(lower) ||
        b.email?.toLowerCase().includes(lower)
      );
    }
    this.currentPage = 1;
    this.calculatePagination();
  }

  calculatePagination(): void {
    this.totalPages = Math.ceil(this.filteredBusinesses.length / this.pageSize) || 1;
  }

  get paginatedBusinesses(): BusinessOwner[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBusinesses.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  formatTimestamp(timestamp: Timestamp | any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB');
  }
}
