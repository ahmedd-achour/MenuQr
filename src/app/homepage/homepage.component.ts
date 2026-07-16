import { Component, AfterViewInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.css']
})
export class HomepageComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    targetDate.setHours(23, 59, 59, 0);

    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        const spans = document.querySelectorAll('#event-counter [data-unit]');
        spans.forEach((span) => {
          span.textContent = '00';
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const units = [
        { key: 'days', value: days },
        { key: 'hours', value: hours },
        { key: 'minutes', value: minutes },
        { key: 'seconds', value: seconds }
      ];

      units.forEach(({ key, value }) => {
        const element = document.querySelector(`#event-counter [data-unit="${key}"]`);
        if (element) {
          element.textContent = String(value).padStart(2, '0');
        }
      });
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    window.setTimeout(() => window.clearInterval(interval), 1000 * 60 * 60 * 24 * 3);
  }
}
