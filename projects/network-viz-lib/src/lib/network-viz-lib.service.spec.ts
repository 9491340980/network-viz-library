import { TestBed } from '@angular/core/testing';

import { NetworkVizLibService } from './network-viz-lib.service';

describe('NetworkVizLibService', () => {
  let service: NetworkVizLibService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkVizLibService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
