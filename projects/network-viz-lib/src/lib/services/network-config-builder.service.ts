import { Injectable } from '@angular/core';
import { ForceConfig, InteractionConfig, LabelConfig, LegendConfig, LinkStyleConfig, NetworkVisualizationConfig, NodeStyleConfig, TooltipConfig, ZoomConfig } from '../interfaces/network-visualization.interfaces';


@Injectable({
  providedIn: 'root'
})
export class NetworkConfigBuilderService {

  /**
   * Create a configuration builder with fluent API
   */
  static create(): NetworkConfigBuilder {
    return new NetworkConfigBuilder();
  }

  /**
   * Pre-built configuration presets for common use cases
   */
  static presets = {
    // Simple, clean visualization for presentations
    presentation: (): NetworkVisualizationConfig => ({
      nodeStyles: {
        defaultSize: 20,
        defaultShape: 'circle',
        defaultColor: '#3498db',
        defaultBorderWidth: 3,
        defaultBorderColor: '#2980b9'
      },
      linkStyles: {
        defaultWidth: 3,
        defaultColor: '#7f8c8d'
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -500,
        linkDistance: 80,
        centerStrength: 0.3
      },
      zoomConfig: {
        zoomOnLoad: 'fit',
        animationDuration: 1000,
        smoothTransitions: true
      },
      legendConfig: {
        enabled: true,
        position: 'top-right',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 8,
        padding: 15
      },
      tooltipConfig: {
        enabled: true,
        backgroundColor: 'rgba(44, 62, 80, 0.95)',
        textColor: 'white',
        fontSize: 14,
        borderRadius: 8,
        showDelay: 200
      }
    }),

    // High-performance configuration for large datasets
    performance: (): NetworkVisualizationConfig => ({
      nodeStyles: {
        defaultSize: 8,
        defaultShape: 'circle',
        defaultColor: '#95a5a6'
      },
      linkStyles: {
        defaultWidth: 1,
        defaultColor: '#bdc3c7'
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -100,
        linkDistance: 30,
        velocityDecay: 0.6,
        alphaDecay: 0.05
      },
      interactionConfig: {
        enableHover: false,
        enableDrag: false,
        enableTouch: false
      },
      tooltipConfig: { enabled: false },
      labelConfig: { enabled: false },
      legendConfig: { enabled: false }
    }),

    // Analytical configuration with all features enabled
    analytical: (): NetworkVisualizationConfig => ({
      nodeStyles: {
        defaultSize: 15,
        defaultShape: 'circle',
        groupColors: {
          'A': '#e74c3c',
          'B': '#3498db',
          'C': '#2ecc71',
          'D': '#f39c12',
          'E': '#9b59b6'
        }
      },
      linkStyles: {
        defaultWidth: 2,
        defaultColor: '#34495e'
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -300,
        linkDistance: 60,
        centerStrength: 0.1
      },
      tooltipConfig: {
        enabled: true,
        showNodeId: true,
        showNodeLabel: true,
        showNodeGroup: true
      },
      legendConfig: {
        enabled: true,
        position: 'top-right'
      },
      labelConfig: {
        enabled: true,
        showFor: 'selected'
      }
    })
  };
}

export class NetworkConfigBuilder {
  private config: NetworkVisualizationConfig = {};

  withPreset(preset: keyof typeof NetworkConfigBuilderService.presets): this {
    this.config = { ...NetworkConfigBuilderService.presets[preset]() };
    return this;
  }

  withNodeStyles(nodeStyles: Partial<NodeStyleConfig>): this {
    this.config.nodeStyles = { ...this.config.nodeStyles, ...nodeStyles };
    return this;
  }

  withLinkStyles(linkStyles: Partial<LinkStyleConfig>): this {
    this.config.linkStyles = { ...this.config.linkStyles, ...linkStyles };
    return this;
  }

  withForceConfig(forceConfig: Partial<ForceConfig>): this {
    this.config.forceConfig = { ...this.config.forceConfig, ...forceConfig };
    return this;
  }

  withInteractions(interactions: Partial<InteractionConfig>): this {
    this.config.interactionConfig = { ...this.config.interactionConfig, ...interactions };
    return this;
  }

  withTooltip(enabled: boolean): this;
  withTooltip(config: Partial<TooltipConfig>): this;
  withTooltip(configOrEnabled: boolean | Partial<TooltipConfig>): this {
    if (typeof configOrEnabled === 'boolean') {
      this.config.tooltipConfig = { enabled: configOrEnabled };
    } else {
      this.config.tooltipConfig = { ...this.config.tooltipConfig, ...configOrEnabled };
    }
    return this;
  }

  withLegend(enabled: boolean): this;
  withLegend(config: Partial<LegendConfig>): this;
  withLegend(configOrEnabled: boolean | Partial<LegendConfig>): this {
    if (typeof configOrEnabled === 'boolean') {
      this.config.legendConfig = { enabled: configOrEnabled };
    } else {
      this.config.legendConfig = { ...this.config.legendConfig, ...configOrEnabled };
    }
    return this;
  }

  withLabels(config: Partial<LabelConfig>): this {
    this.config.labelConfig = { ...this.config.labelConfig, ...config };
    return this;
  }

  withZoom(config: Partial<ZoomConfig>): this {
    this.config.zoomConfig = { ...this.config.zoomConfig, ...config };
    return this;
  }

  withTheme(theme: 'light' | 'dark' | 'corporate' | 'cyberpunk'): this {
    // Apply theme-specific configurations
    switch (theme) {
      case 'dark':
        this.config.backgroundColor = '#2c3e50';
        break;
      case 'corporate':
        this.config.backgroundColor = '#f8f9fa';
        break;
      case 'cyberpunk':
        this.config.backgroundColor = '#0a0a0a';
        break;
      default:
        this.config.backgroundColor = '#ffffff';
    }
    return this;
  }

  build(): NetworkVisualizationConfig {
    return { ...this.config };
  }
}
