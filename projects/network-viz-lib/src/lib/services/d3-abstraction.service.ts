import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { NetworkData, NetworkNode, NetworkLink, NetworkConfig } from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class D3AbstractionService {
  private simulation: d3.Simulation<NetworkNode, NetworkLink> | null = null;

  createSimulation(data: NetworkData, config: NetworkConfig): d3.Simulation<NetworkNode, NetworkLink> {
    const { width = 800, height = 600 } = config;
    const { layout = {} } = config;

    this.simulation = d3.forceSimulation<NetworkNode>(data.nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(data.links)
        .id((d: any) => d.id)
        .distance(layout.linkDistance || 30))
      .force('charge', d3.forceManyBody()
        .strength(layout.forceStrength || -300))
      .force('center', d3.forceCenter(width / 2, height / 2)
        .strength(layout.centerForce || 1))
      .force('collision', d3.forceCollide()
        .radius((d: any) => (d.size || 5) + 2));

    return this.simulation;
  }

  updateSimulation(data: NetworkData): void {
    if (this.simulation) {
      this.simulation.nodes(data.nodes);
      const linkForce = this.simulation.force('link') as d3.ForceLink<NetworkNode, NetworkLink>;
      if (linkForce) {
        linkForce.links(data.links);
      }
      this.simulation.alpha(1).restart();
    }
  }

  createColorScale(domain: string[]): d3.ScaleOrdinal<string, string> {
    return d3.scaleOrdinal(d3.schemeCategory10).domain(domain);
  }

  createSizeScale(domain: [number, number], range: [number, number]): d3.ScaleLinear<number, number> {
    return d3.scaleLinear().domain(domain).range(range);
  }

  createZoomBehavior(): d3.ZoomBehavior<Element, unknown> {
    return d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        d3.select('.network-container g')
          .attr('transform', transform);
      });
  }

  stopSimulation(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  restartSimulation(): void {
    if (this.simulation) {
      this.simulation.alpha(1).restart();
    }
  }
}
