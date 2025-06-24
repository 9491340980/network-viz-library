import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs';
import { NetworkData, NetworkVisualizationConfig, NetworkNode } from '../interfaces/network-visualization.interfaces';

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

  updatePerformanceMetrics(metrics: Partial<typeof this.initialState.performanceMetrics>): void {
    this.updateState({
      performanceMetrics: { ...this.currentState.performanceMetrics, ...metrics }
    });
  }

  // Batch updates for performance
  batchUpdate(updates: Partial<NetworkVisualizationState>): void {
    this.updateState(updates);
  }

  // Reset state
  reset(): void {
    this.state$.next({ ...this.initialState });
  }

  private updateState(updates: Partial<NetworkVisualizationState>): void {
    const currentState = this.state$.value;
    const newState = { ...currentState, ...updates };
    this.state$.next(newState);
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }
}
