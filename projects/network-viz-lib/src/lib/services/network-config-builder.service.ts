import { Injectable } from '@angular/core';
import { NetworkConfig, InteractionConfig, LayoutConfig, TooltipConfig, LegendConfig } from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class NetworkConfigBuilderService {
  private config: NetworkConfig = {};

  static create(): NetworkConfigBuilderService {
    return new NetworkConfigBuilderService();
  }

  withDimensions(width: number, height: number): this {
    this.config.width = width;
    this.config.height = height;
    return this;
  }

  withNodeSize(radius: number): this {
    this.config.nodeRadius = radius;
    return this;
  }

  withLinkWidth(width: number): this {
    this.config.linkWidth = width;
    return this;
  }

  withTheme(theme: 'light' | 'dark' | 'corporate' | 'cyberpunk'): this {
    this.config.theme = theme;
    return this;
  }

  withInteractions(interactions: InteractionConfig): this {
    this.config.interactions = { ...this.config.interactions, ...interactions };
    return this;
  }

  withLayout(layout: LayoutConfig): this {
    this.config.layout = { ...this.config.layout, ...layout };
    return this;
  }

  withTooltip(enabled: boolean, template?: (node: any) => string): this {
    this.config.tooltip = {
      enabled,
      template: template || ((node) => `<div>${node.label || node.id}</div>`)
    };
    return this;
  }

  withLegend(enabled: boolean, position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): this {
    this.config.legend = {
      enabled,
      position: position || 'top-right'
    };
    return this;
  }

  withPreset(preset: 'basic' | 'advanced' | 'performance' | 'analytical'): this {
    switch (preset) {
      case 'basic':
        this.config = {
          nodeRadius: 5,
          linkWidth: 1,
          theme: 'light',
          interactions: { enableHover: true, enableClick: true },
          layout: { type: 'force', forceStrength: -300 }
        };
        break;
      case 'advanced':
        this.config = {
          nodeRadius: 8,
          linkWidth: 2,
          theme: 'corporate',
          interactions: { enableHover: true, enableClick: true, enableDrag: true, enableZoom: true },
          layout: { type: 'force', forceStrength: -500, linkDistance: 50 },
          tooltip: { enabled: true },
          legend: { enabled: true, position: 'top-right' }
        };
        break;
      case 'performance':
        this.config = {
          nodeRadius: 3,
          linkWidth: 1,
          theme: 'light',
          interactions: { enableZoom: true },
          layout: { type: 'force', forceStrength: -200 },
          performance: { enableOptimizations: true, renderMode: 'canvas' }
        };
        break;
      case 'analytical':
        this.config = {
          nodeRadius: 6,
          linkWidth: 2,
          theme: 'dark',
          interactions: { enableHover: true, enableClick: true, enableZoom: true },
          layout: { type: 'force', forceStrength: -400, centerForce: 0.3 },
          tooltip: { enabled: true },
          legend: { enabled: true, position: 'bottom-left' }
        };
        break;
    }
    return this;
  }

  build(): NetworkConfig {
    return { ...this.config };
  }
}
