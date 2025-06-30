import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { Observable, Subject } from 'rxjs';
import { NetworkNode, NetworkLink, NodeShape } from '../interfaces/network-visualization.interfaces';

export interface D3Selection<T = any> extends d3.Selection<SVGElement, T, null, undefined> {}
export interface D3Simulation extends d3.Simulation<NetworkNode, NetworkLink> {}
export interface D3ZoomBehavior extends d3.ZoomBehavior<SVGElement, unknown> {}

export interface RenderContext {
  svg: D3Selection;
  width: number;
  height: number;
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface SimulationEvent {
  type: 'tick' | 'start' | 'end';
  alpha?: number;
  nodes?: NetworkNode[];
  links?: NetworkLink[];
}

export interface ZoomTransform {
  k: number; // scale
  x: number; // translate x
  y: number; // translate y
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

@Injectable({
  providedIn: 'root'
})
export class D3AbstractionService {
  private simulationEvents$ = new Subject<SimulationEvent>();
  private currentSimulation: D3Simulation | null = null;

  /**
   * Simulation events observable
   */
  get simulationEvents(): Observable<SimulationEvent> {
    return this.simulationEvents$.asObservable();
  }

  /**
   * Create D3 selection from native SVG element
   */
  createSvgSelection(element: SVGElement): D3Selection {
    return d3.select(element);
  }

  /**
   * Initialize SVG with proper structure
   */
  initializeSvg(svg: D3Selection, width: number, height: number): void {
    // Clear existing content
    svg.selectAll('*').remove();

    // Set up main structure
    const container = svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background-color', 'transparent');

    // Create zoom group
    const zoomGroup = container
      .append('g')
      .attr('class', 'zoom-group');

    // Create main content groups in correct order
    zoomGroup.append('g').attr('class', 'links-group');
    zoomGroup.append('g').attr('class', 'nodes-group');
    zoomGroup.append('g').attr('class', 'labels-group');

    // Create overlay for interactions
    container
      .append('rect')
      .attr('class', 'interaction-overlay')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'transparent')
      .style('pointer-events', 'all');
  }

  /**
   * Create force simulation
   */
  createSimulation(nodes: NetworkNode[], links: NetworkLink[], config: {
    width: number;
    height: number;
    chargeStrength?: number;
    linkDistance?: number;
    centerStrength?: number;
    collideRadius?: number;
    velocityDecay?: number;
    alphaDecay?: number;
  }): D3Simulation {
    // Cast nodes to simulation nodes to satisfy D3 typing
    const simulationNodes = nodes as d3.SimulationNodeDatum[] & NetworkNode[];
    const simulationLinks = links.map(link => ({
      ...link,
      source: typeof link.source === 'object' ? link.source.id : link.source,
      target: typeof link.target === 'object' ? link.target.id : link.target
    }));

    const simulation = d3.forceSimulation<NetworkNode>(simulationNodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(simulationLinks)
        .id((d: NetworkNode) => d.id.toString())
        .distance(config.linkDistance || 50)
      )
      .force('charge', d3.forceManyBody<NetworkNode>()
        .strength(config.chargeStrength || -300)
      )
      .force('center', d3.forceCenter(config.width / 2, config.height / 2)
        .strength(config.centerStrength || 1)
      )
      .force('collide', d3.forceCollide<NetworkNode>()
        .radius((d: NetworkNode) => (d.size || 10) + 2)
        .strength(0.7)
      )
      .velocityDecay(config.velocityDecay || 0.4)
      .alphaDecay(config.alphaDecay || 0.0228);

    // Set up event listeners
    simulation
      .on('tick', () => {
        this.simulationEvents$.next({
          type: 'tick',
          alpha: simulation.alpha(),
          nodes,
          links
        });
      })
      .on('start', () => {
        this.simulationEvents$.next({
          type: 'start',
          nodes,
          links
        });
      })
      .on('end', () => {
        this.simulationEvents$.next({
          type: 'end',
          nodes,
          links
        });
      });

    this.currentSimulation = simulation;
    return simulation;
  }

  /**
   * Create zoom behavior
   */
  createZoomBehavior(config: {
    minZoom?: number;
    maxZoom?: number;
    onZoom?: (transform: ZoomTransform) => void;
  } = {}): D3ZoomBehavior {
    const zoom = d3.zoom<SVGElement, unknown>()
      .scaleExtent([config.minZoom || 0.1, config.maxZoom || 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGElement, unknown>) => {
        const transform = event.transform;
        if (config.onZoom) {
          config.onZoom({
            k: transform.k,
            x: transform.x,
            y: transform.y
          });
        }
      });

    return zoom;
  }

  /**
   * Apply zoom transform to selection
   */
  applyZoomTransform(selection: D3Selection, transform: ZoomTransform): void {
    selection.attr('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`);
  }

  /**
   * Calculate bounds of nodes
   */
  calculateBounds(nodes: NetworkNode[]): Bounds | null {
    if (nodes.length === 0) return null;

    const validNodes = nodes.filter(node =>
      typeof node.x === 'number' &&
      typeof node.y === 'number' &&
      !isNaN(node.x) &&
      !isNaN(node.y)
    );

    if (validNodes.length === 0) return null;

    const xs = validNodes.map(node => node.x!);
    const ys = validNodes.map(node => node.y!);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  /**
   * Fit bounds to viewport
   */
  calculateFitTransform(bounds: Bounds, viewport: { width: number; height: number }, padding = 50): ZoomTransform {
    const paddedWidth = viewport.width - padding * 2;
    const paddedHeight = viewport.height - padding * 2;

    const scale = Math.min(
      paddedWidth / bounds.width,
      paddedHeight / bounds.height,
      2 // Max zoom when fitting
    );

    const x = viewport.width / 2 - bounds.centerX * scale;
    const y = viewport.height / 2 - bounds.centerY * scale;

    return { k: scale, x, y };
  }

  /**
   * Generate SVG path for node shapes
   */
  generateNodePath(shape: NodeShape, size: number): string {
    const radius = size / 2;

    switch (shape) {
      case 'circle':
        return `M 0,${-radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,${-radius}`;

      case 'square':
        return `M ${-radius},${-radius} L ${radius},${-radius} L ${radius},${radius} L ${-radius},${radius} Z`;

      case 'triangle':
        const height = radius * Math.sqrt(3);
        return `M 0,${-height * 0.6} L ${radius},${height * 0.4} L ${-radius},${height * 0.4} Z`;

      case 'diamond':
        return `M 0,${-radius} L ${radius},0 L 0,${radius} L ${-radius},0 Z`;

      case 'star':
        return this.generateStarPath(radius);

      case 'hexagon':
        return this.generateHexagonPath(radius);

      default:
        return `M 0,${-radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,${-radius}`;
    }
  }

  /**
   * Create color scale
   */
  createColorScale(domain: string[] | number[], scheme: string[] | string = 'category10'): d3.ScaleOrdinal<string, string, never> | d3.ScaleLinear<string, string, never> {
    if (typeof scheme === 'string') {
      // Use D3 color scheme
      const colorScheme = (d3 as any)[`scheme${scheme}`] || d3.schemeCategory10;
      return d3.scaleOrdinal<string, string>()
        .domain(domain as string[])
        .range(colorScheme);
    } else {
      // Use custom colors
      return d3.scaleOrdinal<string, string>()
        .domain(domain as string[])
        .range(scheme);
    }
  }

  /**
   * Create size scale
   */
  createSizeScale(domain: [number, number], range: [number, number], type: 'linear' | 'sqrt' | 'log' = 'sqrt'): d3.ScaleLinear<number, number, never> | d3.ScalePower<number, number, never> | d3.ScaleLogarithmic<number, number, never> {
    switch (type) {
      case 'log':
        return d3.scaleLog<number, number>().domain(domain).range(range);
      case 'sqrt':
        return d3.scaleSqrt<number, number>().domain(domain).range(range);
      default:
        return d3.scaleLinear<number, number>().domain(domain).range(range);
    }
  }

  /**
   * Interpolate between colors
   */
  interpolateColor(color1: string, color2: string, factor: number): string {
    try {
      const c1 = d3.color(color1);
      const c2 = d3.color(color2);
      if (!c1 || !c2) return color1;
      return d3.interpolate(c1, c2)(factor);
    } catch {
      return color1;
    }
  }

  /**
   * Create transition
   */
  createTransition(duration = 300, ease: string = 'easeInOut'): d3.Transition<any, any, any, any> {
    const easeFunction = (d3 as any)[`ease${ease}`] || d3.easeLinear;
    return d3.transition()
      .duration(duration)
      .ease(easeFunction);
  }

  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  }

  /**
   * Get current simulation
   */
  getCurrentSimulation(): D3Simulation | null {
    return this.currentSimulation;
  }

  /**
   * Stop and destroy current simulation
   */
  destroySimulation(): void {
    if (this.currentSimulation) {
      this.currentSimulation.stop();
      this.currentSimulation = null;
    }
  }

  /**
   * Generate drag behavior for nodes
   */
  createNodeDragBehavior(simulation: D3Simulation): d3.DragBehavior<SVGGElement, NetworkNode, NetworkNode | d3.SubjectPosition> {
    return d3.drag<SVGGElement, NetworkNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode | d3.SubjectPosition>) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        const subject = event.subject as NetworkNode;
        subject.fx = subject.x;
        subject.fy = subject.y;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode | d3.SubjectPosition>) => {
        const subject = event.subject as NetworkNode;
        subject.fx = event.x;
        subject.fy = event.y;
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode | d3.SubjectPosition>) => {
        if (!event.active) simulation.alphaTarget(0);
        const subject = event.subject as NetworkNode;
        subject.fx = null;
        subject.fy = null;
      });
  }

  private generateStarPath(radius: number): string {
    const points: string[] = [];
    const outerRadius = radius;
    const innerRadius = radius * 0.4;

    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
    }

    return points.join(' ') + ' Z';
  }

  private generateHexagonPath(radius: number): string {
    const points: string[] = [];

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
    }

    return points.join(' ') + ' Z';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.destroySimulation();
    this.simulationEvents$.complete();
  }
}
