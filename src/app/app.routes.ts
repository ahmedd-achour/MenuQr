import { Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { PartnersMenuComponent } from './partners-menu/partners-menu.component';

export const routes: Routes = [
    {
        path: 'partner',
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
