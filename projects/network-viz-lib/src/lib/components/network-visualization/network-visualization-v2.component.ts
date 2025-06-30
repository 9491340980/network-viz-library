// Complete NetworkVisualizationV2Component with all fixes
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
import * as d3 from 'd3';

import {
  NetworkData,
  NetworkEvent,
  NetworkVisualizationConfig,
  TooltipConfig,
  LegendConfig,
  NetworkNode,
  NetworkLink,
  LegendItem
} from '../../interfaces/network-visualization.interfaces';
import { NetworkStateService } from '../../services/network-state.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkErrorService } from '../../services/network-error.service';
import { NetworkTooltipComponent } from '../network-tooltip/network-tooltip.component';
import { NetworkLegendComponent } from '../network-legend/network-legend.component';
import { NetworkControlsComponent } from '../network-controls/network-controls.component';

// Type aliases for cleaner D3 typing
type D3Selection = d3.Selection<any, any, any, any>;
type D3Simulation = d3.Simulation<any, any>;
type D3ZoomBehavior = d3.ZoomBehavior<any, any>;
type D3DragBehavior = d3.DragBehavior<any, any, any>;

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

      <!-- Tooltip Component -->
      <app-network-tooltip
        *ngIf="showTooltip && !hasError()"
        [node]="hoveredNode()"
        [link]="hoveredLink()"
        [config]="getTooltipConfig()"
        [position]="tooltipPosition()"
        [visible]="!!hoveredNode() || !!hoveredLink()">
      </app-network-tooltip>

      <!-- Legend Component -->
      <app-network-legend
        *ngIf="showLegend && !hasError()"
        [items]="legendItems()"
        [config]="getLegendConfig()"
        [visible]="true">
      </app-network-legend>

      <!-- Controls Component -->
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
      border: 2px solid green !important; /* Debug border */
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
      border: 2px solid blue !important; /* Debug border */
      background-color: #f0f0f0 !important; /* Light background */
    }

    svg:active {
      cursor: grabbing;
    }

    /* FORCE VISIBILITY STYLES */
    :host ::ng-deep .node {
      pointer-events: all !important;
      cursor: pointer !important;
    }

    :host ::ng-deep .node circle {
      fill: red !important;
      stroke: blue !important;
      stroke-width: 3px !important;
      opacity: 1 !important;
      display: block !important;
      visibility: visible !important;
    }

    :host ::ng-deep .node rect {
      fill: red !important;
      stroke: blue !important;
      stroke-width: 3px !important;
      opacity: 1 !important;
      display: block !important;
      visibility: visible !important;
    }

    :host ::ng-deep .link {
      stroke: green !important;
      stroke-width: 3px !important;
      opacity: 1 !important;
      display: block !important;
      visibility: visible !important;
    }

    :host ::ng-deep .zoom-group,
    :host ::ng-deep .nodes-group,
    :host ::ng-deep .links-group {
      display: block !important;
      visibility: visible !important;
    }

    :host ::ng-deep .node.highlighted {
      stroke: #ff6b35;
      stroke-width: 5px;
    }

    :host ::ng-deep .link.highlighted {
      stroke: #ff6b35;
      stroke-opacity: 1;
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
  private readonly hoveredNodeSignal = signal<NetworkNode | null>(null);
  private readonly hoveredLinkSignal = signal<NetworkLink | null>(null);
  private readonly tooltipPositionSignal = signal({ x: 0, y: 0 });
  private readonly legendItemsSignal = signal<LegendItem[]>([]);

  // Computed properties
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly hasError = computed(() => !!this.errorSignal());
  readonly errorMessage = computed(() => this.errorSignal());
  readonly nodeCount = computed(() => this.nodeCountSignal());
  readonly linkCount = computed(() => this.linkCountSignal());
  readonly forcesEnabled = computed(() => this.forcesEnabledSignal());
  readonly hoveredNode = computed(() => this.hoveredNodeSignal());
  readonly hoveredLink = computed(() => this.hoveredLinkSignal());
  readonly tooltipPosition = computed(() => this.tooltipPositionSignal());
  readonly legendItems = computed(() => this.legendItemsSignal());

  private readonly destroy$ = new Subject<void>();

  // D3 objects
  private svg!: D3Selection;
  private g!: D3Selection;
  private simulation!: D3Simulation;
  private zoom!: D3ZoomBehavior;

  // Data references for simulation
  private simulationNodes: NetworkNode[] = [];
  private simulationLinks: NetworkLink[] = [];

  constructor(
    private stateService: NetworkStateService,
    private dataService: NetworkDataService,
    private errorService: NetworkErrorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🔄 Component ngOnInit - checking if data is available');
    console.log('Initial data:', this.data);

    // DON'T initialize immediately - wait for data
    // Just setup subscriptions
    this.subscribeToStateChanges();

    // Only initialize if we have actual data
    if (this.hasValidData()) {
      console.log('✅ Data available during ngOnInit, initializing...');
      this.initializeVisualization();
    } else {
      console.log('⏳ No data available during ngOnInit, waiting for data...');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('🔄 ngOnChanges triggered:', Object.keys(changes));

    if (changes['data'] && !changes['data'].firstChange) {
      console.log('📊 Data changed:', changes['data'].currentValue);
      this.handleDataChange();
    } else if (changes['data'] && changes['data'].firstChange) {
      console.log('📊 First data change:', changes['data'].currentValue);
      // This is the first time data is set
      if (this.hasValidData()) {
        console.log('✅ First valid data received, initializing visualization');
        this.initializeVisualization();
      }
    }

    if (changes['config'] && !changes['config'].firstChange) {
      console.log('⚙️ Config changed');
      this.updateConfig();
    }

    if ((changes['width'] || changes['height']) && !changes['width']?.firstChange) {
      console.log('📐 Dimensions changed');
      this.handleResize();
    }
  }

  // Helper method to check if data is valid
  private hasValidData(): boolean {
    const isValid = !!(
      this.data &&
      this.data.nodes &&
      this.data.links &&
      this.data.nodes.length > 0
    );

    console.log(`📊 Data validation: ${isValid ? 'VALID' : 'INVALID'}`, {
      hasData: !!this.data,
      hasNodes: !!(this.data?.nodes),
      hasLinks: !!(this.data?.links),
      nodeCount: this.data?.nodes?.length || 0,
      linkCount: this.data?.links?.length || 0
    });

    return isValid;
  }

  // Handle data changes
  private handleDataChange(): void {
    try {
      if (!this.hasValidData()) {
        console.log('⚠️ Invalid data provided, skipping update');
        return;
      }

      console.log('🔄 Handling data change with valid data');

      // Check if visualization is already initialized
      if (this.svg) {
        console.log('🔄 Updating existing visualization');
        this.updateData();
      } else {
        console.log('🆕 Initializing visualization for first time');
        this.initializeVisualization();
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  // Public API methods for controls
  onZoomIn(): void {
    try {
      this.svg.transition().call(this.zoom.scaleBy, 1.5);
    } catch (error) {
      this.handleError(error);
    }
  }

  onZoomOut(): void {
    try {
      this.svg.transition().call(this.zoom.scaleBy, 1 / 1.5);
    } catch (error) {
      this.handleError(error);
    }
  }

  onFitToView(): void {
    try {
      this.fitToView();
    } catch (error) {
      this.handleError(error);
    }
  }

  onResetView(): void {
    try {
      this.svg.transition().call(this.zoom.transform, d3.zoomIdentity);
    } catch (error) {
      this.handleError(error);
    }
  }

  onToggleForces(): void {
    try {
      const currentState = this.forcesEnabled();
      this.forcesEnabledSignal.set(!currentState);

      if (this.simulation) {
        if (!currentState) {
          this.simulation.alpha(0.3).restart();
        } else {
          this.simulation.stop();
        }
      }
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

  private setupSVG(): void {
    this.svg = d3.select(this.svgElement.nativeElement);

    // Clear existing content
    this.svg.selectAll('*').remove();

    // Set viewBox for responsiveness
    this.svg
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Create main group for zoom/pan
    this.g = this.svg.append('g').attr('class', 'zoom-group');

    // Create layers in correct order (links first, then nodes)
    this.g.append('g').attr('class', 'links-group');
    this.g.append('g').attr('class', 'nodes-group');

    console.log('✅ SVG setup complete');
  }

  private setupZoom(): void {
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Add background click handler
    this.svg.on('click', (event) => {
      if (event.target === this.svg.node()) {
        this.backgroundClick.emit({
          type: 'backgroundClick',
          originalEvent: event,
          position: { x: event.offsetX, y: event.offsetY }
        });
      }
    });

    console.log('✅ Zoom setup complete');
  }

  private renderNodes(nodes: NetworkNode[]): void {
    const nodeGroup = this.g.select('.nodes-group');

    // Use the SAME node objects that the simulation is modifying
    const nodeSelection = nodeGroup.selectAll('.node')
      .data(this.simulationNodes.length > 0 ? this.simulationNodes : nodes, (d: any) => d.id.toString());

    // Remove old nodes
    nodeSelection.exit().remove();

    // Add new nodes
    const nodeEnter: any = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer');

    // Add shapes with FORCED VISIBILITY
    nodeEnter.each((d: any, i: number, nodeElements: any[]) => {
      const nodeData = d as NetworkNode;
      const element = d3.select(nodeElements[i]);
      const shape = nodeData.shape || this.config.nodeStyles?.defaultShape || 'circle';
      const size = nodeData.size || this.config.nodeStyles?.defaultSize || 20; // Bigger default

      console.log(`🎨 Creating node ${nodeData.id} with shape: ${shape}, size: ${size}`);

      switch (shape) {
        case 'circle':
          element.append('circle')
            .attr('r', size)
            .attr('fill', 'red') // FORCE RED COLOR for debugging
            .attr('stroke', 'blue') // FORCE BLUE BORDER for debugging
            .attr('stroke-width', 3); // THICK BORDER for debugging
          break;
        case 'square':
          element.append('rect')
            .attr('width', size * 2)
            .attr('height', size * 2)
            .attr('x', -size)
            .attr('y', -size)
            .attr('fill', 'red') // FORCE RED COLOR for debugging
            .attr('stroke', 'blue') // FORCE BLUE BORDER for debugging
            .attr('stroke-width', 3); // THICK BORDER for debugging
          break;
        default:
          element.append('circle')
            .attr('r', size)
            .attr('fill', 'red') // FORCE RED COLOR for debugging
            .attr('stroke', 'blue') // FORCE BLUE BORDER for debugging
            .attr('stroke-width', 3); // THICK BORDER for debugging
      }
    });

    // Merge enter and update selections
    const nodeMerge = nodeEnter.merge(nodeSelection);

    // SKIP normal styling and FORCE visible styles
    console.log('🎨 Forcing visible node styles...');
    nodeMerge.selectAll('circle, rect')
      .attr('fill', 'red')
      .attr('stroke', 'blue')
      .attr('stroke-width', 3)
      .attr('opacity', 1); // Ensure fully opaque

    // Add interactions
    this.addNodeInteractions(nodeMerge);

    // Setup drag behavior
    if (this.config.interactionConfig?.enableDrag !== false) {
      this.setupNodeDrag(nodeMerge);
    }

    console.log('✅ renderNodes complete with forced styling');
  }

  private renderLinks(links: NetworkLink[]): void {
    const linkGroup: any = this.g.select('.links-group');

    // Use the SAME link objects that the simulation is modifying
    const linkSelection = linkGroup.selectAll('.link')
      .data(this.simulationLinks.length > 0 ? this.simulationLinks : links);

    // Remove old links
    linkSelection.exit().remove();

    // Add new links
    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', 'green') // FORCE GREEN for debugging
      .attr('stroke-width', 3); // THICK for debugging

    // Merge and apply styles
    const linkMerge = linkEnter.merge(linkSelection);
    linkMerge
      .attr('stroke', 'green')
      .attr('stroke-width', 3)
      .attr('opacity', 1);

    // Add link interactions
    this.addLinkInteractions(linkMerge);

    console.log('✅ renderLinks complete');
  }

  private addNodeInteractions(nodeSelection: D3Selection): void {
    nodeSelection
      .on('click', (event: MouseEvent, d: any) => {
        const nodeData = d as NetworkNode;
        event.stopPropagation();
        this.nodeClick.emit({
          type: 'nodeClick',
          data: nodeData,
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      })
      .on('mouseenter', (event: MouseEvent, d: any) => {
        const nodeData = d as NetworkNode;
        this.hoveredNodeSignal.set(nodeData);
        this.tooltipPositionSignal.set({ x: event.pageX + 10, y: event.pageY - 10 });
        this.nodeHover.emit({
          type: 'nodeHover',
          data: nodeData,
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      })
      .on('mouseleave', (event: MouseEvent, d: any) => {
        this.hoveredNodeSignal.set(null);
        this.nodeHover.emit({
          type: 'nodeHover',
          data: null,
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      });
  }

  private addLinkInteractions(linkSelection: D3Selection): void {
    linkSelection
      .on('click', (event: MouseEvent, d: any) => {
        const linkData = d as NetworkLink;
        event.stopPropagation();
        this.linkClick.emit({
          type: 'linkClick',
          data: linkData,
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      });
  }

  private setupNodeDrag(nodeSelection: D3Selection): void {
    const dragHandler: D3DragBehavior = d3.drag()
      .on('start', (event: any, d: any) => {
        const nodeData = d as NetworkNode;
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        nodeData.fx = nodeData.x;
        nodeData.fy = nodeData.y;
      })
      .on('drag', (event: any, d: any) => {
        const nodeData = d as NetworkNode;
        nodeData.fx = event.x;
        nodeData.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        const nodeData = d as NetworkNode;
        if (!event.active) this.simulation.alphaTarget(0);
        nodeData.fx = null;
        nodeData.fy = null;
      });

    nodeSelection.call(dragHandler);
  }

  private updatePositions(): void {
    console.log('🎯 updatePositions called');

    // Debug: Log actual position values
    if (this.simulationNodes.length > 0) {
      console.log('📍 First 3 node positions:');
      this.simulationNodes.slice(0, 3).forEach(n => {
        console.log(`  Node ${n.id}: x=${n.x?.toFixed(1)}, y=${n.y?.toFixed(1)}, fx=${n.fx}, fy=${n.fy}`);
      });
    }

    // Update node positions
    const nodeElements = this.g.selectAll('.node');
    console.log('🔍 Found node elements:', nodeElements.size());

    nodeElements
      .attr('transform', (d: any) => {
        const nodeData:any = d as NetworkNode;
        const x = nodeData.x || 0;
        const y = nodeData.y || 0;

        const transform = `translate(${x},${y})`;

        // Debug first few transforms
        if (parseInt(nodeData.id) <= 3) {
          console.log(`🎨 Node ${nodeData.id} transform: ${transform}`);
        }

        return transform;
      });

    // DEBUG: Check if nodes have visual elements
    nodeElements.each(function(d: any, i: number) {
      if (i < 3) { // Only check first 3
        const element = d3.select(this);
        const circles = element.selectAll('circle');
        const rects = element.selectAll('rect');

        console.log(`🔍 Node ${i} DOM:`, {
          id: d.id,
          circles: circles.size(),
          rects: rects.size(),
          transform: element.attr('transform'),
          circleR: circles.size() > 0 ? circles.attr('r') : 'none',
          circleFill: circles.size() > 0 ? circles.attr('fill') : 'none',
          circleStroke: circles.size() > 0 ? circles.attr('stroke') : 'none'
        });
      }
    });

    // Update link positions
    const linkElements = this.g.selectAll('.link');
    console.log('🔍 Found link elements:', linkElements.size());

    linkElements
      .attr('x1', (d: any) => {
        const linkData = d as NetworkLink;
        const source = linkData.source as NetworkNode;
        return source.x || 0;
      })
      .attr('y1', (d: any) => {
        const linkData = d as NetworkLink;
        const source = linkData.source as NetworkNode;
        return source.y || 0;
      })
      .attr('x2', (d: any) => {
        const linkData = d as NetworkLink;
        const target = linkData.target as NetworkNode;
        return target.x || 0;
      })
      .attr('y2', (d: any) => {
        const linkData = d as NetworkLink;
        const target = linkData.target as NetworkNode;
        return target.y || 0;
      });
  }

  private generateLegendItems(data: NetworkData): void {
    const items: LegendItem[] = [];

    // Generate items based on node groups/categories
    const groups = new Set(data.nodes.map(n => n.group).filter(g => g !== undefined));
    groups.forEach(group => {
      const color = this.config.nodeStyles?.groupColors?.[group!] || '#69b3a2';
      items.push({
        label: `Group ${group}`,
        color,
        shape: 'circle'
      });
    });

    this.legendItemsSignal.set(items);
  }

  private fitToView(): void {
    const nodes = this.data.nodes.filter(n =>
      typeof n.x === 'number' && typeof n.y === 'number' &&
      !isNaN(n.x) && !isNaN(n.y)
    );

    if (nodes.length === 0) return;

    const padding = 50;
    const bounds = {
      minX: Math.min(...nodes.map(n => n.x!)),
      maxX: Math.max(...nodes.map(n => n.x!)),
      minY: Math.min(...nodes.map(n => n.y!)),
      maxY: Math.max(...nodes.map(n => n.y!))
    };

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    if (width === 0 || height === 0) return;

    const scale = Math.min(
      (this.width - padding * 2) / width,
      (this.height - padding * 2) / height,
      2 // Max zoom
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    this.svg.transition().duration(750).call(this.zoom.transform, transform);
  }

  private applyInitialZoom(): void {
    const zoomConfig = this.config.zoomConfig;

    if (zoomConfig?.zoomOnLoad === 'fit') {
      setTimeout(() => this.fitToView(), 100);
    }
  }

  private subscribeToStateChanges(): void {
    this.stateService.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: NetworkData) => {
        this.nodeCountSignal.set(data.nodes.length);
        this.linkCountSignal.set(data.links.length);
        this.cdr.markForCheck();
      });
  }

  private updateData(): void {
    try {
      const validation = this.dataService.validateNetworkData(this.data);
      if (!validation.isValid) {
        this.errorSignal.set(validation.errors.join(', '));
        return;
      }

      this.nodeCountSignal.set(this.data.nodes.length);
      this.linkCountSignal.set(this.data.links.length);
      this.render();
    } catch (error) {
      this.handleError(error);
    }
  }

  private updateConfig(): void {
    try {
      this.render();
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleResize(): void {
    try {
      if (this.svg) {
        this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
        if (this.simulation) {
          this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
          this.simulation.alpha(0.3).restart();
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): void {
    const message = error?.message || 'An unknown error occurred';
    this.errorSignal.set(message);
    console.error('Network visualization error:', error);
  }

  private cleanup(): void {
    try {
      if (this.simulation) {
        this.simulation.stop();
      }
      if (this.svg) {
        this.svg.selectAll('*').remove();
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  private validateAndSanitizeData(data: NetworkData): NetworkData {
    console.log('🧹 Starting data validation and sanitization');
    console.log('Input data:', { nodeCount: data.nodes?.length || 0, linkCount: data.links?.length || 0 });

    // Guard against null/undefined data
    if (!data || !data.nodes || !data.links) {
      console.error('❌ Invalid data structure provided');
      return { nodes: [], links: [] };
    }

    // Ensure all nodes have valid IDs
    const validNodes = data.nodes.filter(node =>
      node.id !== null &&
      node.id !== undefined &&
      node.id !== ''
    );

    if (validNodes.length !== data.nodes.length) {
      console.warn(`🧹 Removed ${data.nodes.length - validNodes.length} invalid nodes`);
    }

    // Create a map of valid node IDs for quick lookup
    const nodeIdMap = new Map();
    validNodes.forEach(node => {
      // Normalize ID to string for consistent comparison
      const normalizedId = node.id.toString();
      nodeIdMap.set(normalizedId, node);
      // Ensure the node ID is consistently a string
      node.id = normalizedId;
    });

    // Filter links to only include those with valid source and target nodes
    const validLinks = data.links.filter(link => {
      const sourceId = (typeof link.source === 'object' ? link.source.id : link.source).toString();
      const targetId = (typeof link.target === 'object' ? link.target.id : link.target).toString();

      const hasValidSource = nodeIdMap.has(sourceId);
      const hasValidTarget = nodeIdMap.has(targetId);

      if (!hasValidSource) {
        console.warn(`🧹 Link references invalid source node: ${sourceId}`);
      }
      if (!hasValidTarget) {
        console.warn(`🧹 Link references invalid target node: ${targetId}`);
      }

      return hasValidSource && hasValidTarget;
    }).map(link => ({
      ...link,
      // Normalize source and target to string IDs
      source: (typeof link.source === 'object' ? link.source.id : link.source).toString(),
      target: (typeof link.target === 'object' ? link.target.id : link.target).toString()
    }));

    if (validLinks.length !== data.links.length) {
      console.warn(`🧹 Removed ${data.links.length - validLinks.length} invalid links`);
    }

    const result = {
      nodes: validNodes,
      links: validLinks
    };

    console.log(`✅ Data validation complete: ${validNodes.length} nodes, ${validLinks.length} links`);

    return result;
  }

  private setupSimulation(data: NetworkData): void {
    try {
      if (this.simulation) {
        this.simulation.stop();
      }

      if (!data.nodes || data.nodes.length === 0) {
        console.warn('No nodes to simulate');
        return;
      }

      // Work directly with the data objects (don't copy)
      const nodes = data.nodes;
      const links = data.links;

      // CRITICAL: Initialize node positions if not present
      nodes.forEach((node, index) => {
        node.id = node.id.toString();

        // Give each node a different starting position to avoid overlap
        if (node.x === undefined || node.y === undefined) {
          // Spread nodes in a circle initially
          const angle = (index / nodes.length) * 2 * Math.PI;
          const radius = Math.min(this.width, this.height) * 0.3;
          node.x = this.width / 2 + Math.cos(angle) * radius;
          node.y = this.height / 2 + Math.sin(angle) * radius;

          console.log(`🎯 Initialized node ${node.id} at (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
        }
      });

      // Validate and prepare links
      const nodeIds = new Set(nodes.map(n => n.id));
      const validLinks = links.filter(link => {
        const sourceId = (typeof link.source === 'object' ? link.source.id : link.source).toString();
        const targetId = (typeof link.target === 'object' ? link.target.id : link.target).toString();

        const isValid = nodeIds.has(sourceId) && nodeIds.has(targetId);
        if (!isValid) {
          console.warn(`Skipping invalid link: ${sourceId} -> ${targetId}`);
        }
        return isValid;
      }).map(link => ({
        ...link,
        source: (typeof link.source === 'object' ? link.source.id : link.source).toString(),
        target: (typeof link.target === 'object' ? link.target.id : link.target).toString()
      }));

      console.log(`Creating simulation: ${nodes.length} nodes, ${validLinks.length} valid links`);

      // Store references to the data being used by simulation
      this.simulationNodes = nodes;
      this.simulationLinks = validLinks;

      // Create simulation with stronger forces
      this.simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(validLinks)
          .id((d: any) => d.id)
          .distance(this.config.forceConfig?.linkDistance || 80) // Increased distance
          .strength(this.config.forceConfig?.linkStrength || 0.2) // Increased strength
        )
        .force('charge', d3.forceManyBody()
          .strength(this.config.forceConfig?.chargeStrength || -400) // Stronger repulsion
        )
        .force('center', d3.forceCenter(this.width / 2, this.height / 2)
          .strength(this.config.forceConfig?.centerStrength || 0.5) // Moderate centering
        )
        .force('collision', d3.forceCollide()
          .radius((d: any) => (d.size || 15) + 10) // Bigger collision radius
          .strength(0.8) // Strong collision avoidance
        )
        .velocityDecay(this.config.forceConfig?.velocityDecay || 0.3) // Slower decay
        .alphaDecay(this.config.forceConfig?.alphaDecay || 0.01); // Much slower alpha decay

      // Enhanced tick event with debugging
      let tickCount = 0;
      this.simulation.on('tick', () => {
        tickCount++;
        if (tickCount % 10 === 0) { // Log every 10th tick
          console.log(`⚡ Tick ${tickCount}, alpha: ${this.simulation.alpha().toFixed(3)}`);
        }
        this.updatePositions();
      });

      // Log when simulation starts and ends
      this.simulation.on('end', () => {
        console.log(`🏁 Simulation ended after ${tickCount} ticks`);
        console.log('Final positions:', nodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y })));
      });

      console.log('✅ Simulation created successfully');

    } catch (error) {
      console.error('❌ Simulation creation failed:', error);
      this.handleError(error);
    }
  }

  private render(): void {
    try {
      console.log('🎨 Starting render process');

      // Double-check we have valid data
      if (!this.hasValidData()) {
        console.warn('❌ Cannot render: no valid data');
        return;
      }

      // Validate and sanitize data first
      const cleanData = this.validateAndSanitizeData(this.data);

      // Final check after sanitization
      if (cleanData.nodes.length === 0) {
        console.warn('❌ Cannot render: no nodes after sanitization');
        return;
      }

      console.log(`🎨 Rendering ${cleanData.nodes.length} nodes and ${cleanData.links.length} links`);

      // Setup force simulation with clean data
      this.setupSimulation(cleanData);

      // Render with clean data
      this.renderLinks(cleanData.links);
      this.renderNodes(cleanData.nodes);

      // Generate legend items
      this.generateLegendItems(cleanData);

      // Apply initial zoom if configured
      this.applyInitialZoom();

      console.log('✅ Render complete');

    } catch (error) {
      console.error('❌ Render failed:', error);
      this.handleError(error);
    }
  }

  private initializeVisualization(): void {
    try {
      console.log('🚀 Starting visualization initialization');

      // Guard against invalid data
      if (!this.hasValidData()) {
        console.warn('❌ Cannot initialize visualization: no valid data');
        return;
      }

      this.isLoadingSignal.set(true);

      // Validate data structure
      const validation = this.dataService.validateNetworkData(this.data);
      if (!validation.isValid) {
        console.warn('⚠️ Data validation warnings:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Update signals with original data count
      this.nodeCountSignal.set(this.data.nodes.length);
      this.linkCountSignal.set(this.data.links.length);

      console.log(`📊 Initializing with ${this.data.nodes.length} nodes and ${this.data.links.length} links`);

      // Initialize D3 SVG (only if not already done)
      if (!this.svg) {
        this.setupSVG();
        this.setupZoom();
      }

      this.render();

      this.isLoadingSignal.set(false);
      console.log('✅ Visualization initialized successfully');

    } catch (error) {
      this.isLoadingSignal.set(false);
      this.handleError(error);
    }
  }

  // Debug methods
  debugVisualization(): void {
    console.log('🔍 DEBUG: Complete Visualization State');

    // Check SVG
    if (this.svg) {
      const svgNode = this.svg.node() as SVGElement;
      console.log('📐 SVG info:', {
        width: svgNode.getAttribute('width'),
        height: svgNode.getAttribute('height'),
        viewBox: svgNode.getAttribute('viewBox'),
        display: window.getComputedStyle(svgNode).display,
        visibility: window.getComputedStyle(svgNode).visibility
      });
    }

    // Check zoom group
    if (this.g) {
      const gNode = this.g.node() as SVGGElement;
      console.log('🔍 Zoom group info:', {
        transform: gNode.getAttribute('transform'),
        childElementCount: gNode.childElementCount
      });
    }

    // Check nodes in detail
    if (this.g) {
      const nodeElements = this.g.selectAll('.node');
      console.log('🔍 Node elements detailed check:');

      nodeElements.each(function(d: any, i: number) {
        if (i < 5) { // Check first 5 nodes
          const element = this as SVGGElement;
          const d3Element = d3.select(element);

          console.log(`Node ${i} (id: ${d.id}):`);
          console.log('  Transform:', element.getAttribute('transform'));
          console.log('  Child elements:', element.childElementCount);

          // Check circles
          const circles = d3Element.selectAll('circle');
          circles.each(function() {
            const circle = this as SVGCircleElement;
            console.log('  Circle:', {
              r: circle.getAttribute('r'),
              fill: circle.getAttribute('fill'),
              stroke: circle.getAttribute('stroke'),
              strokeWidth: circle.getAttribute('stroke-width'),
              opacity: circle.getAttribute('opacity'),
              computedFill: window.getComputedStyle(circle).fill,
              computedDisplay: window.getComputedStyle(circle).display
            });
          });
        }
      });
    }

    // Check simulation
    console.log('⚡ Simulation info:', {
      exists: !!this.simulation,
      alpha: this.simulation?.alpha(),
      nodes: this.simulationNodes?.length || 0,
      links: this.simulationLinks?.length || 0
    });
  }

  forceRepositionNodes(): void {
    console.log('🔄 Force repositioning nodes');

    if (this.simulationNodes && this.simulationNodes.length > 0) {
      // Spread nodes in a grid pattern
      const cols = Math.ceil(Math.sqrt(this.simulationNodes.length));
      const rows = Math.ceil(this.simulationNodes.length / cols);
      const cellWidth = this.width / (cols + 1);
      const cellHeight = this.height / (rows + 1);

      this.simulationNodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        node.x = (col + 1) * cellWidth;
        node.y = (row + 1) * cellHeight;

        // Clear fixed positions
        node.fx = null;
        node.fy = null;

        console.log(`📍 Repositioned node ${node.id} to (${node.x}, ${node.y})`);
      });

      // Restart simulation with higher alpha
      if (this.simulation) {
        this.simulation.alpha(1).restart();
      }

      // Force immediate position update
      this.updatePositions();
    }
  }
}
