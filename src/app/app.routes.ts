import { Routes } from '@angular/router';
import { PartnersMenuComponent } from './partners-menu/partners-menu.component';

export const routes: Routes = [

  {
    path: 'partners-menu',
    component: PartnersMenuComponent
  },

 {
    path: '**',
    redirectTo: 'partners-menu'
  }
];
