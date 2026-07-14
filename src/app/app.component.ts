import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';

import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HomepageComponent , FooterComponent , HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  constructor(private firestore: Firestore, public router: Router) {}

  isAdminRoute(): boolean {
    return this.router.url.includes('/admin-panel');
  }

  async writeTest() {
    try {
      await setDoc(
        doc(this.firestore, 'hello/123123'),
        {
          test: 'hello, firebase is working good'
        }
      );

      console.log('✅ Document written!');
      alert('Document written successfully!');
    } catch (error) {
      console.error(error);
      alert('Error writing document. Check the browser console.');
    }
  }
}
