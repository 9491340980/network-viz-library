import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { NetworkData, NetworkEvent, NetworkVisualizationConfig, NetworkVisualizationV2Component } from 'dist/network-viz-lib';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule, NetworkVisualizationV2Component],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Network Visualization Demo';

  // State
  isLoading = false;
  isDarkTheme = false;
  statusMessage = 'Ready to visualize networks!';
  statusClass = 'success';

  // Event tracking
  eventLog: { timestamp: Date; message: string; type: string }[] = [];

  // Network data
  networkData: NetworkData = { nodes: [], links: [] };

  // Configuration
  networkConfig: NetworkVisualizationConfig = {
    nodeStyles: {
      defaultSize: 15,
      defaultShape: 'circle',
      defaultColor: '#69b3a2',
      defaultBorderColor: '#ffffff',
      defaultBorderWidth: 2,
      groupColors: {
        'A': '#ff6b6b',
        'B': '#4ecdc4',
        'C': '#45b7d1',
        'D': '#f9ca24',
        'E': '#6c5ce7',
        'F': '#fd79a8',
        'G': '#fdcb6e'
      }
    },
    linkStyles: {
      defaultColor: '#999999',
      defaultWidth: 2,
      defaultStyle: 'solid'
    },
    forceConfig: {
      enabled: true,
      chargeStrength: -300,
      linkDistance: 80,
      centerStrength: 0.3,
      collideRadius: 25,
      velocityDecay: 0.4,
      alphaDecay: 0.0228
    },
    interactionConfig: {
      enableHover: true,
      enableClick: true,
      enableDrag: true,
      enableZoom: true,
      enablePan: true
    },
    tooltipConfig: {
      enabled: true,
      showNodeId: true,
      showNodeLabel: true,
      showNodeGroup: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: 'white',
      fontSize: 12,
      maxWidth: 200,
      borderRadius: 4,
      padding: '8px 12px'
    },
    legendConfig: {
      enabled: true,
      position: 'top-right',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      textColor: '#333',
      borderColor: '#ddd',
      borderRadius: 4,
      padding: 10,
      fontSize: 12,
      showShapes: true,
      showColors: true
    },
    zoomConfig: {
      zoomOnLoad: 'fit',
      minZoom: 0.1,
      maxZoom: 5,
      animationDuration: 750
    }
  };

  constructor() {
    this.loadSampleData();
  }

  debugNetworkData(): void {
    console.log('🔍 Debugging Network Data...');
    console.log('Raw data:', this.networkData);

    // Check nodes
    console.log('📊 Nodes Analysis:');
    console.log('Node count:', this.networkData.nodes.length);
    console.log('Node IDs:', this.networkData.nodes.map(n => `${n.id} (${typeof n.id})`));

    // Check for duplicate IDs
    const nodeIds = this.networkData.nodes.map(n => n.id.toString());
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.warn('⚠️ Duplicate node IDs found:', duplicateIds);
    }

    // Check links
    console.log('🔗 Links Analysis:');
    console.log('Link count:', this.networkData.links.length);

    // Check each link
    this.networkData.links.forEach((link, index) => {
      const sourceId = (typeof link.source === 'object' ? link.source.id : link.source).toString();
      const targetId = (typeof link.target === 'object' ? link.target.id : link.target).toString();

      const sourceExists = this.networkData.nodes.some(n => n.id.toString() === sourceId);
      const targetExists = this.networkData.nodes.some(n => n.id.toString() === targetId);

      console.log(`Link ${index}: ${sourceId} -> ${targetId}`);

      if (!sourceExists) {
        console.error(`❌ Source node not found: ${sourceId}`);
      }
      if (!targetExists) {
        console.error(`❌ Target node not found: ${targetId}`);
      }
    });

    // Check for orphaned links
    const allNodeIds = new Set(this.networkData.nodes.map(n => n.id.toString()));
    const orphanedLinks = this.networkData.links.filter(link => {
      const sourceId = (typeof link.source === 'object' ? link.source.id : link.source).toString();
      const targetId = (typeof link.target === 'object' ? link.target.id : link.target).toString();
      return !allNodeIds.has(sourceId) || !allNodeIds.has(targetId);
    });

    if (orphanedLinks.length > 0) {
      console.error('🚨 Orphaned links found:', orphanedLinks);
    } else {
      console.log('✅ All links have valid node references');
    }
  }
  fixNetworkData(): void {
    console.log('🔧 Fixing network data...');

    // Ensure all node IDs are strings
    this.networkData.nodes.forEach(node => {
      if (typeof node.id !== 'string') {
        node.id = node.id.toString();
      }
    });

    // Filter out invalid links
    const validNodeIds = new Set(this.networkData.nodes.map(n => n.id.toString()));

    const originalLinkCount = this.networkData.links.length;
    this.networkData.links = this.networkData.links.filter(link => {
      const sourceId = (typeof link.source === 'object' ? link.source.id : link.source).toString();
      const targetId = (typeof link.target === 'object' ? link.target.id : link.target).toString();

      return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
    });

    // Update link source/target to be string IDs
    this.networkData.links.forEach(link => {
      if (typeof link.source === 'object') {
        link.source = link.source.id.toString();
      } else {
        link.source = link.source.toString();
      }

      if (typeof link.target === 'object') {
        link.target = link.target.id.toString();
      } else {
        link.target = link.target.toString();
      }
    });

    console.log(`✅ Fixed data: removed ${originalLinkCount - this.networkData.links.length} invalid links`);
    console.log('Updated data:', this.networkData);

    // Trigger re-render by creating new object reference
    this.networkData = { ...this.networkData };
  }
  loadSampleData(): void {
    this.isLoading = true;
    this.statusMessage = 'Loading sample network data...';
    this.statusClass = 'loading';

    setTimeout(() => {
      this.networkData = {
        nodes: [
          { id: '1', label: 'Alice', group: 'A', size: 25 },      // String IDs
          { id: '2', label: 'Bob', group: 'B', size: 20 },
          { id: '3', label: 'Charlie', group: 'A', size: 22 },
          { id: '4', label: 'Diana', group: 'C', size: 18 },
          { id: '5', label: 'Eve', group: 'B', size: 24 },
          { id: '6', label: 'Frank', group: 'C', size: 16 },
          { id: '7', label: 'Grace', group: 'D', size: 21 },
          { id: '8', label: 'Henry', group: 'D', size: 19 },
          { id: '9', label: 'Iris', group: 'E', size: 23 },
          { id: '10', label: 'Jack', group: 'E', size: 17 }
        ],
        links: [
          { source: '1', target: '2', value: 3, width: 3 },      // String IDs
          { source: '1', target: '3', value: 2, width: 2 },
          { source: '2', target: '4', value: 1, width: 2 },
          { source: '3', target: '5', value: 4, width: 4 },
          { source: '4', target: '6', value: 2, width: 2 },
          { source: '5', target: '7', value: 3, width: 3 },
          { source: '6', target: '8', value: 1, width: 2 },
          { source: '7', target: '9', value: 2, width: 2 },
          { source: '8', target: '10', value: 3, width: 3 },
          { source: '9', target: '10', value: 1, width: 2 },
          { source: '1', target: '5', value: 2, width: 2 },
          { source: '3', target: '7', value: 1, width: 2 },
          { source: '2', target: '8', value: 2, width: 2 },
          { source: '4', target: '9', value: 1, width: 2 }
        ]
      };

      this.isLoading = false;
      this.statusMessage = `✅ Loaded ${this.networkData.nodes.length} nodes and ${this.networkData.links.length} links successfully!`;
      this.statusClass = 'success';
      this.addEvent('system', 'Sample data loaded successfully');
    }, 1000);
  }

  addRandomNode(): void {
    const newId = Math.max(...this.networkData.nodes.map((n: any) => +n.id), 0) + 1;
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const names = ['Alex', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Quinn', 'Sage'];

    const randomGroup = groups[Math.floor(Math.random() * groups.length)];
    const randomName = names[Math.floor(Math.random() * names.length)];

    const newNode = {
      id: newId,
      label: `${randomName} ${newId}`,
      group: randomGroup,
      size: Math.floor(Math.random() * 10) + 15
    };

    // Add random connections
    const existingNodes = this.networkData.nodes;
    const numConnections = Math.min(Math.floor(Math.random() * 3) + 1, existingNodes.length);
    const newLinks = [];

    for (let i = 0; i < numConnections; i++) {
      const targetNode = existingNodes[Math.floor(Math.random() * existingNodes.length)];
      newLinks.push({
        source: newId,
        target: targetNode.id,
        value: Math.floor(Math.random() * 3) + 1,
        width: Math.floor(Math.random() * 3) + 2
      });
    }

    // Create new data object to trigger change detection
    this.networkData = {
      nodes: [...this.networkData.nodes, newNode],
      links: [...this.networkData.links, ...newLinks]
    };

    this.statusMessage = `Added ${newNode.label} with ${numConnections} connections`;
    this.addEvent('system', `Added node: ${newNode.label} (Group ${randomGroup})`);
  }

  clearData(): void {
    this.networkData = { nodes: [], links: [] };
    this.statusMessage = 'Network cleared - load sample data to start';
    this.statusClass = 'error';
    this.addEvent('system', 'Network data cleared');
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;

    if (this.isDarkTheme) {
      this.networkConfig = {
        ...this.networkConfig,
        backgroundColor: '#2c3e50',
        nodeStyles: {
          ...this.networkConfig.nodeStyles,
          defaultBorderColor: '#34495e'
        },
        tooltipConfig: {
          ...this.networkConfig.tooltipConfig,
          backgroundColor: 'rgba(52, 73, 94, 0.95)',
          textColor: '#ecf0f1'
        },
        legendConfig: {
          ...this.networkConfig.legendConfig,
          backgroundColor: 'rgba(52, 73, 94, 0.95)',
          textColor: '#ecf0f1',
          borderColor: '#34495e'
        }
      };
      this.statusMessage = 'Switched to dark theme';
    } else {
      this.networkConfig = {
        ...this.networkConfig,
        backgroundColor: '#ffffff',
        nodeStyles: {
          ...this.networkConfig.nodeStyles,
          defaultBorderColor: '#ffffff'
        },
        tooltipConfig: {
          ...this.networkConfig.tooltipConfig,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          textColor: 'white'
        },
        legendConfig: {
          ...this.networkConfig.legendConfig,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          textColor: '#333',
          borderColor: '#ddd'
        }
      };
      this.statusMessage = 'Switched to light theme';
    }

    this.addEvent('system', `Theme changed to ${this.isDarkTheme ? 'dark' : 'light'}`);
  }

  getUniqueGroups(): string[] {
    const groups = new Set(this.networkData.nodes.map((n: any) => n.group).filter((g: any) => g !== undefined));
    return Array.from(groups) as string[];
  }

  onNodeClick(event: NetworkEvent): void {
    if (event.data) {
      this.addEvent('nodeClick', `Clicked: ${event.data.label || event.data.id} (Group ${event.data.group})`);
    }
  }

  onNodeHover(event: NetworkEvent): void {
    if (event.data) {
      this.addEvent('nodeHover', `Hovered: ${event.data.label || event.data.id}`);
    }
  }

  onLinkClick(event: NetworkEvent): void {
    if (event.data) {
      const source = typeof event.data.source === 'object' ? event.data.source.id : event.data.source;
      const target = typeof event.data.target === 'object' ? event.data.target.id : event.data.target;
      this.addEvent('linkClick', `Clicked link: ${source} → ${target} (strength: ${event.data.value})`);
    }
  }

  onBackgroundClick(event: NetworkEvent): void {
    this.addEvent('backgroundClick', 'Clicked background - selection cleared');
  }

  private addEvent(type: string, message: string): void {
    this.eventLog.unshift({
      type,
      message,
      timestamp: new Date()
    });

    // Keep only last 50 events
    if (this.eventLog.length > 50) {
      this.eventLog = this.eventLog.slice(0, 50);
    }
  }
}
