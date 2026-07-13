import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {

  constructor(private firestore: Firestore) {}

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
