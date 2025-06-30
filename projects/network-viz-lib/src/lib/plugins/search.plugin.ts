import { NetworkData, NetworkNode } from '../interfaces/network-visualization.interfaces';
import { BaseNetworkPlugin, PluginContext, PluginAction, NetworkPlugin } from '../interfaces/plugin.interfaces';
import * as d3 from 'd3';

export class SearchPlugin extends BaseNetworkPlugin {
  metadata = {
    id: 'search-plugin',
    name: 'Search',
    version: '1.0.0',
    description: 'Adds search functionality to find and highlight nodes',
    author: 'Network Team',
    tags: ['search', 'filter', 'highlight']
  };

  private searchContainer: HTMLElement | null = null;
  private context: PluginContext | null = null;

  override actions: PluginAction[] = [
    {
      id: 'focus-search',
      label: 'Search Nodes',
      icon: '🔍',
      category: 'Search',
      execute: () => this.focusSearch()
    },
    {
      id: 'clear-search',
      label: 'Clear Search',
      icon: '✖️',
      category: 'Search',
      execute: () => this.clearSearch()
    }
  ];

  override hooks = {
    onInit: (context: PluginContext) => {
      this.context = context;
      this.createSearchInterface();
    },
    onDataChange: (context: PluginContext, data: NetworkData) => {
      // Update search with new data if needed
      this.clearHighlight();
    },
    onDestroy: (context: PluginContext) => {
      this.removeSearchInterface();
    }
  };

  async install(context: PluginContext): Promise<void> {
    this.context = context;
    console.log('Search plugin installed');
  }

  override async uninstall(context: PluginContext): Promise<void> {
    this.removeSearchInterface();
    console.log('Search plugin uninstalled');
  }

  private createSearchInterface(): void {
    if (!this.context) return;

    const svgElement = this.context.getSvgElement();
    if (!svgElement) return;

    const container = svgElement.parentElement;
    if (!container) return;

    // Remove existing search interface if any
    this.removeSearchInterface();

    this.searchContainer = document.createElement('div');
    this.searchContainer.className = 'search-container';
    this.searchContainer.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search nodes...';
    searchInput.className = 'search-input';
    searchInput.style.cssText = `
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      width: 200px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: border-color 0.2s ease;
    `;

    // Create clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = '✖';
    clearButton.className = 'search-clear-button';
    clearButton.style.cssText = `
      padding: 8px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      transition: background-color 0.2s ease;
    `;

    // Add event listeners
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.searchNodes(query);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });

    clearButton.addEventListener('click', () => {
      this.clearSearch();
    });

    // Add hover effects
    searchInput.addEventListener('focus', () => {
      searchInput.style.borderColor = '#3498db';
    });

    searchInput.addEventListener('blur', () => {
      searchInput.style.borderColor = '#ccc';
    });

    clearButton.addEventListener('mouseenter', () => {
      clearButton.style.backgroundColor = '#f5f5f5';
    });

    clearButton.addEventListener('mouseleave', () => {
      clearButton.style.backgroundColor = 'white';
    });

    this.searchContainer.appendChild(searchInput);
    this.searchContainer.appendChild(clearButton);
    container.appendChild(this.searchContainer);
  }

  private searchNodes(query: string): void {
    if (!this.context) return;

    if (!query.trim()) {
      this.clearHighlight();
      return;
    }

    const data = this.context.getData();
    const matchingNodes = data.nodes.filter(node => {
      const label = node.label || node.id.toString();
      const category = node.category || '';
      const group = node.group?.toString() || '';

      const searchText = `${label} ${category} ${group}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    this.highlightNodes(matchingNodes);

    // Also highlight connected links
    if (matchingNodes.length > 0) {
      this.highlightConnectedLinks(matchingNodes, data);
    }
  }

  private highlightNodes(nodes: NetworkNode[]): void {
    if (!this.context) return;

    const svgElement = this.context.getSvgElement();
    if (!svgElement) return;

    const svg = d3.select(svgElement);
    const nodeIds = new Set(nodes.map(n => n.id));

    // Highlight matching nodes
    svg.selectAll('.node')
      .transition()
      .duration(300)
      .style('opacity', (d: any) => nodeIds.has(d.id) ? 1 : 0.2)
      .style('stroke-width', (d: any) => nodeIds.has(d.id) ? '3px' : '1px');

    // Dim non-matching links
    svg.selectAll('.link')
      .transition()
      .duration(300)
      .style('opacity', 0.1);
  }

  private highlightConnectedLinks(matchingNodes: NetworkNode[], data: NetworkData): void {
    if (!this.context) return;

    const svgElement = this.context.getSvgElement();
    if (!svgElement) return;

    const svg = d3.select(svgElement);
    const nodeIds = new Set(matchingNodes.map(n => n.id));

    // Find links connected to matching nodes
    const connectedLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return nodeIds.has(sourceId) || nodeIds.has(targetId);
    });

    const linkIndices = new Set(connectedLinks.map((_, index) => index));

    // Highlight connected links
    svg.selectAll('.link')
      .transition()
      .duration(300)
      .style('opacity', (d: any, i: number) => linkIndices.has(i) ? 0.6 : 0.1)
      .style('stroke-width', (d: any, i: number) => linkIndices.has(i) ? '2px' : '1px');
  }

  private clearHighlight(): void {
    if (!this.context) return;

    const svgElement = this.context.getSvgElement();
    if (!svgElement) return;

    const svg = d3.select(svgElement);

    // Reset all nodes and links to normal opacity
    svg.selectAll('.node')
      .transition()
      .duration(300)
      .style('opacity', 1)
      .style('stroke-width', '1px');

    svg.selectAll('.link')
      .transition()
      .duration(300)
      .style('opacity', 1)
      .style('stroke-width', '1px');
  }

  private clearSearch(): void {
    if (this.searchContainer) {
      const input = this.searchContainer.querySelector('.search-input') as HTMLInputElement;
      if (input) {
        input.value = '';
        input.focus();
      }
    }
    this.clearHighlight();
  }

  private focusSearch(): void {
    if (this.searchContainer) {
      const input = this.searchContainer.querySelector('.search-input') as HTMLInputElement;
      input?.focus();
    }
  }

  private removeSearchInterface(): void {
    if (this.searchContainer && this.searchContainer.parentElement) {
      this.searchContainer.parentElement.removeChild(this.searchContainer);
    }
    this.searchContainer = null;
  }
}
