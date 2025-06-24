import { Injectable } from '@angular/core';
import { NetworkData, NetworkNode, NetworkLink, ValidationResult, NodeShape } from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class NetworkDataService {

  /**
   * Validates network data structure and content
   */
  validateNetworkData(data: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!data) {
      result.isValid = false;
      result.errors.push('Data is null or undefined');
      return result;
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      result.isValid = false;
      result.errors.push('Data must contain a nodes array');
    } else if (data.nodes.length === 0) {
      result.warnings.push('Nodes array is empty');
    }

    if (!data.links || !Array.isArray(data.links)) {
      result.isValid = false;
      result.errors.push('Data must contain a links array');
    }

    // Validate individual nodes
    if (data.nodes) {
      data.nodes.forEach((node: any, index: number) => {
        if (!this.isValidNode(node)) {
          result.errors.push(`Invalid node at index ${index}: missing or invalid id`);
          result.isValid = false;
        }
      });
    }

    // Validate individual links
    if (data.links && data.nodes) {
      const nodeIds:any = new Set(data.nodes.map((n: any) => n.id));
      data.links.forEach((link: any, index: number) => {
        if (!this.isValidLink(link, nodeIds)) {
          result.errors.push(`Invalid link at index ${index}: invalid source or target`);
          result.isValid = false;
        }
      });
    }

    return result;
  }

  /**
   * Sanitizes and cleans network data
   */
  sanitizeData(data: NetworkData): NetworkData {
    return {
      nodes: data.nodes.map(node => this.sanitizeNode(node)),
      links: data.links.map(link => this.sanitizeLink(link))
    };
  }

  /**
   * Generates sample data for testing and demos
   */
  generateSampleData(type: 'simple' | 'complex' | 'large' = 'simple'): NetworkData {
    switch (type) {
      case 'simple':
        return this.generateSimpleData();
      case 'complex':
        return this.generateComplexData();
      case 'large':
        return this.generateLargeData();
      default:
        return this.generateSimpleData();
    }
  }

  private isValidNode(node: any): node is NetworkNode {
    return node &&
           (typeof node.id === 'string' || typeof node.id === 'number') &&
           node.id !== null &&
           node.id !== undefined;
  }

  private isValidLink(link: any, validNodeIds: Set<string | number>): boolean {
    if (!link) return false;

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
  }

  private sanitizeNode(node: NetworkNode): NetworkNode {
    const sanitized: NetworkNode = {
      id: node.id
    };

    // Only include valid properties
    if (node.label && typeof node.label === 'string') {
      sanitized.label = node.label.trim();
    }
    if (node.group !== undefined) sanitized.group = node.group;
    if (node.category && typeof node.category === 'string') {
      sanitized.category = node.category.trim();
    }
    if (typeof node.size === 'number' && node.size > 0) {
      sanitized.size = Math.max(1, Math.min(100, node.size)); // Clamp size
    }
    if (node.color && this.isValidColor(node.color)) {
      sanitized.color = node.color;
    }
    if (node.shape && this.isValidShape(node.shape)) {
      sanitized.shape = node.shape;
    }

    // Copy any custom properties
    Object.keys(node).forEach(key => {
      if (!sanitized.hasOwnProperty(key) && key !== 'id') {
        (sanitized as any)[key] = node[key];
      }
    });

    return sanitized;
  }

  private sanitizeLink(link: NetworkLink): NetworkLink {
    const sanitized: NetworkLink = {
      source: link.source,
      target: link.target
    };

    if (link.id) sanitized.id = link.id;
    if (link.label && typeof link.label === 'string') {
      sanitized.label = link.label.trim();
    }
    if (link.color && this.isValidColor(link.color)) {
      sanitized.color = link.color;
    }
    if (typeof link.width === 'number' && link.width > 0) {
      sanitized.width = Math.max(1, Math.min(20, link.width));
    }

    // Copy any custom properties
    Object.keys(link).forEach(key => {
      if (!sanitized.hasOwnProperty(key) && !['source', 'target'].includes(key)) {
        (sanitized as any)[key] = link[key];
      }
    });

    return sanitized;
  }

  private isValidColor(color: string): boolean {
    // Simple color validation
    return /^#([0-9A-F]{3}){1,2}$/i.test(color) ||
           /^rgb\(/i.test(color) ||
           /^rgba\(/i.test(color) ||
           ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'orange', 'purple', 'pink'].includes(color.toLowerCase());
  }

  private isValidShape(shape: string): shape is NodeShape {
    return ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'].includes(shape);
  }

  private generateSimpleData(): NetworkData {
    return {
      nodes: [
        { id: 1, label: 'Central Hub', group: 'Core', size: 20, color: '#ff6b6b' },
        { id: 2, label: 'Database', group: 'Storage', size: 15, color: '#4ecdc4' },
        { id: 3, label: 'Web Server', group: 'Frontend', size: 12, color: '#45b7d1' },
        { id: 4, label: 'API Gateway', group: 'Backend', size: 18, color: '#f9ca24' },
        { id: 5, label: 'Cache', group: 'Storage', size: 10, color: '#f0932b' }
      ],
      links: [
        { source: 1, target: 2, label: 'Data Flow' },
        { source: 1, target: 3, label: 'Requests' },
        { source: 3, target: 4, label: 'API Calls' },
        { source: 4, target: 2, label: 'Queries' },
        { source: 4, target: 5, label: 'Caching' }
      ]
    };
  }

  private generateComplexData(): NetworkData {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Generate 20 nodes with various properties
    for (let i = 1; i <= 20; i++) {
      nodes.push({
        id: i,
        label: `Node ${i}`,
        group: Math.floor((i - 1) / 5),
        category: i % 3 === 0 ? 'critical' : 'standard',
        size: Math.random() * 15 + 8,
        color: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'][i % 5],
        customProperty: `Custom value ${i}`
      });
    }

    // Generate 30 links
    for (let i = 0; i < 30; i++) {
      const source = Math.floor(Math.random() * 20) + 1;
      let target = Math.floor(Math.random() * 20) + 1;
      while (target === source) {
        target = Math.floor(Math.random() * 20) + 1;
      }

      links.push({
        source,
        target,
        label: `Link ${i + 1}`,
        strength: Math.random(),
        width: Math.random() * 4 + 1
      });
    }

    return { nodes, links };
  }

  private generateLargeData(): NetworkData {
    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Generate 100 nodes
    for (let i = 1; i <= 100; i++) {
      nodes.push({
        id: i,
        label: `Node ${i}`,
        group: Math.floor((i - 1) / 20),
        size: Math.random() * 10 + 5
      });
    }

    // Generate 150 links
    for (let i = 0; i < 150; i++) {
      const source = Math.floor(Math.random() * 100) + 1;
      let target = Math.floor(Math.random() * 100) + 1;
      while (target === source) {
        target = Math.floor(Math.random() * 100) + 1;
      }

      links.push({ source, target });
    }

    return { nodes, links };
  }
}
