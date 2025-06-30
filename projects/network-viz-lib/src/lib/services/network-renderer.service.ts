import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, merge } from 'rxjs';
import { takeUntil, debounceTime, filter } from 'rxjs/operators';
import * as d3 from 'd3';
import {
  NetworkNode,
  NetworkLink,
  NetworkVisualizationConfig,
  NetworkEvent,
  NodeStyleConfig,
  LinkStyleConfig,
  InteractionConfig,
  ForceConfig,
  LabelConfig
} from '../interfaces/network-visualization.interfaces';
import { D3AbstractionService, D3Selection, RenderContext, D3Simulation } from './d3-abstraction.service';
import { NetworkStateService } from './network-state.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkRendererService {
  private destroy$ = new Subject<void>();
  private renderEvents$ = new Subject<NetworkEvent>();
  private currentSvg: D3Selection | null = null;
  private simulation: D3Simulation | null = null;
  private zoomBehavior: any = null;
  private renderContext: RenderContext | null = null;

  constructor(
    private d3Service: D3AbstractionService,
    private stateService: NetworkStateService
  ) {}

  /**
   * Rendering events observable
   */
  get events(): Observable<NetworkEvent> {
    return this.renderEvents$.asObservable();
  }

  /**
   * Initialize the visualization
   */
  initialize(svg: SVGElement, width: number, height: number, config?: NetworkVisualizationConfig): void {
    this.cleanup();

    this.currentSvg = this.d3Service.createSvgSelection(svg);
    this.d3Service.initializeSvg(this.currentSvg, width, height);

    // Set up zoom behavior if enabled
    if (config?.interactionConfig?.enableZoom !== false) {
      this.setupZoomBehavior(width, height, config?.zoomConfig);
    }

    // Set up interaction handlers
    if (config?.interactionConfig) {
      this.setupInteractions(config.interactionConfig);
    }

    // Subscribe to state changes
    this.subscribeToStateChanges();
  }

  /**
   * Render the complete visualization
   */
  render(
    nodes: NetworkNode[],
    links: NetworkLink[],
    config: NetworkVisualizationConfig,
    width: number,
    height: number
  ): void {
    if (!this.currentSvg) {
      throw new Error('Renderer not initialized');
    }

    this.renderContext = {
      svg: this.currentSvg,
      width,
      height,
      nodes: [...nodes],
      links: [...links]
    };

    // Render links first (behind nodes)
    this.renderLinks(links, config.linkStyles || {});

    // Render nodes
    this.renderNodes(nodes, config.nodeStyles || {});

    // Render labels if enabled
    if (config.labelConfig?.enabled) {
      this.renderLabels(nodes, config.labelConfig);
    }

    // Set up or update force simulation
    if (config.forceConfig?.enabled !== false) {
      this.setupForceSimulation(nodes, links, config.forceConfig || {}, width, height);
    }

    // Apply initial zoom if configured
    if (config.zoomConfig?.zoomOnLoad) {
      this.applyInitialZoom(config.zoomConfig, width, height);
    }
  }

  /**
   * Update node positions (called during simulation ticks)
   */
  updatePositions(): void {
    if (!this.currentSvg || !this.renderContext) return;

    // Update node positions with proper typing
    this.currentSvg.selectAll<SVGGElement, NetworkNode>('.node')
      .attr('transform', (d: NetworkNode) => `translate(${d.x || 0},${d.y || 0})`);

    // Update link positions with proper typing
    this.currentSvg.selectAll<SVGLineElement, NetworkLink>('.link')
      .attr('x1', (d: NetworkLink) => ((d.source as NetworkNode).x || 0).toString())
      .attr('y1', (d: NetworkLink) => ((d.source as NetworkNode).y || 0).toString())
      .attr('x2', (d: NetworkLink) => ((d.target as NetworkNode).x || 0).toString())
      .attr('y2', (d: NetworkLink) => ((d.target as NetworkNode).y || 0).toString());

    // Update label positions if they exist
    this.currentSvg.selectAll<SVGTextElement, NetworkNode>('.node-label')
      .attr('x', (d: NetworkNode) => (d.x || 0).toString())
      .attr('y', (d: NetworkNode) => ((d.y || 0) + 4).toString());
  }

  /**
   * Highlight specific nodes
   */
  highlightNodes(nodeIds: (string | number)[], highlightStyle?: any): void {
    if (!this.currentSvg) return;

    // Remove existing highlights
    this.currentSvg.selectAll<SVGGElement, NetworkNode>('.node').classed('highlighted', false);

    // Apply highlights with proper typing
    this.currentSvg.selectAll<SVGGElement, NetworkNode>('.node')
      .filter((d: NetworkNode) => nodeIds.includes(d.id))
      .classed('highlighted', true);
  }

  /**
   * Filter visualization by criteria
   */
  filterVisualization(criteria: {
    nodeFilter?: (node: NetworkNode) => boolean;
    linkFilter?: (link: NetworkLink) => boolean;
  }): void {
    if (!this.currentSvg) return;

    // Filter nodes with proper typing
    if (criteria.nodeFilter) {
      this.currentSvg.selectAll<SVGGElement, NetworkNode>('.node')
        .style('opacity', (d: NetworkNode) => criteria.nodeFilter!(d) ? '1' : '0.1')
        .style('pointer-events', (d: NetworkNode) => criteria.nodeFilter!(d) ? 'all' : 'none');
    }

    // Filter links with proper typing
    if (criteria.linkFilter) {
      this.currentSvg.selectAll<SVGLineElement, NetworkLink>('.link')
        .style('opacity', (d: NetworkLink) => criteria.linkFilter!(d) ? '1' : '0.1');
    }
  }

  /**
   * Zoom to fit all nodes in view
   */
  zoomToFit(padding = 50, duration = 750): void {
    if (!this.currentSvg || !this.renderContext || !this.zoomBehavior) return;

    const bounds = this.d3Service.calculateBounds(this.renderContext.nodes);
    if (!bounds) return;

    const transform = this.d3Service.calculateFitTransform(
      bounds,
      { width: this.renderContext.width, height: this.renderContext.height },
      padding
    );

    const zoomTransform = d3.zoomIdentity
      .translate(transform.x, transform.y)
      .scale(transform.k);

    this.currentSvg
      .transition()
      .duration(duration)
      .call(this.zoomBehavior.transform, zoomTransform);
  }

  /**
   * Reset zoom to default state
   */
  resetZoom(duration = 750): void {
    if (!this.currentSvg || !this.zoomBehavior) return;

    this.currentSvg
      .transition()
      .duration(duration)
      .call(this.zoomBehavior.transform, d3.zoomIdentity);
  }

  /**
   * Get node at specific position
   */
  getNodeAtPosition(x: number, y: number): NetworkNode | null {
    if (!this.renderContext) return null;

    return this.renderContext.nodes.find(node => {
      if (!node.x || !node.y) return false;
      const size = node.size || 10;
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= size / 2;
    }) || null;
  }

  /**
   * Export visualization as SVG
   */
  exportAsSVG(): string {
    if (!this.currentSvg) return '';

    const svgNode = this.currentSvg.node();
    if (!svgNode) return '';

    return new XMLSerializer().serializeToString(svgNode);
  }

  /**
   * Cleanup and destroy the renderer
   */
  destroy(): void {
    this.cleanup();
    this.destroy$.next();
    this.destroy$.complete();
    this.renderEvents$.complete();
  }

  private renderNodes(nodes: NetworkNode[], nodeStyles: NodeStyleConfig): void {
    if (!this.currentSvg) return;

    const nodeGroup = this.currentSvg.select('.nodes-group');

    // Data binding with proper typing
    const nodeSelection = nodeGroup.selectAll<SVGGElement, NetworkNode>('.node')
      .data(nodes, (d: NetworkNode) => d.id.toString());

    // Remove old nodes
    nodeSelection.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();

    // Add new nodes
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .style('opacity', 0);

    // Add node shapes
    nodeEnter.append('path')
      .attr('class', 'node-shape');

    // Merge enter and update selections
    const nodeMerge = nodeEnter.merge(nodeSelection);

    // Apply styles
    nodeMerge
      .transition()
      .duration(300)
      .style('opacity', 1);

    nodeMerge.select<SVGPathElement>('.node-shape')
      .attr('d', (d: NetworkNode) => {
        const shape = d.shape || nodeStyles.defaultShape || 'circle';
        const size = d.size || nodeStyles.defaultSize || 10;
        return this.d3Service.generateNodePath(shape, size);
      })
      .attr('fill', (d: NetworkNode) => {
        if (d.color) return d.color;
        if (d.group && nodeStyles.groupColors?.[d.group]) {
          return nodeStyles.groupColors[d.group];
        }
        return nodeStyles.defaultColor || '#69b3a2';
      })
      .attr('stroke', (d: NetworkNode) =>
        d.borderColor || nodeStyles.defaultBorderColor || '#ffffff'
      )
      .attr('stroke-width', (d: NetworkNode) =>
        (d.borderWidth || nodeStyles.defaultBorderWidth || 2).toString()
      );

    // Set up node interactions
    this.setupNodeInteractions(nodeMerge);
  }

  private renderLinks(links: NetworkLink[], linkStyles: LinkStyleConfig): void {
    if (!this.currentSvg) return;

    const linkGroup = this.currentSvg.select('.links-group');

    // Data binding with proper typing
    const linkSelection = linkGroup.selectAll<SVGLineElement, NetworkLink>('.link')
      .data(links);

    // Remove old links
    linkSelection.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();

    // Add new links
    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .style('opacity', 0);

    // Merge enter and update selections
    const linkMerge = linkEnter.merge(linkSelection);

    // Apply styles
    linkMerge
      .transition()
      .duration(300)
      .style('opacity', 1)
      .attr('stroke', (d: NetworkLink) =>
        d.color || linkStyles.defaultColor || '#999999'
      )
      .attr('stroke-width', (d: NetworkLink) =>
        (d.width || linkStyles.defaultWidth || 1).toString()
      )
      .attr('stroke-dasharray', (d: NetworkLink) => {
        const style = d.style || linkStyles.defaultStyle || 'solid';
        switch (style) {
          case 'dashed': return '5,5';
          case 'dotted': return '2,3';
          default: return 'none';
        }
      });

    // Set up link interactions
    this.setupLinkInteractions(linkMerge);
  }

  private renderLabels(nodes: NetworkNode[], labelConfig: LabelConfig): void {
    if (!this.currentSvg) return;

    const labelGroup = this.currentSvg.select('.labels-group');

    // Data binding with proper typing
    const labelSelection = labelGroup.selectAll<SVGTextElement, NetworkNode>('.node-label')
      .data(nodes, (d: NetworkNode) => d.id.toString());

    // Remove old labels
    labelSelection.exit().remove();

    // Add new labels
    const labelEnter = labelSelection.enter()
      .append('text')
      .attr('class', 'node-label');

    // Merge and apply styles
    const labelMerge = labelEnter.merge(labelSelection);

    labelMerge
      .text((d: NetworkNode) => {
        if (typeof labelConfig.field === 'function') {
          return labelConfig.field(d);
        }
        const field = labelConfig.field || 'label';
        return d[field as keyof NetworkNode]?.toString() || d.id.toString();
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${labelConfig.fontSize || 12}px`)
      .style('font-family', labelConfig.fontFamily || 'Arial, sans-serif')
      .style('fill', labelConfig.color || '#333333')
      .style('pointer-events', 'none');
  }

  private setupForceSimulation(
    nodes: NetworkNode[],
    links: NetworkLink[],
    forceConfig: ForceConfig,
    width: number,
    height: number
  ): void {
    // Stop existing simulation
    if (this.simulation) {
      this.simulation.stop();
    }

    // Create new simulation
    this.simulation = this.d3Service.createSimulation(nodes, links, {
      width,
      height,
      chargeStrength: forceConfig.chargeStrength,
      linkDistance: forceConfig.linkDistance,
      centerStrength: forceConfig.centerStrength,
      collideRadius: forceConfig.collideRadius,
      velocityDecay: forceConfig.velocityDecay,
      alphaDecay: forceConfig.alphaDecay
    });

    // Subscribe to simulation events
    this.d3Service.simulationEvents
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.type === 'tick') {
          this.updatePositions();
        }
      });

    // Set up drag behavior for nodes
    if (this.currentSvg) {
      const dragBehavior = this.d3Service.createNodeDragBehavior(this.simulation);
      this.currentSvg.selectAll<SVGGElement, NetworkNode>('.node')
        .call(dragBehavior);
    }
  }

  private setupZoomBehavior(width: number, height: number, zoomConfig: any = {}): void {
    if (!this.currentSvg) return;

    this.zoomBehavior = this.d3Service.createZoomBehavior({
      minZoom: zoomConfig.minZoom || 0.1,
      maxZoom: zoomConfig.maxZoom || 10,
      onZoom: (transform) => {
        this.currentSvg!.select('.zoom-group')
          .attr('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`);

        this.stateService.updateZoomTransform({
          scale: transform.k,
          translate: [transform.x, transform.y]
        });
      }
    });

    this.currentSvg.call(this.zoomBehavior);
  }

  private setupInteractions(interactionConfig: InteractionConfig): void {
    if (!this.currentSvg) return;

    // Background click events
    this.currentSvg.select('.interaction-overlay')
      .on('click', (event: MouseEvent) => {
        this.renderEvents$.next({
          type: 'backgroundClick',
          originalEvent: event,
          position: { x: event.offsetX, y: event.offsetY }
        });
      });
  }

  private setupNodeInteractions(nodeSelection: d3.Selection<SVGGElement, NetworkNode, d3.BaseType, unknown>): void {
    if (!nodeSelection) return;

    // Click events
    nodeSelection.on('click', (event: MouseEvent, d: NetworkNode) => {
      event.stopPropagation();
      this.renderEvents$.next({
        type: 'nodeClick',
        data: d,
        originalEvent: event,
        position: { x: event.offsetX, y: event.offsetY }
      });
    });

    // Hover events
    nodeSelection
      .on('mouseenter', (event: MouseEvent, d: NetworkNode) => {
        this.renderEvents$.next({
          type: 'nodeHover',
          data: d,
          originalEvent: event,
          position: { x: event.offsetX, y: event.offsetY }
        });
      })
      .on('mouseleave', (event: MouseEvent, d: NetworkNode) => {
        this.renderEvents$.next({
          type: 'nodeHover',
          data: null,
          originalEvent: event,
          position: { x: event.offsetX, y: event.offsetY }
        });
      });
  }

  private setupLinkInteractions(linkSelection: d3.Selection<SVGLineElement, NetworkLink, d3.BaseType, unknown>): void {
    if (!linkSelection) return;

    linkSelection.on('click', (event: MouseEvent, d: NetworkLink) => {
      event.stopPropagation();
      this.renderEvents$.next({
        type: 'linkClick',
        data: d,
        originalEvent: event,
        position: { x: event.offsetX, y: event.offsetY }
      });
    });
  }

  private applyInitialZoom(zoomConfig: any, width: number, height: number): void {
    if (!this.currentSvg || !this.zoomBehavior || !this.renderContext) return;

    switch (zoomConfig.zoomOnLoad) {
      case 'fit':
        setTimeout(() => this.zoomToFit(), 100);
        break;
      case 'center':
        this.resetZoom();
        break;
      case 'custom':
        if (zoomConfig.initialZoom && zoomConfig.initialPosition) {
          const customTransform = d3.zoomIdentity
            .translate(zoomConfig.initialPosition.x, zoomConfig.initialPosition.y)
            .scale(zoomConfig.initialZoom);

          this.currentSvg
            .transition()
            .duration(zoomConfig.animationDuration || 750)
            .call(this.zoomBehavior.transform, customTransform);
        }
        break;
    }
  }

  zoomIn(): void {
  if (!this.currentSvg || !this.zoomBehavior) return;

  this.currentSvg
    .transition()
    .duration(300)
    .call(this.zoomBehavior.scaleBy, 1.5);
}

/**
 * Zoom out by a factor of 1.5
 */
zoomOut(): void {
  if (!this.currentSvg || !this.zoomBehavior) return;

  this.currentSvg
    .transition()
    .duration(300)
    .call(this.zoomBehavior.scaleBy, 1 / 1.5);
}

  private subscribeToStateChanges(): void {
    this.stateService.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (this.renderContext) {
          this.renderContext.nodes = data.nodes;
          this.renderContext.links = data.links;
        }
      });

    this.stateService.selectedNodes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(selectedNodes => {
        this.highlightNodes(Array.from(selectedNodes));
      });
  }

  private cleanup(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    if (this.currentSvg) {
      // Remove all event listeners and clean up D3 selections
      this.currentSvg.selectAll('*').remove();
      this.currentSvg.on('.zoom', null);
      this.currentSvg = null;
    }

    this.zoomBehavior = null;
    this.renderContext = null;
  }

   getCurrentZoom(): { scale: number; translate: [number, number] } | null {
    if (!this.currentSvg) return null;

    try {
      const transform = d3.zoomTransform(this.currentSvg.node() as Element);
      return {
        scale: transform.k,
        translate: [transform.x, transform.y]
      };
    } catch {
      return null;
    }
  }
}
