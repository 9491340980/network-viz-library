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
  signal,
  computed,
  SecurityContext,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import * as d3 from 'd3';
import {
  NetworkData,
  NetworkNode,
  NetworkLink,
  NetworkVisualizationConfig,
  NetworkEvent,
  NetworkError,
  NodeShape,
  ZoomConfig
} from '../../interfaces/network-visualization.interfaces';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkErrorService } from '../../services/network-error.service';
import { NetworkStateService } from '../../services/network-state.service';

@Component({
  selector: 'nvl-network-visualization-v2',
  standalone: true,
  imports: [CommonModule],
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
           [style.display]="hasError() || isLoading() ? 'none' : 'block'"
           role="img"
           tabindex="0"
           (keydown)="onKeyDown($event)">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#999" />
          </marker>
        </defs>
        <g class="zoom-group">
          <g class="links-group"></g>
          <g class="nodes-group"></g>
          <g class="labels-group"></g>
        </g>
      </svg>

      <!-- Tooltip -->
      <div class="network-tooltip"
           [style.display]="showTooltipComputed() && safeTooltipContent() ? 'block' : 'none'"
           [style.left.px]="tooltipPosition().x"
           [style.top.px]="tooltipPosition().y"
           [style.background-color]="getTooltipConfig().backgroundColor || 'rgba(0, 0, 0, 0.8)'"
           [style.color]="getTooltipConfig().textColor || 'white'"
           [style.font-size.px]="getTooltipConfig().fontSize || 12"
           [style.max-width.px]="getTooltipConfig().maxWidth || 200"
           [style.border-radius.px]="getTooltipConfig().borderRadius || 4"
           [style.padding]="getTooltipConfig().padding || '8px 12px'"
           role="tooltip">
        <div [innerHTML]="safeTooltipContent()"></div>
      </div>

      <!-- Controls -->
      <div class="network-controls" *ngIf="showControls">
        <button type="button" (click)="zoomIn()" aria-label="Zoom in" [disabled]="isLoading()">+</button>
        <button type="button" (click)="zoomOut()" aria-label="Zoom out" [disabled]="isLoading()">-</button>
        <button type="button" (click)="fitToView()" aria-label="Fit to view" [disabled]="isLoading()">⌂</button>
        <button type="button" (click)="toggleForces()" aria-label="Toggle forces" [disabled]="isLoading()">
          {{ forcesEnabled() ? '⏸' : '▶' }}
        </button>
        <button type="button" (click)="resetView()" aria-label="Reset view" [disabled]="isLoading()">↺</button>
      </div>

      <!-- Legend -->
      <div class="network-legend"
           *ngIf="shouldShowLegend() && legendData().length > 0"
           [class]="'legend-' + getLegendConfig().position"
           [style.max-width.px]="getLegendConfig().maxWidth"
           [style.background-color]="getLegendConfig().backgroundColor || 'rgba(255, 255, 255, 0.95)'"
           [style.border-radius.px]="getLegendConfig().borderRadius || 4"
           [style.padding.px]="getLegendConfig().padding || 10"
           [style.font-size.px]="getLegendConfig().fontSize || 12"
           role="region"
           aria-label="Legend">
        <h4 *ngIf="getLegendConfig().title" [style.margin]="'0 0 8px 0'">
          {{ getLegendConfig().title }}
        </h4>
        <div class="legend-items">
          <div class="legend-item"
               *ngFor="let item of legendData(); trackBy: trackLegendItem"
               [style.display]="item.visible !== false ? 'flex' : 'none'">
            <div class="legend-symbol"
                 [style.background-color]="item.color"
                 [style.width.px]="item.size || 12"
                 [style.height.px]="item.size || 12"
                 [style.border-radius]="item.shape === 'circle' ? '50%' : '2px'">
            </div>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .network-container {
      position: relative;
      overflow: hidden;
      border: 1px solid #ddd;
      border-radius: 4px;
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
    }

    .network-error h4 {
      color: #d32f2f;
      margin: 0 0 10px 0;
    }

    .network-error button {
      position: absolute;
      top: 5px;
      right: 5px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #d32f2f;
    }

    .network-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 999;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
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

    .network-tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 200px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .network-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 200;
    }

    .network-controls button {
      width: 32px;
      height: 32px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .network-controls button:hover:not(:disabled) {
      background: #f5f5f5;
    }

    .network-controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .network-legend {
      position: absolute;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      font-size: 12px;
      max-width: 200px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 100;
    }

    .legend-top-left {
      top: 10px;
      left: 10px;
    }

    .legend-top-right {
      top: 10px;
      right: 10px;
    }

    .legend-bottom-left {
      bottom: 10px;
      left: 10px;
    }

    .legend-bottom-right {
      bottom: 10px;
      right: 10px;
    }

    .network-legend h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
    }

    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-symbol {
      flex-shrink: 0;
    }

    /* Node and link styles */
    .node {
      cursor: pointer;
      stroke-width: 2px;
    }

    .node:hover {
      stroke-width: 3px;
    }

    .link {
      fill: none;
      stroke-opacity: 0.6;
    }

    .link:hover {
      stroke-opacity: 1;
      stroke-width: 3px;
    }

    .node-label {
      font-family: Arial, sans-serif;
      font-size: 10px;
      fill: #333;
      text-anchor: middle;
      pointer-events: none;
      user-select: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkVisualizationV2Component implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @ViewChild('svgElement', { static: true }) svgElement!: ElementRef<SVGElement>;

  // Inputs with validation
  private _data: NetworkData = { nodes: [], links: [] };
  @Input()
  set data(value: NetworkData) {
    const validation = this.dataService.validateNetworkData(value);

    if (!validation.isValid) {
      this.handleDataError('Invalid data provided', validation.errors);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn('Network Visualization Warnings:', validation.warnings);
    }

    this._data = this.dataService.sanitizeData(value);
    this.dataSignal.set(this._data);
    this.stateService.updateData(this._data);
  }
  get data(): NetworkData {
    return this._data;
  }

  private _config: NetworkVisualizationConfig = {};
  @Input()
  set config(value: NetworkVisualizationConfig) {
    if (this.deepEqual(this._config, value)) return;
    this._config = Object.freeze({ ...value });
    this.configSignal.set(this._config);
    this.stateService.updateConfig(this._config);
    this.cdr.markForCheck();
  }
  get config(): NetworkVisualizationConfig {
    return this._config;
  }

  @Input() width: number = 800;
  @Input() height: number = 600;
  @Input() showControls: boolean = true;
  @Input() showLegend: boolean = true;
  @Input() showTooltip: boolean = true;

  // Outputs
  @Output() nodeClick = new EventEmitter<NetworkEvent>();
  @Output() nodeHover = new EventEmitter<NetworkEvent>();
  @Output() nodeRightClick = new EventEmitter<NetworkEvent>();
  @Output() linkClick = new EventEmitter<NetworkEvent>();
  @Output() linkHover = new EventEmitter<NetworkEvent>();
  @Output() backgroundClick = new EventEmitter<NetworkEvent>();
  @Output() dataChanged = new EventEmitter<NetworkData>();
  @Output() error = new EventEmitter<NetworkError>();
  @Output() zoomChanged = new EventEmitter<{ scale: number; translate: [number, number] }>();

  // Signals for reactive UI
  private dataSignal = signal<NetworkData>({ nodes: [], links: [] });
  private configSignal = signal<NetworkVisualizationConfig>({});
  private tooltipContentSignal = signal('');
  private tooltipPositionSignal = signal({ x: 0, y: 0 });
  private forcesEnabledSignal = signal(true);
  private isLoadingSignal = signal(false);
  private errorSignal = signal<NetworkError | null>(null);

  // Computed values
  nodeCount = computed(() => this.dataSignal().nodes.length);
  linkCount = computed(() => this.dataSignal().links.length);
  legendData = computed(() => this.generateLegendData());
  shouldShowLegend = computed(() => this.getLegendConfig().enabled !== false && (this.showLegend || this.getLegendConfig().enabled));
  showTooltipComputed = computed(() => this.getTooltipConfig().enabled !== false && (this.showTooltip || this.getTooltipConfig().enabled));
  hasError = computed(() => this.errorSignal() !== null);
  isLoading = computed(() => this.isLoadingSignal());
  errorMessage = computed(() => this.errorSignal()?.message || '');
  forcesEnabled = computed(() => this.forcesEnabledSignal());
  tooltipPosition = computed(() => this.tooltipPositionSignal());

  // Safe HTML content
  safeTooltipContent = computed(() => {
    const content = this.tooltipContentSignal();
    if (!content) return null;
    return this.sanitizer.sanitize(SecurityContext.HTML, content);
  });

  // Private properties
  private svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<NetworkNode, NetworkLink> | null = null;
  private zoom: d3.ZoomBehavior<SVGElement, unknown> | null = null;
  private nodes: NetworkNode[] = [];
  private links: NetworkLink[] = [];
  private tooltipTimeouts: { show?: any; hide?: any } = {};
  private initialZoomApplied = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private dataService: NetworkDataService,
    private errorService: NetworkErrorService,
    private stateService: NetworkStateService
  ) {
    // Subscribe to errors
    this.errorService.errors$.subscribe(error => {
      this.errorSignal.set(error);
      this.error.emit(error);
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    try {
      this.isLoadingSignal.set(true);
      this.updateSignals();
    } catch (error) {
      this.handleError('rendering', 'Failed to initialize visualization', error as Error);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  ngAfterViewInit() {
    try {
      this.initializeVisualization();

      // Apply initial zoom configuration
      setTimeout(() => this.applyInitialZoom(), 100);

    } catch (error) {
      this.handleError('rendering', 'Failed to initialize visualization after view init', error as Error);
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.updateSignals();
    if (this.svg && (changes['data'] || changes['config'])) {
      this.safeUpdateVisualization();
    }
  }

  private updateSignals() {
    this.dataSignal.set(this.data);
    this.configSignal.set(this.config);
  }

  private safeUpdateVisualization() {
    try {
      this.isLoadingSignal.set(true);
      this.updateVisualization();
    } catch (error) {
      this.handleError('rendering', 'Failed to update visualization', error as Error);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  private initializeVisualization() {
    this.svg = d3.select(this.svgElement.nativeElement);
    this.setupZoom();
    this.updateVisualization();
  }

  private setupZoom() {
    if (!this.svg) return;

    const interactionConfig = this.getInteractionConfig();
    const zoomConfig = this.getZoomConfig();

    if (interactionConfig.enableZoom || interactionConfig.enablePan) {
      this.zoom = d3.zoom<SVGElement, unknown>()
        .scaleExtent([zoomConfig.minZoom || 0.1, zoomConfig.maxZoom || 10])
        .on('zoom', (event) => {
          const zoomGroup = this.svg!.select('.zoom-group');
          zoomGroup.attr('transform', event.transform);

          // Emit zoom change event
          this.zoomChanged.emit({
            scale: event.transform.k,
            translate: [event.transform.x, event.transform.y]
          });
        });

      this.svg.call(this.zoom);

      if (!interactionConfig.enableZoom) {
        this.svg.on('.zoom', null);
        this.svg.on('wheel.zoom', null);
      }

      if (!interactionConfig.enablePan) {
        this.svg.on('mousedown.zoom', null);
        this.svg.on('touchstart.zoom', null);
      }
    }
  }

  private applyInitialZoom() {
    if (!this.zoom || !this.svg || this.initialZoomApplied) return;

    const zoomConfig = this.getZoomConfig();
    const duration = zoomConfig.animationDuration || 750;

    try {
      switch (zoomConfig.zoomOnLoad) {
        case 'fit':
          this.fitToView();
          break;
        case 'center':
          this.centerView();
          break;
        case 'custom':
          if (zoomConfig.initialZoom && zoomConfig.initialPosition) {
            this.setZoom(zoomConfig.initialZoom, zoomConfig.initialPosition, duration);
          }
          break;
        case 'none':
        default:
          // Do nothing
          break;
      }

      this.initialZoomApplied = true;
    } catch (error) {
      console.warn('Failed to apply initial zoom:', error);
    }
  }

  private setZoom(scale: number, position: { x: number; y: number }, duration: number = 750) {
    if (!this.zoom || !this.svg) return;

    const transform = d3.zoomIdentity
      .translate(position.x, position.y)
      .scale(scale);

    if (duration > 0) {
      this.svg.transition()
        .duration(duration)
        .call(this.zoom.transform, transform);
    } else {
      this.svg.call(this.zoom.transform, transform);
    }
  }

  private centerView() {
    if (!this.zoom || !this.svg) return;

    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.setZoom(1, { x: centerX, y: centerY });
  }

  private updateVisualization() {
    if (!this.svg) return;

    this.prepareData();
    this.setupSimulation();
    this.renderLinks();
    this.renderNodes();
    this.renderLabels();
  }

  private prepareData() {
    this.nodes = [...this.data.nodes];
    this.links = this.data.links.map(link => ({
      ...link,
      source: typeof link.source === 'string' || typeof link.source === 'number'
        ? this.nodes.find(n => n.id === link.source) || link.source
        : link.source,
      target: typeof link.target === 'string' || typeof link.target === 'number'
        ? this.nodes.find(n => n.id === link.target) || link.target
        : link.target
    }));
  }

  private setupSimulation() {
    try {
      const forceConfig = this.getForceConfig();

      if (this.simulation) {
        this.simulation.stop();
      }

      if (!forceConfig.enabled) {
        return;
      }

      this.simulation = d3.forceSimulation<NetworkNode>(this.nodes)
        .force('link', d3.forceLink<NetworkNode, NetworkLink>(this.links)
          .id(d => d.id)
          .strength(forceConfig.linkStrength || 0.1)
          .distance(forceConfig.linkDistance || 30))
        .force('charge', d3.forceManyBody().strength(forceConfig.chargeStrength || -300))
        .force('center', d3.forceCenter(this.width / 2, this.height / 2).strength(forceConfig.centerStrength || 1))
        .force('collision', d3.forceCollide().radius(forceConfig.collideRadius || 20))
        .velocityDecay(forceConfig.velocityDecay || 0.4)
        .alphaDecay(forceConfig.alphaDecay || 0.0228);

      this.simulation.on('tick', () => {
        this.updatePositions();
      });

    } catch (error) {
      this.handleError('rendering', 'Failed to setup simulation', error as Error);
    }
  }

  private renderNodes() {
    if (!this.svg) return;

    try {
      const nodeStyles = this.getNodeStyleConfig();
      const interactionConfig = this.getInteractionConfig();

      const nodeGroup = this.svg.select('.nodes-group');

      const nodeSelection = nodeGroup.selectAll<SVGGElement, NetworkNode>('.node')
        .data(this.nodes, (d: NetworkNode) => d.id.toString());

      // Remove old nodes
      nodeSelection.exit().remove();

      // Add new nodes
      const nodeEnter = nodeSelection.enter()
        .append('g')
        .attr('class', 'node')
        .attr('aria-label', (d: NetworkNode) => `Node ${d.label || d.id}${d.group ? `, group ${d.group}` : ''}`);

      // Add shapes to new nodes
      nodeEnter.each(function(d: NetworkNode) {
        const shape = d.shape || nodeStyles.defaultShape || 'circle';
        const size = d.size || nodeStyles.defaultSize || 10;
        const element = d3.select(this);

        try {
          switch (shape) {
            case 'circle':
              element.append('circle').attr('r', size);
              break;
            case 'square':
              element.append('rect')
                .attr('width', size * 2)
                .attr('height', size * 2)
                .attr('x', -size)
                .attr('y', -size);
              break;
            case 'triangle':
              element.append('polygon')
                .attr('points', `0,${-size} ${size},${size} ${-size},${size}`);
              break;
            case 'diamond':
              element.append('polygon')
                .attr('points', `0,${-size} ${size},0 0,${size} ${-size},0`);
              break;
            case 'star':
              const starPoints = generateStarPoints(size);
              element.append('polygon').attr('points', starPoints);
              break;
            case 'hexagon':
              const hexPoints = generateHexagonPoints(size);
              element.append('polygon').attr('points', hexPoints);
              break;
          }
        } catch (error) {
          console.warn('Failed to create node shape:', shape, error);
          // Fallback to circle
          element.append('circle').attr('r', size);
        }
      });

      // Helper functions for complex shapes
      function generateStarPoints(size: number): string {
        const points: string[] = [];
        const outerRadius = size;
        const innerRadius = size * 0.4;

        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          points.push(`${x},${y}`);
        }

        return points.join(' ');
      }

      function generateHexagonPoints(size: number): string {
        const points: string[] = [];

        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = Math.cos(angle) * size;
          const y = Math.sin(angle) * size;
          points.push(`${x},${y}`);
        }

        return points.join(' ');
      }

      // Merge enter and update selections
      const nodeMerged:any = nodeEnter.merge(nodeSelection);

      // Apply styles
      nodeMerged.selectAll('circle, rect, polygon')
        .attr('fill', (d: NetworkNode) => this.getNodeColor(d))
        .attr('stroke', (d: NetworkNode) => d.borderColor || nodeStyles.defaultBorderColor || '#333')
        .attr('stroke-width', (d: NetworkNode) => d.borderWidth || nodeStyles.defaultBorderWidth || 2);

      // Add interactions with error handling
      this.addNodeInteractions(nodeMerged, interactionConfig);

    } catch (error) {
      this.handleError('rendering', 'Failed to render nodes', error as Error);
    }
  }

  private addNodeInteractions(nodeSelection: d3.Selection<SVGGElement, NetworkNode, SVGGElement, unknown>, interactionConfig: any) {
    try {
      if (interactionConfig.enableHover) {
        nodeSelection
          .on('mouseenter', (event: MouseEvent, d: NetworkNode) => {
            this.handleNodeHover(event, d, true);
          })
          .on('mouseleave', (event: MouseEvent, d: NetworkNode) => {
            this.handleNodeHover(event, d, false);
          });
      }

      if (interactionConfig.enableClick) {
        nodeSelection.on('click', (event: MouseEvent, d: NetworkNode) => {
          event.stopPropagation();
          this.nodeClick.emit({
            type: 'nodeClick',
            data: d,
            originalEvent: event,
            position: { x: event.clientX, y: event.clientY }
          });
        });
      }

      if (interactionConfig.enableRightClick) {
        nodeSelection.on('contextmenu', (event: MouseEvent, d: NetworkNode) => {
          event.preventDefault();
          this.nodeRightClick.emit({
            type: 'nodeRightClick',
            data: d,
            originalEvent: event,
            position: { x: event.clientX, y: event.clientY }
          });
        });
      }

      if (interactionConfig.enableDrag && this.simulation) {
        const dragHandler = d3.drag<SVGGElement, NetworkNode>()
          .on('start', (event, d:any) => {
            if (!event.active && this.simulation) {
              this.simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d:any) => {
            if (!event.active && this.simulation) {
              this.simulation.alphaTarget(0);
            }
            if (!event.sourceEvent.shiftKey) {
              d.fx = null;
              d.fy = null;
            }
          });

        nodeSelection.call(dragHandler);
      }
    } catch (error) {
      console.warn('Failed to add node interactions:', error);
    }
  }

  private renderLinks() {
    if (!this.svg) return;

    try {
      const linkStyles = this.getLinkStyleConfig();
      const interactionConfig = this.getInteractionConfig();

      const linkGroup = this.svg.select('.links-group');

      const linkSelection = linkGroup.selectAll<SVGLineElement, NetworkLink>('.link')
        .data(this.links);

      // Remove old links
      linkSelection.exit().remove();

      // Add new links
      const linkEnter = linkSelection.enter()
        .append('line')
        .attr('class', 'link')
        .attr('aria-label', (d: NetworkLink) => `Link from ${this.getNodeLabel(d.source)} to ${this.getNodeLabel(d.target)}`);

      // Merge enter and update selections
      const linkMerged = linkEnter.merge(linkSelection);

      // Apply styles
      linkMerged
        .attr('stroke', (d: NetworkLink) => d.color || linkStyles.defaultColor || '#999')
        .attr('stroke-width', (d: NetworkLink) => d.width || linkStyles.defaultWidth || 1);

      // Add interactions
      if (interactionConfig.enableHover) {
        linkMerged
          .on('mouseenter', (event: MouseEvent, d: NetworkLink) => {
            this.handleLinkHover(event, d, true);
          })
          .on('mouseleave', (event: MouseEvent, d: NetworkLink) => {
            this.handleLinkHover(event, d, false);
          });
      }

      if (interactionConfig.enableClick) {
        linkMerged.on('click', (event: MouseEvent, d: NetworkLink) => {
          event.stopPropagation();
          this.linkClick.emit({
            type: 'linkClick',
            data: d,
            originalEvent: event,
            position: { x: event.clientX, y: event.clientY }
          });
        });
      }
    } catch (error) {
      this.handleError('rendering', 'Failed to render links', error as Error);
    }
  }

  private renderLabels() {
    if (!this.svg) return;

    try {
      const labelConfig = this.getLabelConfig();
      if (!labelConfig.enabled) return;

      const labelGroup = this.svg.select('.labels-group');

      const labelSelection = labelGroup.selectAll<SVGTextElement, NetworkNode>('.node-label')
        .data(this.nodes, (d: NetworkNode) => d.id.toString());

      // Remove old labels
      labelSelection.exit().remove();

      // Add new labels
      const labelEnter = labelSelection.enter()
        .append('text')
        .attr('class', 'node-label')
        .attr('dy', '0.35em');

      // Merge enter and update selections
      const labelMerged = labelEnter.merge(labelSelection);

      // Apply label text and formatting
      labelMerged
        .text((d: NetworkNode) => this.formatNodeLabel(d))
        .attr('font-size', labelConfig.fontSize || 10)
        .attr('font-family', labelConfig.fontFamily || 'Arial, sans-serif')
        .attr('fill', labelConfig.color || '#333')
        .attr('text-anchor', 'middle');

    } catch (error) {
      this.handleError('rendering', 'Failed to render labels', error as Error);
    }
  }

  private updatePositions() {
    if (!this.svg) return;

    try {
      // Update node positions
      this.svg.selectAll<SVGGElement, NetworkNode>('.node')
        .attr('transform', (d: NetworkNode) => `translate(${d.x || 0},${d.y || 0})`);

      // Update link positions
      this.svg.selectAll<SVGLineElement, NetworkLink>('.link')
        .attr('x1', (d: NetworkLink) => (d.source as NetworkNode).x || 0)
        .attr('y1', (d: NetworkLink) => (d.source as NetworkNode).y || 0)
        .attr('x2', (d: NetworkLink) => (d.target as NetworkNode).x || 0)
        .attr('y2', (d: NetworkLink) => (d.target as NetworkNode).y || 0);

      // Update label positions
      this.svg.selectAll<SVGTextElement, NetworkNode>('.node-label')
        .attr('x', (d: NetworkNode) => (d.x || 0))
        .attr('y', (d: NetworkNode) => (d.y || 0) + 20);
    } catch (error) {
      console.warn('Error updating positions:', error);
    }
  }

  // Public API methods
  zoomIn() {
    try {
      if (this.zoom && this.svg) {
        this.svg.transition().call(this.zoom.scaleBy, 1.5);
      }
    } catch (error) {
      console.warn('Error zooming in:', error);
    }
  }

  zoomOut() {
    try {
      if (this.zoom && this.svg) {
        this.svg.transition().call(this.zoom.scaleBy, 1 / 1.5);
      }
    } catch (error) {
      console.warn('Error zooming out:', error);
    }
  }

  fitToView() {
    try {
      if (!this.svg || !this.zoom) return;

      const bounds = this.getBounds();
      if (!bounds) return;

      const fullWidth = this.width;
      const fullHeight = this.height;
      const { width, height } = bounds;
      const midX = bounds.x + width / 2;
      const midY = bounds.y + height / 2;

      if (width === 0 || height === 0) return;

      const scale = Math.min(fullWidth / width, fullHeight / height) * 0.9;
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

      this.svg.transition()
        .duration(750)
        .call(
          this.zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    } catch (error) {
      console.warn('Error fitting to view:', error);
    }
  }

  resetView() {
    try {
      if (this.zoom && this.svg) {
        this.svg.transition()
          .duration(750)
          .call(this.zoom.transform, d3.zoomIdentity);
      }
    } catch (error) {
      console.warn('Error resetting view:', error);
    }
  }

  toggleForces() {
    try {
      const currentState = this.forcesEnabledSignal();
      this.forcesEnabledSignal.set(!currentState);

      if (!currentState && this.simulation) {
        this.simulation.alpha(1).restart();
      } else if (this.simulation) {
        this.simulation.stop();
      }
    } catch (error) {
      console.warn('Error toggling forces:', error);
    }
  }

  onKeyDown(event: KeyboardEvent) {
    try {
      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          this.zoomIn();
          break;
        case '-':
          event.preventDefault();
          this.zoomOut();
          break;
        case '0':
          event.preventDefault();
          this.fitToView();
          break;
        case 'r':
          event.preventDefault();
          this.resetView();
          break;
        case ' ':
          event.preventDefault();
          this.toggleForces();
          break;
      }
    } catch (error) {
      console.warn('Error handling keyboard event:', error);
    }
  }

  clearError() {
    this.errorSignal.set(null);
    this.cdr.markForCheck();
  }

  // Advanced zoom configuration
  setInitialZoom(scale: number, position: { x: number; y: number }): void {
    const zoomConfig: ZoomConfig = {
      ...this.getZoomConfig(),
      initialZoom: scale,
      initialPosition: position,
      zoomOnLoad: 'custom'
    };

    this.updateConfig({
      zoomConfig
    });
  }

  getCurrentZoom(): { scale: number; translate: [number, number] } | null {
    if (!this.svg || !this.zoom) return null;

    const transform = d3.zoomTransform(this.svg.node()!);
    return {
      scale: transform.k,
      translate: [transform.x, transform.y]
    };
  }

  // Helper methods
  private handleNodeHover(event: MouseEvent, node: NetworkNode, isEntering: boolean) {
    try {
      // Clear existing timeouts
      Object.values(this.tooltipTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });

      if (isEntering) {
        const tooltipConfig = this.getTooltipConfig();
        const showDelay = tooltipConfig.showDelay || 0;

        this.tooltipTimeouts.show = setTimeout(() => {
          if (this.showTooltipComputed()) {
            const tooltipContent = this.generateTooltipContent(node);
            this.tooltipContentSignal.set(tooltipContent);
            this.tooltipPositionSignal.set({ x: event.pageX + 10, y: event.pageY - 10 });
          }
        }, showDelay);

        this.nodeHover.emit({
          type: 'nodeHover',
          data: { ...node, isEntering },
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      } else {
        const tooltipConfig = this.getTooltipConfig();
        const hideDelay = tooltipConfig.hideDelay || 0;

        this.tooltipTimeouts.hide = setTimeout(() => {
          this.tooltipContentSignal.set('');
        }, hideDelay);

        this.nodeHover.emit({
          type: 'nodeHover',
          data: { ...node, isEntering },
          originalEvent: event,
          position: { x: event.clientX, y: event.clientY }
        });
      }
    } catch (error) {
      console.warn('Error handling node hover:', error);
    }
  }

  private handleLinkHover(event: MouseEvent, link: NetworkLink, isEntering: boolean) {
    try {
      Object.values(this.tooltipTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });

      if (isEntering) {
        const tooltipConfig = this.getTooltipConfig();
        const showDelay = tooltipConfig.showDelay || 0;

        this.tooltipTimeouts.show = setTimeout(() => {
          if (this.showTooltipComputed()) {
            const tooltipContent = this.generateLinkTooltipContent(link);
            this.tooltipContentSignal.set(tooltipContent);
            this.tooltipPositionSignal.set({ x: event.pageX + 10, y: event.pageY - 10 });
          }
        }, showDelay);
      } else {
        const tooltipConfig = this.getTooltipConfig();
        const hideDelay = tooltipConfig.hideDelay || 0;

        this.tooltipTimeouts.hide = setTimeout(() => {
          this.tooltipContentSignal.set('');
        }, hideDelay);
      }

      this.linkHover.emit({
        type: 'linkHover',
        data: { ...link, isEntering },
        originalEvent: event,
        position: { x: event.clientX, y: event.clientY }
      });
    } catch (error) {
      console.warn('Error handling link hover:', error);
    }
  }

  private generateTooltipContent(node: NetworkNode): string {
    try {
      const tooltipConfig = this.getTooltipConfig();

      // Use custom template if provided
      if (tooltipConfig.customTemplate) {
        return tooltipConfig.customTemplate(node);
      }

      let content = '';

      if (tooltipConfig.showNodeLabel !== false && (node.label || tooltipConfig.showNodeId !== false)) {
        content += `<strong>${this.escapeHtml(node.label || node.id.toString())}</strong>`;
      } else if (tooltipConfig.showNodeId !== false) {
        content += `<strong>${this.escapeHtml(node.id.toString())}</strong>`;
      }

      if (tooltipConfig.showNodeGroup !== false && node.group) {
        content += `<br>Group: ${this.escapeHtml(node.group.toString())}`;
      }

      if (tooltipConfig.showNodeCategory !== false && node.category) {
        content += `<br>Category: ${this.escapeHtml(node.category)}`;
      }

      // Show custom fields
      if (tooltipConfig.showCustomFields) {
        tooltipConfig.showCustomFields.forEach(field => {
          if (node[field] !== undefined) {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            content += `<br>${this.escapeHtml(fieldName)}: ${this.escapeHtml(String(node[field]))}`;
          }
        });
      }

      return content || `Node ${this.escapeHtml(node.id.toString())}`;
    } catch (error) {
      console.warn('Error generating tooltip content:', error);
      return `Node ${node.id}`;
    }
  }

  private generateLinkTooltipContent(link: NetworkLink): string {
    try {
      const tooltipConfig = this.getTooltipConfig();

      if (tooltipConfig.customLinkTemplate) {
        return tooltipConfig.customLinkTemplate(link);
      }

      const source = this.getNodeLabel(link.source);
      const target = this.getNodeLabel(link.target);
      let content = `<strong>${this.escapeHtml(source)} → ${this.escapeHtml(target)}</strong>`;

      if (link.label) {
        content += `<br>${this.escapeHtml(link.label)}`;
      }

      return content;
    } catch (error) {
      console.warn('Error generating link tooltip content:', error);
      return 'Link';
    }
  }

  private formatNodeLabel(node: NetworkNode): string {
    try {
      const labelConfig = this.getLabelConfig();
      let labelValue: any;

      // Get the label value based on configuration
      if (typeof labelConfig.field === 'function') {
        labelValue = labelConfig.field(node);
      } else if (labelConfig.field && labelConfig.field !== 'id' && labelConfig.field !== 'label') {
        labelValue = node[labelConfig.field];
      } else if (labelConfig.field === 'id') {
        labelValue = node.id;
      } else {
        labelValue = node.label || node.id;
      }

      // Apply custom formatter if provided
      if (labelConfig.formatter) {
        labelValue = labelConfig.formatter(labelValue, node);
      }

      // Convert to string
      let labelText = String(labelValue || '');

      // Apply length restrictions
      if (labelConfig.maxLength && labelText.length > labelConfig.maxLength) {
        switch (labelConfig.truncateStyle) {
          case 'ellipsis':
            labelText = labelText.substring(0, labelConfig.maxLength - 3) + '...';
            break;
          case 'middle':
            const start = Math.floor((labelConfig.maxLength - 3) / 2);
            const end = Math.ceil((labelConfig.maxLength - 3) / 2);
            labelText = labelText.substring(0, start) + '...' + labelText.substring(labelText.length - end);
            break;
          case 'none':
          default:
            labelText = labelText.substring(0, labelConfig.maxLength);
            break;
        }
      }

      return labelText;
    } catch (error) {
      console.warn('Error formatting node label:', error);
      return String(node.label || node.id);
    }
  }

  private generateLegendData() {
    try {
      const legendConfig = this.getLegendConfig();

      if (legendConfig.customItems) {
        return legendConfig.customItems;
      }

      const data: any[] = [];
      const nodeStyles = this.getNodeStyleConfig();

      if (legendConfig.showGroupColors !== false && nodeStyles.groupColors) {
        Object.entries(nodeStyles.groupColors).forEach(([group, color]) => {
          data.push({
            label: `Group ${group}`,
            color,
            shape: 'circle',
            size: legendConfig.symbolSize || 12,
            visible: true
          });
        });
      }

      if (legendConfig.showCategoryColors !== false && nodeStyles.categoryStyles) {
        Object.entries(nodeStyles.categoryStyles).forEach(([category, style]) => {
          if (style.defaultColor) {
            data.push({
              label: category,
              color: style.defaultColor,
              shape: style.defaultShape || 'circle',
              size: legendConfig.symbolSize || 12,
              visible: true
            });
          }
        });
      }

      return data;
    } catch (error) {
      console.warn('Error generating legend data:', error);
      return [];
    }
  }

  private getNodeLabel(node: string | number | NetworkNode): string {
    if (typeof node === 'string' || typeof node === 'number') {
      return node.toString();
    }
    return node.label || node.id.toString();
  }

  getNodeColor(node: NetworkNode): string {
    try {
      const nodeStyles = this.getNodeStyleConfig();

      if (node.color) return node.color;
      if (node.fillColor) return node.fillColor;

      if (node.group && nodeStyles.groupColors) {
        const groupColor = nodeStyles.groupColors[node.group];
        if (groupColor) return groupColor;
      }

      if (node.category && nodeStyles.categoryStyles) {
        const categoryStyle = nodeStyles.categoryStyles[node.category];
        if (categoryStyle?.defaultColor) return categoryStyle.defaultColor;
      }

      if (nodeStyles.colorScheme && nodeStyles.colorScheme.length > 0) {
        const index = Math.abs(this.hash(node.id.toString())) % nodeStyles.colorScheme.length;
        return nodeStyles.colorScheme[index];
      }

      return nodeStyles.defaultColor || '#69b3a2';
    } catch (error) {
      console.warn('Error getting node color:', error);
      return '#69b3a2';
    }
  }

  private getBounds() {
    try {
      if (this.nodes.length === 0) return null;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      this.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        }
      });

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    } catch (error) {
      console.warn('Error getting bounds:', error);
      return null;
    }
  }

  // Configuration getters with defaults
  getLegendConfig() {
    const config = this.config.legendConfig || {};
    return {
      enabled: true,
      position: 'bottom-left',
      orientation: 'vertical',
      maxWidth: 200,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 4,
      padding: 10,
      fontSize: 12,
      symbolSize: 12,
      showGroupColors: true,
      showCategoryColors: true,
      ...config
    };
  }

  getTooltipConfig() {
    const config = this.config.tooltipConfig || {};
    return {
      enabled: true,
      showNodeLabel: true,
      showNodeGroup: true,
      showNodeCategory: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: 'white',
      fontSize: 12,
      maxWidth: 200,
      borderRadius: 4,
      padding: '8px 12px',
      showDelay: 0,
      hideDelay: 100,
      ...config
    };
  }

  private getLabelConfig() {
    const config = this.config.labelConfig || {};
    return {
      enabled: false,
      showFor: 'all',
      field: 'label',
      position: 'bottom',
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      color: '#333',
      truncateStyle: 'ellipsis',
      ...config
    };
  }

  private getInteractionConfig() {
    return {
      enableHover: true,
      enableClick: true,
      enableRightClick: true,
      enableDrag: true,
      enableZoom: true,
      enablePan: true,
      zoomExtent: [0.1, 10],
      ...this.config.interactionConfig
    };
  }

  private getZoomConfig(): ZoomConfig {
    return {
      initialZoom: 1,
      initialPosition: { x: 0, y: 0 },
      minZoom: 0.1,
      maxZoom: 10,
      zoomOnLoad: 'center',
      animationDuration: 750,
      smoothTransitions: true,
      ...this.config.zoomConfig
    };
  }

  private getForceConfig() {
    return {
      enabled: true,
      linkStrength: 0.1,
      linkDistance: 30,
      chargeStrength: -300,
      centerStrength: 1,
      collideRadius: 20,
      velocityDecay: 0.4,
      alphaDecay: 0.0228,
      ...this.config.forceConfig
    };
  }

  private getNodeStyleConfig() {
    return this.config.nodeStyles || {};
  }

  private getLinkStyleConfig() {
    return this.config.linkStyles || {};
  }

  private updateConfig(newConfig: Partial<NetworkVisualizationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  private deepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  private handleError(type: NetworkError['type'], message: string, originalError?: Error, context?: any) {
    const error = this.errorService.createError(type, message, originalError, context);
    this.errorService.handleError(error);
  }

  private handleDataError(message: string, errors: string[]) {
    this.handleError('data', `${message}: ${errors.join(', ')}`);
  }

  private cleanup() {
    try {
      // Stop simulation
      if (this.simulation) {
        this.simulation.stop();
        this.simulation = null;
      }

      // Remove all D3 event listeners
      if (this.svg) {
        this.svg.selectAll('*')
          .on('.zoom', null)
          .on('.drag', null)
          .on('click', null)
          .on('mouseenter', null)
          .on('mouseleave', null)
          .on('contextmenu', null);

        this.svg = null;
      }

      // Clear zoom behavior
      this.zoom = null;

      // Clear timeouts
      Object.values(this.tooltipTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      this.tooltipTimeouts = {};

    } catch (error) {
      console.error('Error during component destruction:', error);
    }
  }

  trackLegendItem(index: number, item: any): any {
    return item.label + item.color;
  }
}
