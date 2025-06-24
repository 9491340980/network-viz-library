import { Injectable } from '@angular/core';
import {
  NetworkVisualizationConfig,
  InteractionConfig,
  NodeShape
} from '../interfaces/network-visualization.interfaces';

export class NetworkConfigBuilder {
  private config: NetworkVisualizationConfig = {};

  // Node styling methods
  withNodeSize(size: number): this {
    this.config.nodeStyles = { ...this.config.nodeStyles, defaultSize: size };
    return this;
  }

  withNodeShape(shape: NodeShape): this {
    this.config.nodeStyles = { ...this.config.nodeStyles, defaultShape: shape };
    return this;
  }

  withNodeColors(colors: string[]): this {
    this.config.nodeStyles = { ...this.config.nodeStyles, colorScheme: colors };
    return this;
  }

  withGroupColors(groupColors: Record<string | number, string>): this {
    this.config.nodeStyles = { ...this.config.nodeStyles, groupColors };
    return this;
  }

  // Link styling methods
  withLinkWidth(width: number): this {
    this.config.linkStyles = { ...this.config.linkStyles, defaultWidth: width };
    return this;
  }

  withLinkColor(color: string): this {
    this.config.linkStyles = { ...this.config.linkStyles, defaultColor: color };
    return this;
  }

  // Force simulation methods
  withForces(enabled: boolean = true): this {
    this.config.forceConfig = { ...this.config.forceConfig, enabled };
    return this;
  }

  withChargeStrength(strength: number): this {
    this.config.forceConfig = { ...this.config.forceConfig, chargeStrength: strength };
    return this;
  }

  withLinkDistance(distance: number): this {
    this.config.forceConfig = { ...this.config.forceConfig, linkDistance: distance };
    return this;
  }

  // Interaction methods
  withInteractions(config: Partial<InteractionConfig>): this {
    this.config.interactionConfig = { ...this.config.interactionConfig, ...config };
    return this;
  }

  // Zoom configuration methods
  withInitialZoom(scale: number, position?: { x: number; y: number }): this {
    this.config.zoomConfig = {
      ...this.config.zoomConfig,
      initialZoom: scale,
      initialPosition: position,
      zoomOnLoad: 'custom'
    };
    return this;
  }

  withZoomOnLoad(behavior: 'fit' | 'center' | 'custom' | 'none'): this {
    this.config.zoomConfig = { ...this.config.zoomConfig, zoomOnLoad: behavior };
    return this;
  }

  withSmoothZoom(duration: number = 750): this {
    this.config.zoomConfig = {
      ...this.config.zoomConfig,
      animationDuration: duration,
      smoothTransitions: true
    };
    return this;
  }

  // Tooltip methods
  withTooltip(enabled: boolean = true): this {
    this.config.tooltipConfig = { ...this.config.tooltipConfig, enabled };
    return this;
  }

  withCustomTooltip(template: (node: any) => string): this {
    this.config.tooltipConfig = { ...this.config.tooltipConfig, customTemplate: template };
    return this;
  }

  withTooltipFields(fields: string[]): this {
    this.config.tooltipConfig = { ...this.config.tooltipConfig, showCustomFields: fields };
    return this;
  }

  // Legend methods
  withLegend(enabled: boolean = true, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-left'): this {
    this.config.legendConfig = {
      ...this.config.legendConfig,
      enabled,
      position
    };
    return this;
  }

  withLegendTitle(title: string): this {
    this.config.legendConfig = { ...this.config.legendConfig, title };
    return this;
  }

  // Label methods
  withLabels(enabled: boolean = true): this {
    this.config.labelConfig = { ...this.config.labelConfig, enabled };
    return this;
  }

  withLabelFormatter(formatter: (value: any, node: any) => string): this {
    this.config.labelConfig = { ...this.config.labelConfig, formatter };
    return this;
  }

  withLabelTruncation(maxLength: number, style: 'ellipsis' | 'middle' | 'none' = 'ellipsis'): this {
    this.config.labelConfig = {
      ...this.config.labelConfig,
      maxLength,
      truncateStyle: style
    };
    return this;
  }

  // Performance optimization methods
  forPerformance(): this {
    return this
      .withInteractions({ enableHover: false, enableDrag: false })
      .withTooltip(false)
      .withLabels(false)
      .withForces(true)
      .withChargeStrength(-100)
      .withLinkDistance(20);
  }

  // Accessibility methods
  forAccessibility(): this {
    return this
      .withNodeSize(16) // Larger nodes
      .withLinkWidth(3) // Thicker links
      .withTooltip(true)
      .withLabels(true);
  }

  // Mobile optimization methods
  forMobile(): this {
    return this
      .withNodeSize(18)
      .withLinkWidth(3)
      .withInteractions({ enableHover: false, enableTouch: true })
      .withZoomOnLoad('fit')
      .withSmoothZoom(500);
  }

  // Apply preset
  withPreset(presetName: keyof typeof NetworkConfigBuilderService.presets): this {
    const preset = NetworkConfigBuilderService.presets[presetName]();
    this.config = { ...this.config, ...preset };
    return this;
  }

  // Apply theme
  withTheme(themeName: keyof typeof NetworkConfigBuilderService.themes): this {
    this.config = NetworkConfigBuilderService.applyTheme(this.config, themeName);
    return this;
  }

  // Build final configuration
  build(): NetworkVisualizationConfig {
    return { ...this.config };
  }
}

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
        defaultColor: '#e74c3c'
      },
      linkStyles: {
        defaultWidth: 1,
        defaultColor: '#bdc3c7'
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -100,
        linkDistance: 20,
        velocityDecay: 0.6,
        alphaDecay: 0.05
      },
      interactionConfig: {
        enableHover: false, // Disable for performance
        enableClick: true,
        enableDrag: false
      },
      zoomConfig: {
        zoomOnLoad: 'fit',
        animationDuration: 300
      },
      tooltipConfig: {
        enabled: false // Disable for performance
      },
      legendConfig: {
        enabled: false
      }
    }),

    // Rich, interactive configuration for detailed analysis
    analytical: (): NetworkVisualizationConfig => ({
      nodeStyles: {
        defaultSize: 15,
        defaultShape: 'circle',
        colorScheme: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
        defaultBorderWidth: 2,
        defaultBorderColor: '#34495e'
      },
      linkStyles: {
        defaultWidth: 2,
        defaultColor: '#7f8c8d',
        colorScheme: ['#e74c3c', '#3498db', '#2ecc71']
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -300,
        linkDistance: 50,
        centerStrength: 0.1,
        collideRadius: 25
      },
      interactionConfig: {
        enableHover: true,
        enableClick: true,
        enableRightClick: true,
        enableDrag: true,
        enableZoom: true,
        zoomExtent: [0.1, 5]
      },
      zoomConfig: {
        zoomOnLoad: 'center',
        animationDuration: 750,
        smoothTransitions: true
      },
      legendConfig: {
        enabled: true,
        position: 'bottom-left',
        orientation: 'vertical',
        title: 'Node Categories',
        showGroupColors: true,
        showCategoryColors: true
      },
      tooltipConfig: {
        enabled: true,
        showNodeId: true,
        showNodeLabel: true,
        showNodeGroup: true,
        showNodeCategory: true,
        showCustomFields: ['description', 'metrics', 'status'],
        backgroundColor: 'rgba(52, 73, 94, 0.95)',
        textColor: '#ecf0f1',
        fontSize: 13,
        maxWidth: 300,
        showDelay: 100,
        hideDelay: 200
      },
      labelConfig: {
        enabled: true,
        position: 'bottom',
        fontSize: 11,
        maxLength: 20,
        truncateStyle: 'ellipsis',
        showBackground: true,
        backgroundColor: 'rgba(255, 255, 255, 0.9)'
      }
    }),

    // Mobile-optimized configuration
    mobile: (): NetworkVisualizationConfig => ({
      nodeStyles: {
        defaultSize: 18, // Larger for touch
        defaultShape: 'circle',
        defaultColor: '#3498db'
      },
      linkStyles: {
        defaultWidth: 3, // Thicker for visibility
        defaultColor: '#7f8c8d'
      },
      forceConfig: {
        enabled: true,
        chargeStrength: -400,
        linkDistance: 60
      },
      interactionConfig: {
        enableHover: false, // No hover on mobile
        enableClick: true,
        enableTouch: true,
        enableDrag: true,
        enableZoom: true,
        enablePan: true
      },
      zoomConfig: {
        zoomOnLoad: 'fit',
        animationDuration: 500
      },
      legendConfig: {
        enabled: true,
        position: 'bottom-left',
        fontSize: 14, // Larger text
        symbolSize: 16
      },
      tooltipConfig: {
        enabled: true,
        fontSize: 16, // Larger text
        maxWidth: 250,
        backgroundColor: 'rgba(44, 62, 80, 0.95)',
        padding: '12px 16px'
      }
    })
  };

  /**
   * Theme configurations
   */
  static themes = {
    light: {
      backgroundColor: '#ffffff',
      nodeColor: '#3498db',
      linkColor: '#bdc3c7',
      textColor: '#2c3e50',
      tooltipBackground: 'rgba(44, 62, 80, 0.95)',
      legendBackground: 'rgba(255, 255, 255, 0.95)'
    },

    dark: {
      backgroundColor: '#2c3e50',
      nodeColor: '#3498db',
      linkColor: '#7f8c8d',
      textColor: '#ecf0f1',
      tooltipBackground: 'rgba(52, 73, 94, 0.95)',
      legendBackground: 'rgba(44, 62, 80, 0.95)'
    },

    corporate: {
      backgroundColor: '#f8f9fa',
      nodeColor: '#007bff',
      linkColor: '#6c757d',
      textColor: '#343a40',
      tooltipBackground: 'rgba(52, 58, 64, 0.95)',
      legendBackground: 'rgba(248, 249, 250, 0.95)'
    },

    cyberpunk: {
      backgroundColor: '#0d1117',
      nodeColor: '#00ff88',
      linkColor: '#ff0080',
      textColor: '#00ff88',
      tooltipBackground: 'rgba(13, 17, 23, 0.95)',
      legendBackground: 'rgba(13, 17, 23, 0.95)'
    }
  };

  /**
   * Apply theme to configuration
   */
  static applyTheme(config: NetworkVisualizationConfig, themeName: keyof typeof NetworkConfigBuilderService.themes): NetworkVisualizationConfig {
    const theme = this.themes[themeName];

    return {
      ...config,
      backgroundColor: theme.backgroundColor,
      nodeStyles: {
        ...config.nodeStyles,
        defaultColor: theme.nodeColor
      },
      linkStyles: {
        ...config.linkStyles,
        defaultColor: theme.linkColor
      },
      labelConfig: {
        ...config.labelConfig,
        color: theme.textColor
      },
      tooltipConfig: {
        ...config.tooltipConfig,
        backgroundColor: theme.tooltipBackground,
        textColor: theme.textColor
      },
      legendConfig: {
        ...config.legendConfig,
        backgroundColor: theme.legendBackground
      }
    };
  }
}
