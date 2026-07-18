import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterModule } from '@angular/router';

@Component({
  selector: 'app-header-partner',
  standalone: true,
imports: [
  CommonModule,
  RouterLink,
  RouterLinkActive,
  NgClass
],  templateUrl: './header-partner.component.html',
  styleUrl: './header-partner.component.css'
})
export class HeaderPartnerComponent {
  @Input() userId: string = '';
  menuOpen = false;
}
