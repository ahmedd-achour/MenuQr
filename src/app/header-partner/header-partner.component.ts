import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header-partner',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './header-partner.component.html',
  styleUrl: './header-partner.component.css'
})
export class HeaderPartnerComponent {
  @Input() userId: string = '';
}
