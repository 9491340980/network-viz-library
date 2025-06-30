import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs';
import { NetworkData, NetworkNode, NetworkVisualizationConfig } from '../interfaces/network-visualization.interfaces';

export interface NetworkVisualizationState {
  data: NetworkData;
  config: NetworkVisualizationConfig;
  selectedNodes: Set<string | number>;
  hoveredNode: NetworkNode | null;
  zoomTransform: { scale: number; translate: [number, number] };
  isLoading: boolean;
  lastError: Error | null;
  performanceMetrics: {
    renderTime: number;
    nodeCount: number;
    linkCount: number;
    lastUpdate: Date;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NetworkStateService {
  private readonly initialState: NetworkVisualizationState = {
    data: { nodes: [], links: [] },
    config: {},
    selectedNodes: new Set(),
    hoveredNode: null,
    zoomTransform: { scale: 1, translate: [0, 0] },
    isLoading: false,
    lastError: null,
    performanceMetrics: {
      renderTime: 0,
      nodeCount: 0,
      linkCount: 0,
      lastUpdate: new Date()
    }
  };

  private readonly state$ = new BehaviorSubject<NetworkVisualizationState>(this.initialState);

  // Selectors
  readonly data$ = this.state$.pipe(
    map(state => state.data),
    distinctUntilChanged((prev, curr) => this.deepEqual(prev, curr))
  );

  readonly config$ = this.state$.pipe(
    map(state => state.config),
    distinctUntilChanged((prev, curr) => this.deepEqual(prev, curr))
  );

  readonly selectedNodes$ = this.state$.pipe(
    map(state => state.selectedNodes),
    distinctUntilChanged()
  );

  readonly hoveredNode$ = this.state$.pipe(
    map(state => state.hoveredNode),
    distinctUntilChanged()
  );

  readonly zoomTransform$ = this.state$.pipe(
    map(state => state.zoomTransform),
    distinctUntilChanged((prev, curr) => this.deepEqual(prev, curr))
  );

  readonly isLoading$ = this.state$.pipe(
    map(state => state.isLoading),
    distinctUntilChanged()
  );

  readonly performanceMetrics$ = this.state$.pipe(
    map(state => state.performanceMetrics),
    distinctUntilChanged((prev, curr) => this.deepEqual(prev, curr))
  );

  // State getters
  get currentState(): NetworkVisualizationState {
    return this.state$.value;
  }

  get currentData(): NetworkData {
    return this.currentState.data;
  }

  get currentConfig(): NetworkVisualizationConfig {
    return this.currentState.config;
  }

  // State mutations
  updateData(data: NetworkData): void {
    this.updateState({
      data: { ...data },
      performanceMetrics: {
        ...this.currentState.performanceMetrics,
        nodeCount: data.nodes.length,
        linkCount: data.links.length,
        lastUpdate: new Date()
      }
    });
  }

  updateConfig(config: Partial<NetworkVisualizationConfig>): void {
    this.updateState({
      config: { ...this.currentState.config, ...config }
    });
  }

  setSelectedNodes(nodeIds: (string | number)[]): void {
    this.updateState({
      selectedNodes: new Set(nodeIds)
    });
  }

  toggleNodeSelection(nodeId: string | number): void {
    const currentSelection = new Set(this.currentState.selectedNodes);
    if (currentSelection.has(nodeId)) {
      currentSelection.delete(nodeId);
    } else {
      currentSelection.add(nodeId);
    }
    this.updateState({ selectedNodes: currentSelection });
  }

  setHoveredNode(node: NetworkNode | null): void {
    this.updateState({ hoveredNode: node });
  }

  updateZoomTransform(transform: { scale: number; translate: [number, number] }): void {
    this.updateState({ zoomTransform: transform });
  }

  setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  setError(error: Error | null): void {
    this.updateState({ lastError: error });
  }

  updatePerformanceMetrics(metrics: Partial<NetworkVisualizationState['performanceMetrics']>): void {
    this.updateState({
      performanceMetrics: { ...this.currentState.performanceMetrics, ...metrics }
    });
  }

  batchUpdate(updates: Partial<NetworkVisualizationState>): void {
    this.updateState(updates);
  }

  reset(): void {
    this.state$.next({ ...this.initialState });
  }

  private updateState(updates: Partial<NetworkVisualizationState>): void {
    const currentState = this.currentState;
    const newState = { ...currentState, ...updates };
    this.state$.next(newState);
  }

  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
