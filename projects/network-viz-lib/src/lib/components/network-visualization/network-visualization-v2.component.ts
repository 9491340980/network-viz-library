import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import * as d3 from 'd3';

import { NetworkData, NetworkConfig, NetworkEvent, NetworkNode, NetworkLink } from '../../interfaces/network-visualization.interfaces';
import { NetworkStateService } from '../../services/network-state.service';
import { D3AbstractionService } from '../../services/d3-abstraction.service';
import { NetworkConfigBuilderService } from '../../services/network-config-builder.service';

@Component({
  selector: 'nvl-network-visualization-v2',
  template: `
    <div class="network-visualization-container" [style.width.px]="width" [style.height.px]="height">
      <svg #svgElement
           [attr.width]="width"
           [attr.height]="height"
           class="network-svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
        </defs>
        <g class="network-container">
          <g class="links-group"></g>
          <g class="nodes-group"></g>
          <g class="labels-group"></g>
        </g>
      </svg>

      <div class="network-overlay">
        <!-- Tooltip -->
        <div #tooltip class="network-tooltip" [style.display]="'none'">
          <div class="tooltip-content"></div>
        </div>

        <!-- Controls -->
        <div class="network-controls" *ngIf="showControls">
          <button (click)="zoomIn()" title="Zoom In">+</button>
          <button (click)="zoomOut()" title="Zoom Out">-</button>
          <button (click)="resetZoom()" title="Reset View">⌂</button>
          <button (click)="toggleSimulation()" title="Toggle Animation">
            {{ isSimulationRunning ? '⏸' : '▶' }}
          </button>
        </div>

        <!-- Legend -->
        <div class="network-legend" *ngIf="showLegend && legendItems.length > 0"
             [class]="'legend-' + (config.legend?.position || 'top-right')">
          <div class="legend-title">Legend</div>
          <div class="legend-item" *ngFor="let item of legendItems">
            <span class="legend-color" [style.background-color]="item.color"></span>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>

        <!-- Loading -->
        <div class="network-loading" *ngIf="loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading network...</div>
        </div>

        <!-- Error -->
        <div class="network-error" *ngIf="error">
          <div class="error-icon">⚠</div>
          <div class="error-message">{{ error }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .network-visualization-container {
      position: relative;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
    }

    .network-svg {
      display: block;
    }

    .network-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
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
    }

    .network-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      pointer-events: auto;
    }

    .network-controls button {
      width: 32px;
      height: 32px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .network-controls button:hover {
      background: #f0f0f0;
    }

    .network-legend {
      position: absolute;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      font-size: 12px;
      pointer-events: auto;
      min-width: 120px;
    }

    .legend-top-right { top: 10px; right: 60px; }
    .legend-top-left { top: 10px; left: 10px; }
    .legend-bottom-right { bottom: 10px; right: 10px; }
    .legend-bottom-left { bottom: 10px; left: 10px; }

    .legend-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #333;
    }

    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 3px;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .legend-label {
      color: #555;
    }

    .network-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #666;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .network-error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #e74c3c;
    }

    .error-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }

    /* Node and link styles */
    .network-svg .node {
      cursor: pointer;
      stroke: #fff;
      stroke-width: 2px;
    }

    .network-svg .node:hover {
      stroke-width: 3px;
    }

    .network-svg .link {
      stroke: #999;
      stroke-opacity: 0.6;
    }

    .network-svg .node-label {
      font-size: 11px;
      font-family: Arial, sans-serif;
      text-anchor: middle;
      pointer-events: none;
      user-select: none;
    }

    /* Theme variations */
    .network-visualization-container.dark {
      background: #2c3e50;
      border-color: #34495e;
    }

    .network-visualization-container.dark .network-svg .link {
      stroke: #7f8c8d;
    }

    .network-visualization-container.dark .network-svg .node-label {
      fill: #ecf0f1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkVisualizationV2Component implements OnInit, AfterViewInit, OnDestroy {
public legendItems: LegendItem[] = []
  @Input() data: NetworkData = { nodes: [], links: [] };
  @Input() config: NetworkConfig = {};
  @Input() width: number = 800;
  @Input() height: number = 600;
  @Input() showControls: boolean = true;
  @Input() showLegend: boolean = true;
  @Input() showTooltip: boolean = true;

  @Output() nodeClick = new EventEmitter<NetworkEvent>();
  @Output() nodeHover = new EventEmitter<NetworkEvent>();
  @Output() linkClick = new EventEmitter<NetworkEvent>();
  @Output() backgroundClick = new EventEmitter<NetworkEvent>();

 @ViewChild('svgElement', { static: true }) svgElement!: ElementRef<SVGSVGElement>;
  @ViewChild('tooltip', { static: true }) tooltipElement!: ElementRef<HTMLDivElement>;

  public loading = false;
  public error: string | null = null;
  public isSimulationRunning = true;

  private destroy$ = new Subject<void>();
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private simulation: d3.Simulation<NetworkNode, NetworkLink> | null = null;
  private colorScale: d3.ScaleOrdinal<string, string> | null = null;

  constructor(
    private networkState: NetworkStateService,
    private d3Service: D3AbstractionService,
    private configBuilder: NetworkConfigBuilderService
  ) {}

  ngOnInit(): void {
    // Subscribe to state changes
    this.networkState.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.data = data;
        this.updateVisualization();
      });

    this.networkState.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(config => {
        this.config = { ...this.config, ...config };
        this.updateVisualization();
      });

    this.networkState.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);

    this.networkState.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => this.error = error);
  }

  ngAfterViewInit(): void {
    this.initializeVisualization();
    this.updateVisualization();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  private initializeVisualization(): void {
    this.svg = d3.select(this.svgElement.nativeElement);

    // Setup zoom behavior
    this.zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 10])
  .on('zoom', (event) => {
    const { transform } = event;
    this.svg?.select('.network-container')
      .attr('transform', transform.toString());
  });
    this.svg.call(this.zoom);

    // Create color scale
    const groups:any = [...new Set(this.data.nodes.map(n => n.group).filter(Boolean))];
    this.colorScale = this.d3Service.createColorScale(groups);

    // Generate legend items
    this.generateLegendItems();
  }

  private updateVisualization(): void {
    if (!this.svg || !this.data.nodes.length) return;

    this.cleanup();
    this.createSimulation();
    this.renderNodes();
    this.renderLinks();
    this.renderLabels();
  }

  private createSimulation(): void {
    this.simulation = this.d3Service.createSimulation(this.data, {
      ...this.config,
      width: this.width,
      height: this.height
    });

    this.simulation.on('tick', () => this.onTick());
  }

  private renderNodes(): void {
    if (!this.svg) return;

    const nodeGroup = this.svg.select('.nodes-group');

    const nodes = nodeGroup
     .selectAll<SVGCircleElement, NetworkNode>('.node')
     .data(this.data.nodes, (d: NetworkNode) => d.id.toString());

    // Remove old nodes
    nodes.exit().remove();

    // Add new nodes
    const nodeEnter = nodes
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', (d: any) => d.size || this.config.nodeRadius || 5)
      .attr('fill', (d: any) => d.color || this.getNodeColor(d))
      .call(this.createDragBehavior());

    // Setup event handlers
    nodeEnter
      .on('click', (event, d) => {
        event.stopPropagation();
        this.nodeClick.emit({ type: 'nodeClick', data: d, event });
      })
      .on('mouseover', (event, d) => {
        if (this.showTooltip) {
          this.showNodeTooltip(event, d);
        }
        this.nodeHover.emit({ type: 'nodeHover', data: d, event });
      })
      .on('mouseout', () => {
        if (this.showTooltip) {
          this.hideTooltip();
        }
      });

    // Merge enter and update selections
    const nodeUpdate = nodeEnter.merge(nodes as any);

    nodeUpdate
      .attr('r', (d: any) => d.size || this.config.nodeRadius || 5)
      .attr('fill', (d: any) => d.color || this.getNodeColor(d));
  }

  private renderLinks(): void {
    if (!this.svg) return;

    const linkGroup = this.svg.select('.links-group');

    const links = linkGroup
      .selectAll('.link')
      .data(this.data.links);

    // Remove old links
    links.exit().remove();

    // Add new links
    const linkEnter = links
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke-width', (d: any) => d.width || this.config.linkWidth || 1)
      .attr('stroke', (d: any) => d.color || '#999');

    // Setup event handlers
    linkEnter
      .on('click', (event, d) => {
        event.stopPropagation();
        this.linkClick.emit({ type: 'linkClick', data: d, event });
      });

    // Merge enter and update selections
    const linkUpdate = linkEnter.merge(links as any);

    linkUpdate
      .attr('stroke-width', (d: any) => d.width || this.config.linkWidth || 1)
      .attr('stroke', (d: any) => d.color || '#999');
  }

  private renderLabels(): void {
    if (!this.svg) return;

    const labelGroup = this.svg.select('.labels-group');

    const labels = labelGroup
      .selectAll('.node-label')
      .data(this.data.nodes.filter(n => n.label), (d: any) => d.id);

    // Remove old labels
    labels.exit().remove();

    // Add new labels
    const labelEnter = labels
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', '.35em')
      .text((d: any) => d.label);

    // Merge enter and update selections
    const labelUpdate = labelEnter.merge(labels as any);

    labelUpdate.text((d: any) => d.label);
  }

  private onTick(): void {
    if (!this.svg) return;

    // Update node positions
    this.svg.selectAll('.node')
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y);

    // Update link positions
    this.svg.selectAll('.link')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    // Update label positions
    this.svg.selectAll('.node-label')
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y + ((d.size || 5) + 15));
  }

    private createDragBehavior() {
  return d3.drag<SVGCircleElement, NetworkNode>()
    .on('start', (event: any, d: NetworkNode) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d: any) => {
        if (!event.active && this.simulation) {
          this.simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });
  }

  private getNodeColor(node: NetworkNode): string {
    if (node.color) return node.color;
    if (this.colorScale && node.group) {
      return this.colorScale(node.group.toString());
    }
    return '#69b3a2';
  }

  private showNodeTooltip(event: MouseEvent, node: NetworkNode): void {
    const tooltip = this.tooltipElement.nativeElement;
    const content = tooltip.querySelector('.tooltip-content');

    if (content) {
      if (this.config.tooltip?.template) {
        content.innerHTML = this.config.tooltip.template(node);
      } else {
        content.innerHTML = `
          <div><strong>${node.label || node.id}</strong></div>
          ${node.group ? `<div>Group: ${node.group}</div>` : ''}
          ${node.size ? `<div>Size: ${node.size}</div>` : ''}
        `;
      }
    }

    tooltip.style.display = 'block';
    tooltip.style.left = `${event.offsetX + 10}px`;
    tooltip.style.top = `${event.offsetY - 10}px`;
  }

  private hideTooltip(): void {
    this.tooltipElement.nativeElement.style.display = 'none';
  }

  private generateLegendItems(): void {
    if (!this.colorScale) return;

    const groups = [...new Set(this.data.nodes.map(n => n.group).filter(Boolean))];
    this.legendItems = groups.map((group:any) => ({
      label: group,
      color: this.colorScale!(group.toString())
    }));
  }

  private cleanup(): void {
    if (this.simulation) {
      this.simulation.stop();
    }

    if (this.svg) {
      this.svg.selectAll('.node').remove();
      this.svg.selectAll('.link').remove();
      this.svg.selectAll('.node-label').remove();
    }
  }

  // Public methods for controls
  zoomIn(): void {
    if (this.svg && this.zoom) {
      this.svg.transition().call(
        this.zoom.scaleBy as any, 1.5
      );
    }
  }

  zoomOut(): void {
    if (this.svg && this.zoom) {
      this.svg.transition().call(
        this.zoom.scaleBy as any, 1 / 1.5
      );
    }
  }

  resetZoom(): void {
    if (this.svg && this.zoom) {
      this.svg.transition().call(
        this.zoom.transform as any,
        d3.zoomIdentity
      );
    }
  }

  toggleSimulation(): void {
    if (this.simulation) {
      if (this.isSimulationRunning) {
        this.simulation.stop();
        this.isSimulationRunning = false;
      } else {
        this.simulation.restart();
        this.isSimulationRunning = true;
      }
    }
  }

  // Public API methods
  updateData(newData: NetworkData): void {
    this.data = newData;
    this.updateVisualization();
  }

  updateConfig(newConfig: NetworkConfig): void {
    this.config = { ...this.config, ...newConfig };
    this.updateVisualization();
  }

  exportSVG(): string {
    return this.svgElement.nativeElement.outerHTML;
  }

  exportPNG(): Promise<Blob> {
    return new Promise((resolve) => {
      const svgData = this.exportSVG();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      canvas.width = this.width;
      canvas.height = this.height;

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob!));
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    });
  }
}
interface LegendItem {
  label: string;
  color: string;
}
