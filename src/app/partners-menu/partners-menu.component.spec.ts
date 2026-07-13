import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnersMenuComponent } from './partners-menu.component';

describe('PartnersMenuComponent', () => {
  let component: PartnersMenuComponent;
  let fixture: ComponentFixture<PartnersMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnersMenuComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PartnersMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
