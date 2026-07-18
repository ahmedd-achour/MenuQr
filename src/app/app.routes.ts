import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { verifiedGuard } from './guards/verified.guard';
import { HomepageComponent } from './homepage/homepage.component';
import { PartnersMenuComponent } from './partners-menu/partners-menu.component';
import { ReservationComponent } from './reservation/reservation.component';
import { RegisterComponent } from './register/register.component';
import { HomePartnersComponent } from './home-partners/home-partners.component';
import { ContactComponent } from './contact/contact.component';
import { PolicyComponent } from './policy/policy.component';
import { Coffe1Component } from './coffe1/coffe1.component';
import { Coffee2Component } from './coffee2/coffee2.component';
import { Coffee3Component } from './coffee3/coffee3.component';
import { QrCodeComponent } from './qr-code/qr-code.component';
import { AdminComponent } from './admin/admin.component';
import { BlockedComponent } from './blocked/blocked.component';

export const routes: Routes = [
    // ─── Public routes ─────────────────────────────────────────
    {
        path: '',
        component: HomepageComponent
    },
    {
        path: 'register',
        component: RegisterComponent
    },
    {
        path: 'policy',
        component: PolicyComponent
    },
    {
        path: 'contact',
        component: ContactComponent
    },
    {
        path: 'blocked',
        component: BlockedComponent
    },

    // ─── Public menus (guest-facing, no guard) ──────────────────
    {
        path: 'menu',
        component: PartnersMenuComponent
    },
    {
        path: 'reservation',
        component: ReservationComponent
    },
    {
        path: 'coffee',
        component: Coffe1Component
    },
    {
        path: 'coffee2',
        component: Coffee2Component
    },
    {
        path: 'coffee3',
        component: Coffee3Component
    },

    // ─── Partner routes (must be logged in AND verified) ────────
    {
        path: 'admin-panel/:id',
        component: HomePartnersComponent,
        canActivate: [verifiedGuard]
    },
    {
        path: 'admin-panel/:id/menu',
        component: PartnersMenuComponent,
        canActivate: [verifiedGuard]
    },
    {
        path: 'admin-panel/:id/qr-code',
        component: QrCodeComponent,
        canActivate: [verifiedGuard]
    },

    // ─── Super-admin (must be isAdmin === true) ─────────────────
    {
        path: 'admin',
        component: AdminComponent,
        canActivate: [adminGuard]
    }
];
