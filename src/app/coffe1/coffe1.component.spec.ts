import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Coffe1Component } from './coffe1.component';

describe('Coffe1Component', () => {
  let component: Coffe1Component;
  let fixture: ComponentFixture<Coffe1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Coffe1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Coffe1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
