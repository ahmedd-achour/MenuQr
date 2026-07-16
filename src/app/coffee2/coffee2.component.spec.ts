import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Coffee2Component } from './coffee2.component';

describe('Coffee2Component', () => {
  let component: Coffee2Component;
  let fixture: ComponentFixture<Coffee2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Coffee2Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Coffee2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
