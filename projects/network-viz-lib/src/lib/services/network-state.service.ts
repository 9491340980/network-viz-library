import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NetworkData, NetworkConfig, NetworkEvent } from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class NetworkStateService {
  private dataSubject = new BehaviorSubject<NetworkData>({ nodes: [], links: [] });
  private configSubject = new BehaviorSubject<NetworkConfig>({});
  private eventSubject = new BehaviorSubject<NetworkEvent | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public data$ = this.dataSubject.asObservable();
  public config$ = this.configSubject.asObservable();
  public events$ = this.eventSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  updateData(data: NetworkData): void {
    this.dataSubject.next(data);
  }

  updateConfig(config: NetworkConfig): void {
    this.configSubject.next({ ...this.configSubject.value, ...config });
  }

  emitEvent(event: NetworkEvent): void {
    this.eventSubject.next(event);
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  setError(error: string | null): void {
    this.errorSubject.next(error);
  }

  getCurrentData(): NetworkData {
    return this.dataSubject.value;
  }

  getCurrentConfig(): NetworkConfig {
    return this.configSubject.value;
  }
}
