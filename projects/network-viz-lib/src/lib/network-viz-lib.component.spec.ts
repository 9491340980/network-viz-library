import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkVizLibComponent } from './network-viz-lib.component';

describe('NetworkVizLibComponent', () => {
  let component: NetworkVizLibComponent;
  let fixture: ComponentFixture<NetworkVizLibComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkVizLibComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkVizLibComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
