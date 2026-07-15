import { Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { PartnersMenuComponent } from './partners-menu/partners-menu.component';
import { ReservationComponent } from './reservation/reservation.component';
import { RegisterComponent } from './register/register.component';
import { HomePartnersComponent } from './home-partners/home-partners.component';
import { ContactComponent } from './contact/contact.component';
import { PolicyComponent } from './policy/policy.component';

export const routes: Routes = [
    {
        path: 'menu',
        component: PartnersMenuComponent
    },
      {
        path: 'reservation',
        component: ReservationComponent
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
        path: 'register',
        component: RegisterComponent
    },
     {
        path: 'admin-panel/:id',
        component: HomePartnersComponent
    },
     {
        path: 'admin-panel/:id/menu',
        component: PartnersMenuComponent
    },

    {
        path: '',
        component: HomepageComponent
    },

    // {
    //     path: '**',
    //     redirectTo: 'home'
    // }
];
