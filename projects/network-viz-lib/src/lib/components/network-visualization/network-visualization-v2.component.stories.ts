import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { NetworkVisualizationV2Component } from './network-visualization-v2.component';
import { NetworkConfigBuilderService } from '../../services/network-config-builder.service';
import { NetworkDataService } from '../../services/network-data.service';

const meta: Meta<NetworkVisualizationV2Component> = {
  title: 'Components/Network Visualization',
  component: NetworkVisualizationV2Component,
  decorators: [
    moduleMetadata({
      providers: [NetworkConfigBuilderService, NetworkDataService],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Advanced network visualization component with full customization capabilities.',
      },
    },
  },
  argTypes: {
    width: {
      control: { type: 'range', min: 300, max: 1200, step: 50 },
      description: 'Canvas width in pixels',
    },
    height: {
      control: { type: 'range', min: 200, max: 800, step: 50 },
      description: 'Canvas height in pixels',
    },
    showControls: {
      control: 'boolean',
      description: 'Show zoom and pan controls',
    },
    showLegend: {
      control: 'boolean',
      description: 'Show legend panel',
    },
    showTooltip: {
      control: 'boolean',
      description: 'Enable tooltips on hover',
    },
  },
};

export default meta;
type Story = StoryObj<NetworkVisualizationV2Component>;

// Sample data
const sampleData = {
  nodes: [
    { id: 1, label: 'Central Hub', group: 'Core', size: 20, color: '#ff6b6b' },
    { id: 2, label: 'Database', group: 'Storage', size: 15, color: '#4ecdc4' },
    { id: 3, label: 'Web Server', group: 'Frontend', size: 12, color: '#45b7d1' },
    { id: 4, label: 'API Gateway', group: 'Backend', size: 18, color: '#f9ca24' },
    { id: 5, label: 'Cache', group: 'Storage', size: 10, color: '#f0932b' },
  ],
  links: [
    { source: 1, target: 2, label: 'Data Flow' },
    { source: 1, target: 3, label: 'Requests' },
    { source: 3, target: 4, label: 'API Calls' },
    { source: 4, target: 2, label: 'Queries' },
    { source: 4, target: 5, label: 'Caching' },
  ],
};

export const Basic: Story = {
  args: {
    data: sampleData,
    config: {},
    width: 800,
    height: 600,
    showControls: true,
    showLegend: true,
    showTooltip: true,
  },
};

export const WithCustomStyling: Story = {
  args: {
    data: sampleData,
    config: NetworkConfigBuilderService
      .create()
      .withNodeSize(20)
      .withNodeColors(['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'])
      .withLinkWidth(3)
      .withTooltip(true)
      .withLegend(true, 'top-right')
      .build(),
    width: 800,
    height: 600,
    showControls: true,
    showLegend: true,
    showTooltip: true,
  },
};

export const PerformanceOptimized: Story = {
  args: {
    data: {
      nodes: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        label: `Node ${i}`,
        group: Math.floor(i / 20),
        size: Math.random() * 10 + 5,
      })),
      links: Array.from({ length: 150 }, (_, i) => ({
        source: Math.floor(Math.random() * 100),
        target: Math.floor(Math.random() * 100),
      })),
    },
    config: NetworkConfigBuilderService
      .create()
      .withPreset('performance')
      .build(),
    width: 800,
    height: 600,
    showControls: true,
    showLegend: false,
    showTooltip: false,
  },
};

export const DarkTheme: Story = {
  args: {
    data: sampleData,
    config: NetworkConfigBuilderService
      .create()
      .withPreset('analytical')
      .withTheme('dark')
      .build(),
    width: 800,
    height: 600,
    showControls: true,
    showLegend: true,
    showTooltip: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const WithZoomConfiguration: Story = {
  args: {
    data: sampleData,
    config: NetworkConfigBuilderService
      .create()
      .withInitialZoom(1.5, { x: 100, y: 100 })
      .withZoomOnLoad('center')
      .withSmoothZoom(1000)
      .build(),
    width: 800,
    height: 600,
    showControls: true,
    showLegend: true,
    showTooltip: true,
  },
};

export const Interactive: Story = {
  args: {
    data: sampleData,
    config: NetworkConfigBuilderService
      .create()
      .withInteractions({
        enableHover: true,
        enableClick: true,
        enableDrag: true,
        enableZoom: true,
        enableRightClick: true,
      })
      .withCustomTooltip((node) => `
        <div style="font-weight: bold; color: #4ecdc4;">${node.label}</div>
        <div>Group: ${node.group}</div>
        <div>Size: ${node.size}</div>
      `)
      .build(),
    width: 800,
    height: 600,
    showControls: true,
    showLegend: true,
    showTooltip: true,
  },
};
