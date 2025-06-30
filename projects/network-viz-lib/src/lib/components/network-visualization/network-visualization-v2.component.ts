// projects/network-viz-lib/src/lib/components/network-visualization/network-visualization-v2.component.ts
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

    /* D3 node and link styles */
    :host ::ng-deep .node {
      cursor: pointer;
      stroke-width: 2px;
    }

    :host ::ng-deep .node:hover {
      stroke-width: 3px;
    }

    :host ::ng-deep .link {
      stroke: #999;
      stroke-opacity: 0.6;
    }

    :host ::ng-deep .node.highlighted {
      stroke: #ff6b35;
      stroke-width: 3px;
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

  constructor(
    private stateService: NetworkStateService,
    private dataService: NetworkDataService,
    private errorService: NetworkErrorService,
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
    if ((changes['width'] || changes['height']) && !changes['width']?.firstChange) {
      this.handleResize();
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

  // Add shapes to nodes
  nodeEnter.each((d: any, i: number, nodeElements: any[]) => {
    const nodeData = d as NetworkNode;
    const element = d3.select(nodeElements[i]);
    const shape = nodeData.shape || this.config.nodeStyles?.defaultShape || 'circle';
    const size = nodeData.size || this.config.nodeStyles?.defaultSize || 10;

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
      default:
        element.append('circle').attr('r', size);
    }
  });

  // Merge enter and update selections
  const nodeMerge = nodeEnter.merge(nodeSelection);

  // Apply styles and interactions
  this.applyNodeStyles(nodeMerge);
  this.addNodeInteractions(nodeMerge);

  if (this.config.interactionConfig?.enableDrag !== false) {
    this.setupNodeDrag(nodeMerge);
  }
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
    .attr('class', 'link');

  // Merge and apply styles
  const linkMerge = linkEnter.merge(linkSelection);
  this.applyLinkStyles(linkMerge);
  this.addLinkInteractions(linkMerge);
}

// Fixed render method
private render(): void {
  try {
    // Validate and sanitize data first
    const cleanData = this.validateAndSanitizeData(this.data);

    // Setup force simulation with clean data - this modifies the data objects
    this.setupSimulation(cleanData);

    // Render with the SAME data objects that simulation is using
    this.renderLinks(cleanData.links);
    this.renderNodes(cleanData.nodes);

    // Generate legend items
    this.generateLegendItems(cleanData);

    // Apply initial zoom if configured
    this.applyInitialZoom();

  } catch (error) {
    this.handleError(error);
  }
}

  private applyNodeStyles(nodeSelection: D3Selection): void {
    nodeSelection.selectAll('circle, rect')
      .attr('fill', (d: any) => {
        const nodeData = d as NetworkNode;
        if (nodeData.color) return nodeData.color;
        if (nodeData.group && this.config.nodeStyles?.groupColors?.[nodeData.group]) {
          return this.config.nodeStyles.groupColors[nodeData.group];
        }
        return this.config.nodeStyles?.defaultColor || '#69b3a2';
      })
      .attr('stroke', (d: any) => {
        const nodeData = d as NetworkNode;
        return nodeData.borderColor || this.config.nodeStyles?.defaultBorderColor || '#ffffff';
      })
      .attr('stroke-width', (d: any) => {
        const nodeData = d as NetworkNode;
        return nodeData.borderWidth || this.config.nodeStyles?.defaultBorderWidth || 2;
      });
  }

  private applyLinkStyles(linkSelection: D3Selection): void {
    linkSelection
      .attr('stroke', (d: any) => {
        const linkData = d as NetworkLink;
        return linkData.color || this.config.linkStyles?.defaultColor || '#999999';
      })
      .attr('stroke-width', (d: any) => {
        const linkData = d as NetworkLink;
        return linkData.width || this.config.linkStyles?.defaultWidth || 1;
      })
      .attr('stroke-dasharray', (d: any) => {
        const linkData = d as NetworkLink;
        const style = linkData.style || this.config.linkStyles?.defaultStyle || 'solid';
        switch (style) {
          case 'dashed': return '5,5';
          case 'dotted': return '2,3';
          default: return 'none';
        }
      });
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
  // Update node positions - now reading from simulation-modified objects
  this.g.selectAll('.node')
    .attr('transform', (d: any) => {
      const nodeData = d as NetworkNode;
      // These x,y values are now updated by the simulation
      return `translate(${nodeData.x || 0},${nodeData.y || 0})`;
    });

  // Update link positions - now reading from simulation-modified objects
  this.g.selectAll('.link')
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
      const target:any = linkData.target as NetworkLink;
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
  // Ensure all nodes have valid IDs
  const validNodes = data.nodes.filter(node =>
    node.id !== null &&
    node.id !== undefined &&
    node.id !== ''
  );

  if (validNodes.length !== data.nodes.length) {
    console.warn(`Removed ${data.nodes.length - validNodes.length} invalid nodes`);
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
      console.warn(`Link references invalid source node: ${sourceId}`);
    }
    if (!hasValidTarget) {
      console.warn(`Link references invalid target node: ${targetId}`);
    }

    return hasValidSource && hasValidTarget;
  }).map(link => ({
    ...link,
    // Normalize source and target to string IDs
    source: (typeof link.source === 'object' ? link.source.id : link.source).toString(),
    target: (typeof link.target === 'object' ? link.target.id : link.target).toString()
  }));

  if (validLinks.length !== data.links.length) {
    console.warn(`Removed ${data.links.length - validLinks.length} invalid links`);
  }

  console.log(`Data validation complete: ${validNodes.length} nodes, ${validLinks.length} links`);

  return {
    nodes: validNodes,
    links: validLinks
  };
}
// Add these properties to store simulation data references
private simulationNodes: NetworkNode[] = [];
private simulationLinks: NetworkLink[] = [];

private setupSimulation(data: NetworkData): void {
  try {
    // Stop existing simulation
    if (this.simulation) {
      this.simulation.stop();
    }

    if (!data.nodes || data.nodes.length === 0) {
      console.warn('No nodes to simulate');
      return;
    }

    // DON'T create copies - work directly with the data objects
    // D3 will modify these objects by adding x, y, vx, vy properties
    const nodes = data.nodes;
    const links = data.links;

    // Ensure all node IDs are strings for consistency
    nodes.forEach(node => {
      node.id = node.id.toString();
      // Initialize positions if not present
      if (node.x === undefined) node.x = Math.random() * this.width;
      if (node.y === undefined) node.y = Math.random() * this.height;
    });

    // Create node ID set for validation
    const nodeIds = new Set(nodes.map(n => n.id));

    // Validate and prepare links
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

    // Create simulation with the SAME node objects that will be used in rendering
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks)
        .id((d: any) => d.id)
        .distance(this.config.forceConfig?.linkDistance || 50)
        .strength(this.config.forceConfig?.linkStrength || 0.1)
      )
      .force('charge', d3.forceManyBody()
        .strength(this.config.forceConfig?.chargeStrength || -300)
      )
      .force('center', d3.forceCenter(this.width / 2, this.height / 2)
        .strength(this.config.forceConfig?.centerStrength || 1)
      )
      .force('collision', d3.forceCollide()
        .radius((d: any) => (d.size || 10) + 5)
        .strength(0.7)
      )
      .velocityDecay(this.config.forceConfig?.velocityDecay || 0.4)
      .alphaDecay(this.config.forceConfig?.alphaDecay || 0.0228);

    // Store references to the data being used by simulation
    this.simulationNodes = nodes;
    this.simulationLinks = validLinks;

    // Handle tick events - this updates positions
    this.simulation.on('tick', () => {
      this.updatePositions();
    });

    // Handle simulation end
    this.simulation.on('end', () => {
      console.log('Simulation ended');
    });

    console.log('✅ Simulation created successfully');

  } catch (error) {
    console.error('❌ Simulation creation failed:', error);
    this.handleError(error);
  }
}


// Update the initializeVisualization method to include better validation
private initializeVisualization(): void {
  try {
    this.isLoadingSignal.set(true);

    // Basic validation
    if (!this.data || !this.data.nodes || !this.data.links) {
      throw new Error('Invalid data structure: nodes and links arrays are required');
    }

    // Validate data structure
    const validation = this.dataService.validateNetworkData(this.data);
    if (!validation.isValid) {
      console.warn('Data validation warnings:', validation.warnings);
      // Don't throw error for warnings, just log them
      if (validation.errors.length > 0) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Update signals with original data count
    this.nodeCountSignal.set(this.data.nodes.length);
    this.linkCountSignal.set(this.data.links.length);

    // Initialize D3 SVG
    this.setupSVG();
    this.setupZoom();
    this.render();

    this.isLoadingSignal.set(false);
    console.log('✅ Visualization initialized successfully');

  } catch (error) {
    this.isLoadingSignal.set(false);
    this.handleError(error);
  }
}
}
