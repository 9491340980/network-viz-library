import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { NetworkConfigBuilderService, NetworkData, NetworkDataService, NetworkError, NetworkEvent, NetworkVisualizationConfig, NetworkVisualizationV2Component } from 'network-viz-lib';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule, NetworkVisualizationV2Component],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
 title = 'network-visualization-demo';

  // Configuration properties
  selectedDataset: string = 'simple';
  selectedTheme: string = 'light';
  selectedPreset: string = 'presentation';
  showControls: boolean = true;
  showLegend: boolean = true;
  showTooltip: boolean = true;

  // Data and configuration
  networkData: NetworkData = { nodes: [], links: [] };
  visualizationConfig: NetworkVisualizationConfig = {};

  // Event tracking
  recentEvents: any[] = [];
  eventCount: number = 0;
  errors: NetworkError[] = [];

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    this.loadDataset();
    this.applyTheme();
    this.applyPreset();
  }

  loadDataset(): void {
    try {
      switch (this.selectedDataset) {
        case 'simple':
          this.networkData = this.generateSimpleNetwork();
          break;
        case 'complex':
          this.networkData = this.generateComplexNetwork();
          break;
        case 'large':
          this.networkData = this.generateLargeNetwork();
          break;
        default:
          this.networkData = this.generateSimpleNetwork();
      }
      this.logEvent('datasetLoaded', { dataset: this.selectedDataset });
    } catch (error) {
      this.onError({
        type: 'data',
        message: `Failed to load dataset: ${this.selectedDataset}`
      });
    }
  }

  applyTheme(): void {
    try {
      const themeConfig = this.getThemeConfig(this.selectedTheme);
      this.visualizationConfig = {
        ...this.visualizationConfig,
        ...themeConfig
      };
      this.logEvent('themeChanged', { theme: this.selectedTheme });
    } catch (error) {
      this.onError({
        type: 'configuration',
        message: `Failed to apply theme: ${this.selectedTheme}`
      });
    }
  }

  applyPreset(): void {
    try {
      const presetConfig = this.getPresetConfig(this.selectedPreset);
      this.visualizationConfig = {
        ...this.visualizationConfig,
        ...presetConfig
      };
      this.logEvent('presetChanged', { preset: this.selectedPreset });
    } catch (error) {
      this.onError({
        type: 'configuration',
        message: `Failed to apply preset: ${this.selectedPreset}`
      });
    }
  }

  // Event handlers
  onNodeClick(event: NetworkEvent): void {
    this.logEvent('nodeClick', event.data);
    console.log('Node clicked:', event.data);
  }

  onNodeHover(event: NetworkEvent): void {
    this.logEvent('nodeHover', event.data);
  }

  onLinkClick(event: NetworkEvent): void {
    this.logEvent('linkClick', event.data);
    console.log('Link clicked:', event.data);
  }

  onZoomChanged(event: any): void {
    this.logEvent('zoomChanged', event);
  }

  onError(error: NetworkError): void {
    this.errors.push(error);
    console.error('Network visualization error:', error);
  }

  clearErrors(): void {
    this.errors = [];
  }

  // Event logging
  private logEvent(type: string, data: any): void {
    const event: any = {
      type,
      data,
      timestamp: new Date()
    };
    this.recentEvents.push(event);
    this.eventCount++;

    // Keep only last 50 events to prevent memory issues
    if (this.recentEvents.length > 50) {
      this.recentEvents = this.recentEvents.slice(-50);
    }
  }

  getEventDescription(event: any): string {
    switch (event.type) {
      case 'nodeClick':
        return `Node: ${event.data?.id || 'Unknown'}`;
      case 'nodeHover':
        return `Node: ${event.data?.id || 'Unknown'}`;
      case 'linkClick':
        return `Link: ${event.data?.source || 'Unknown'} → ${event.data?.target || 'Unknown'}`;
      case 'zoomChanged':
        return `Zoom: ${event.data?.scale?.toFixed(2) || event.scale?.toFixed(2) || 'Unknown'}`;
      case 'datasetLoaded':
        return `Dataset: ${event.data?.dataset || 'Unknown'}`;
      case 'themeChanged':
        return `Theme: ${event.data?.theme || 'Unknown'}`;
      case 'presetChanged':
        return `Preset: ${event.data?.preset || 'Unknown'}`;
      default:
        return JSON.stringify(event.data).substring(0, 50) + '...';
    }
  }

  // Utility methods
  refreshVisualization(): void {
    this.loadDataset();
  }

  exportConfiguration(): void {
    const config = {
      dataset: this.selectedDataset,
      theme: this.selectedTheme,
      preset: this.selectedPreset,
      showControls: this.showControls,
      showLegend: this.showLegend,
      showTooltip: this.showTooltip,
      visualizationConfig: this.visualizationConfig
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-viz-config.json';
    a.click();
    URL.revokeObjectURL(url);

    this.logEvent('configExported', { timestamp: new Date() });
  }

  resetToDefaults(): void {
    this.selectedDataset = 'simple';
    this.selectedTheme = 'light';
    this.selectedPreset = 'presentation';
    this.showControls = true;
    this.showLegend = true;
    this.showTooltip = true;
    this.errors = [];
    this.recentEvents = [];
    this.eventCount = 0;

    this.initializeApp();
    this.logEvent('resetToDefaults', { timestamp: new Date() });
  }

  // Data generation methods
  private generateSimpleNetwork(): NetworkData {
    return {
      nodes: [
        { id: 'A', label: 'Node A', group: 'primary' },
        { id: 'B', label: 'Node B', group: 'secondary' },
        { id: 'C', label: 'Node C', group: 'secondary' },
        { id: 'D', label: 'Node D', group: 'tertiary' },
        { id: 'E', label: 'Node E', group: 'tertiary' }
      ],
      links: [
        { source: 'A', target: 'B', weight: 1 },
        { source: 'A', target: 'C', weight: 2 },
        { source: 'B', target: 'D', weight: 1 },
        { source: 'C', target: 'E', weight: 1 },
        { source: 'D', target: 'E', weight: 3 }
      ]
    };
  }

  private generateComplexNetwork(): NetworkData {
    const nodes = [];
    const links:any = [];

    // Generate 20 nodes with different groups
    for (let i = 0; i < 20; i++) {
      nodes.push({
        id: `node-${i}`,
        label: `Node ${i}`,
        group: i < 5 ? 'core' : i < 12 ? 'secondary' : 'peripheral',
        size: Math.random() * 10 + 5
      });
    }

    // Generate links with some clustering
    for (let i = 0; i < nodes.length; i++) {
      const numLinks = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < numLinks; j++) {
        const target = Math.floor(Math.random() * nodes.length);
        if (target !== i && !links.find((l:any) =>
          (l.source === `node-${i}` && l.target === `node-${target}`) ||
          (l.source === `node-${target}` && l.target === `node-${i}`)
        )) {
          links.push({
            source: `node-${i}`,
            target: `node-${target}`,
            weight: Math.random() * 5 + 1
          });
        }
      }
    }

    return { nodes, links };
  }

  private generateLargeNetwork(): NetworkData {
    const nodes = [];
    const links:any = [];

    // Generate 100 nodes
    for (let i = 0; i < 100; i++) {
      nodes.push({
        id: `n${i}`,
        label: `Node ${i}`,
        group: Math.floor(i / 20).toString(),
        size: Math.random() * 8 + 3
      });
    }

    // Generate links following power-law distribution
    for (let i = 0; i < nodes.length; i++) {
      const numLinks = Math.floor(Math.pow(Math.random(), 2) * 10) + 1;
      for (let j = 0; j < numLinks; j++) {
        const target = Math.floor(Math.random() * nodes.length);
        if (target !== i && !links.find((l:any) =>
          (l.source === `n${i}` && l.target === `n${target}`) ||
          (l.source === `n${target}` && l.target === `n${i}`)
        )) {
          links.push({
            source: `n${i}`,
            target: `n${target}`,
            weight: Math.random() * 3 + 0.5
          });
        }
      }
    }

    return { nodes, links };
  }

  // Configuration methods - Updated for v11
  private getThemeConfig(theme: string): Partial<NetworkVisualizationConfig> {
    switch (theme) {
      case 'light':
        return {
          backgroundColor: '#ffffff',
          labelColor: '#333333',
          labelFontSize: 12,
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true
        };

      case 'dark':
        return {
          backgroundColor: '#1a1a1a',
          labelColor: '#ffffff',
          labelFontSize: 12,
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true
        };

      case 'corporate':
        return {
          backgroundColor: '#f8f9fa',
          labelColor: '#495057',
          labelFontSize: 11,
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true
        };

      case 'cyberpunk':
        return {
          backgroundColor: '#0a0a0a',
          labelColor: '#00ffff',
          labelFontSize: 13,
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true
        };

      default:
        return this.getThemeConfig('light');
    }
  }

  private getPresetConfig(preset: string): Partial<NetworkVisualizationConfig> {
    switch (preset) {
      case 'presentation':
        return {
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true,
          labelFontSize: 12
        };

      case 'analytical':
        return {
          enableLabels: true,
          enableLegend: true,
          enableTooltip: true,
          labelFontSize: 10
        };

      case 'performance':
        return {
          enableLabels: false,
          enableLegend: false,
          enableTooltip: false
        };

      case 'mobile':
        return {
          enableLabels: false,
          enableLegend: true,
          enableTooltip: true,
          labelFontSize: 14
        };

      default:
        return this.getPresetConfig('presentation');
    }
  }
}
