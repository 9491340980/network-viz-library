import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { NetworkData, NetworkEvent, NetworkVisualizationConfig, TooltipConfig, LegendConfig } from '../../interfaces/network-visualization.interfaces';
import { NetworkStateService } from '../../services/network-state.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkErrorService } from '../../services/network-error.service';
import { D3AbstractionService } from '../../services/d3-abstraction.service';
import { NetworkRendererService } from '../../services/network-renderer.service';
import { NetworkPerformanceService } from '../../services/network-performance.service';
import { NetworkCacheService } from '../../services/network-cache.service';
import { NetworkTooltipComponent } from '../network-tooltip/network-tooltip.component';
import { NetworkLegendComponent } from '../network-legend/network-legend.component';
import { NetworkControlsComponent } from '../network-controls/network-controls.component';

@Component({
  selector: 'app-network-visualization-v2',
  standalone: true,
  imports: [
    CommonModule,
    NetworkTooltipComponent,
    NetworkLegendComponent,
    NetworkControlsComponent
  ],
  template: `
    <div class="network-container"
         [style.width.px]="width"
         [style.height.px]="height"
         [attr.aria-busy]="isLoading()"
         role="region"
         aria-label="Network visualization">

      <!-- Error Display -->
      <div class="network-error" *ngIf="hasError()" role="alert">
        <h4>Visualization Error</h4>
        <p>{{ errorMessage() }}</p>
        <button type="button" (click)="clearError()" aria-label="Clear error">×</button>
      </div>

      <!-- Loading Indicator -->
      <div class="network-loading" *ngIf="isLoading()" aria-label="Loading visualization">
        <div class="loading-spinner"></div>
        <p>Loading visualization...</p>
      </div>

      <!-- Main SVG Canvas -->
      <svg #svgElement
           [attr.width]="width"
           [attr.height]="height"
           [attr.aria-label]="'Network visualization with ' + nodeCount() + ' nodes and ' + linkCount() + ' links'"
           [style.display]="hasError() || isLoading() ? 'none' : 'block'">
      </svg>

      <!-- Sub-components -->
      <app-network-tooltip
        *ngIf="showTooltip && !hasError()"
        [config]="getTooltipConfig()">
      </app-network-tooltip>

      <app-network-legend
        *ngIf="showLegend && !hasError()"
        [config]="getLegendConfig()">
      </app-network-legend>

      <!-- Fixed selector name -->
      <nvl-network-controls
        *ngIf="showControls && !hasError()"
        [visible]="true"
        [disabled]="isLoading()"
        [forcesEnabled]="forcesEnabled()"
        (zoomIn)="onZoomIn()"
        (zoomOut)="onZoomOut()"
        (fitToView)="onFitToView()"
        (resetView)="onResetView()"
        (toggleForces)="onToggleForces()">
      </nvl-network-controls>
    </div>
  `,
  styles: [`
    .network-container {
      position: relative;
      overflow: hidden;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: var(--background-color, #ffffff);
    }

    .network-error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ffebee;
      border: 1px solid #f44336;
      border-radius: 4px;
      padding: 20px;
      max-width: 300px;
      text-align: center;
      z-index: 1000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .network-error h4 {
      margin: 0 0 10px 0;
      color: #d32f2f;
      font-size: 16px;
    }

    .network-error p {
      margin: 0 0 15px 0;
      color: #666;
      font-size: 14px;
    }

    .network-error button {
      position: absolute;
      top: 5px;
      right: 10px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #d32f2f;
      padding: 5px;
    }

    .network-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 999;
      color: #666;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    svg {
      display: block;
      cursor: grab;
    }

    svg:active {
      cursor: grabbing;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkVisualizationV2Component implements OnInit, OnDestroy, OnChanges {
  @Input() data: NetworkData = { nodes: [], links: [] };
  @Input() config: NetworkVisualizationConfig = {};
  @Input() width: number = 800;
  @Input() height: number = 600;
  @Input() showTooltip: boolean = true;
  @Input() showLegend: boolean = true;
  @Input() showControls: boolean = true;

  @Output() nodeClick = new EventEmitter<NetworkEvent>();
  @Output() nodeHover = new EventEmitter<NetworkEvent>();
  @Output() linkClick = new EventEmitter<NetworkEvent>();
  @Output() backgroundClick = new EventEmitter<NetworkEvent>();

  @ViewChild('svgElement', { static: true }) svgElement!: ElementRef<SVGElement>;

  // Signals for reactive state
  private readonly isLoadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly nodeCountSignal = signal(0);
  private readonly linkCountSignal = signal(0);
  private readonly forcesEnabledSignal = signal(true);

  // Computed properties
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly hasError = computed(() => !!this.errorSignal());
  readonly errorMessage = computed(() => this.errorSignal());
  readonly nodeCount = computed(() => this.nodeCountSignal());
  readonly linkCount = computed(() => this.linkCountSignal());
  readonly forcesEnabled = computed(() => this.forcesEnabledSignal());

  private readonly destroy$ = new Subject<void>();

  constructor(
    private stateService: NetworkStateService,
    private dataService: NetworkDataService,
    private errorService: NetworkErrorService,
    private rendererService: NetworkRendererService,
    private performanceService: NetworkPerformanceService,
    private d3Service: D3AbstractionService,
    private cacheService: NetworkCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeVisualization();
    this.subscribeToStateChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.updateData();
    }
    if (changes['config'] && !changes['config'].firstChange) {
      this.updateConfig();
    }
    if (changes['width'] || changes['height']) {
      this.handleResize();
    }
  }

  // Public API methods for controls
  onZoomIn(): void {
    try {
      this.rendererService.zoomIn();
    } catch (error) {
      this.handleError(error);
    }
  }

  onZoomOut(): void {
    try {
      this.rendererService.zoomOut();
    } catch (error) {
      this.handleError(error);
    }
  }

  onFitToView(): void {
    try {
      this.rendererService.zoomToFit();
    } catch (error) {
      this.handleError(error);
    }
  }

  onResetView(): void {
    try {
      this.rendererService.resetZoom();
    } catch (error) {
      this.handleError(error);
    }
  }

  onToggleForces(): void {
    try {
      const currentState = this.forcesEnabled();
      this.forcesEnabledSignal.set(!currentState);
      // Additional logic to start/stop simulation would go here
    } catch (error) {
      this.handleError(error);
    }
  }

  // Config getters with defaults
  getTooltipConfig(): TooltipConfig {
    return {
      enabled: true,
      showNodeId: true,
      showNodeLabel: true,
      showNodeGroup: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: 'white',
      fontSize: 12,
      maxWidth: 200,
      borderRadius: 4,
      padding: '8px 12px',
      showDelay: 200,
      hideDelay: 100,
      ...this.config?.tooltipConfig
    };
  }

  getLegendConfig(): LegendConfig {
    return {
      enabled: true,
      position: 'top-right',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      textColor: '#333',
      borderColor: '#ddd',
      borderRadius: 4,
      padding: 10,
      fontSize: 12,
      showShapes: true,
      showColors: true,
      showSizes: false,
      ...this.config?.legendConfig
    };
  }

  clearError(): void {
    this.errorSignal.set(null);
    this.stateService.setError(null);
  }

  private initializeVisualization(): void {
    try {
      this.isLoadingSignal.set(true);
      this.performanceService.startRenderMeasurement();

      // Validate data first
      const validation = this.dataService.validateNetworkData(this.data);
      if (!validation.isValid) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }

      this.stateService.updateData(this.data);
      this.stateService.updateConfig(this.config);
      this.setupVisualization();

      this.performanceService.endRenderMeasurement(
        this.data.nodes.length,
        this.data.links.length
      );

      this.isLoadingSignal.set(false);
    } catch (error) {
      this.isLoadingSignal.set(false);
      this.handleError(error);
    }
  }

  private subscribeToStateChanges(): void {
    this.stateService.isLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading: boolean) => {
        this.isLoadingSignal.set(loading);
        this.cdr.markForCheck();
      });

    this.stateService.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: NetworkData) => {
        this.nodeCountSignal.set(data.nodes.length);
        this.linkCountSignal.set(data.links.length);
        this.cdr.markForCheck();
      });

    // Subscribe to renderer events
    this.rendererService.events
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: NetworkEvent) => {
        this.handleNetworkEvent(event);
      });
  }

  private setupVisualization(): void {
    if (!this.svgElement?.nativeElement) {
      throw new Error('SVG element not available');
    }

    // Initialize renderer
    this.rendererService.initialize(
      this.svgElement.nativeElement,
      this.width,
      this.height,
      this.config
    );

    // Render the visualization
    this.rendererService.render(
      this.data.nodes,
      this.data.links,
      this.config,
      this.width,
      this.height
    );
  }

  private updateData(): void {
    try {
      const validation = this.dataService.validateNetworkData(this.data);
      if (!validation.isValid) {
        this.errorSignal.set(validation.errors.join(', '));
        return;
      }

      const sanitizedData = this.dataService.sanitizeData(this.data);
      this.stateService.updateData(sanitizedData);

      // Re-render with new data
      this.rendererService.render(
        sanitizedData.nodes,
        sanitizedData.links,
        this.config,
        this.width,
        this.height
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private updateConfig(): void {
    try {
      this.stateService.updateConfig(this.config);
      // Re-render with new config
      this.rendererService.render(
        this.data.nodes,
        this.data.links,
        this.config,
        this.width,
        this.height
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleResize(): void {
    try {
      if (this.rendererService && this.svgElement?.nativeElement) {
        this.rendererService.initialize(
          this.svgElement.nativeElement,
          this.width,
          this.height,
          this.config
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleNetworkEvent(event: NetworkEvent): void {
    switch (event.type) {
      case 'nodeClick':
        this.nodeClick.emit(event);
        break;
      case 'nodeHover':
        this.nodeHover.emit(event);
        break;
      case 'linkClick':
        this.linkClick.emit(event);
        break;
      case 'backgroundClick':
        this.backgroundClick.emit(event);
        break;
    }
  }

  private handleError(error: any): void {
    const message = error?.message || 'An unknown error occurred';
    const networkError = this.errorService.createError('rendering', message, error);
    this.errorSignal.set(networkError.message);
    this.errorService.handleError(networkError);
  }

  private cleanup(): void {
    try {
      this.rendererService.destroy();
      this.cacheService.clear();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }
}
