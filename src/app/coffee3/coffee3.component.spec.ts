import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Coffee3Component } from './coffee3.component';

describe('Coffee3Component', () => {
  let component: Coffee3Component;
  let fixture: ComponentFixture<Coffee3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Coffee3Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Coffee3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
