import { Routes } from '@angular/router';
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
    }, {
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
    // {
    //     path: '**',
    //     redirectTo: 'home'
    // }
];
