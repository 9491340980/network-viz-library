import { Injectable } from '@angular/core';
import {
  NetworkData,
  NetworkNode,
  NetworkLink,
  ValidationResult,
  NodeShape,
  LineStyle
} from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class NetworkDataService {

  /**
   * Validates network data structure and content
   */
  validateNetworkData(data: NetworkData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!data) {
      errors.push('Data is required');
      return { isValid: false, errors, warnings };
    }

    if (!Array.isArray(data.nodes)) {
      errors.push('Nodes must be an array');
    }

    if (!Array.isArray(data.links)) {
      errors.push('Links must be an array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Node validation
    const nodeIds = new Set<string | number>();
    data.nodes.forEach((node, index) => {
      if (!this.isValidNode(node)) {
        errors.push(`Invalid node at index ${index}`);
        return;
      }

      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      // Validate node properties
      if (node.size !== undefined && (typeof node.size !== 'number' || node.size <= 0)) {
        warnings.push(`Invalid size for node ${node.id}: must be a positive number`);
      }

      if (node.shape && !this.isValidNodeShape(node.shape)) {
        warnings.push(`Invalid shape for node ${node.id}: ${node.shape}`);
      }

      if (node.color && !this.isValidColor(node.color)) {
        warnings.push(`Invalid color for node ${node.id}: ${node.color}`);
      }
    });

    // Link validation
    data.links.forEach((link, index) => {
      if (!this.isValidLink(link)) {
        errors.push(`Invalid link at index ${index}`);
        return;
      }

      const sourceId = this.getLinkNodeId(link.source);
      const targetId = this.getLinkNodeId(link.target);

      if (!nodeIds.has(sourceId)) {
        errors.push(`Link ${index} references non-existent source node: ${sourceId}`);
      }

      if (!nodeIds.has(targetId)) {
        errors.push(`Link ${index} references non-existent target node: ${targetId}`);
      }

      if (sourceId === targetId) {
        warnings.push(`Self-referencing link at index ${index}`);
      }

      // Validate link properties
      if (link.value !== undefined && (typeof link.value !== 'number' || link.value < 0)) {
        warnings.push(`Invalid value for link ${index}: must be a non-negative number`);
      }

      if (link.width !== undefined && (typeof link.width !== 'number' || link.width <= 0)) {
        warnings.push(`Invalid width for link ${index}: must be a positive number`);
      }

      if (link.style && !this.isValidLineStyle(link.style)) {
        warnings.push(`Invalid style for link ${index}: ${link.style}`);
      }

      if (link.color && !this.isValidColor(link.color)) {
        warnings.push(`Invalid color for link ${index}: ${link.color}`);
      }
    });

    // Performance warnings
    if (data.nodes.length > 1000) {
      warnings.push(`Large dataset: ${data.nodes.length} nodes may impact performance`);
    }

    if (data.links.length > 5000) {
      warnings.push(`Large dataset: ${data.links.length} links may impact performance`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitizes and normalizes network data
   */
  sanitizeData(data: NetworkData): NetworkData {
    const sanitizedNodes = data.nodes.map(node => this.sanitizeNode(node));
    const sanitizedLinks = data.links.map(link => this.sanitizeLink(link));

    return {
      nodes: sanitizedNodes,
      links: sanitizedLinks
    };
  }

  /**
   * Transforms data to D3-compatible format
   */
  transformForD3(data: NetworkData): NetworkData {
    const nodeMap = new Map<string | number, NetworkNode>();

    // Create node map for link references
    data.nodes.forEach(node => {
      nodeMap.set(node.id, { ...node });
    });

    // Transform links to reference node objects
    const transformedLinks = data.links.map(link => ({
      ...link,
      source: nodeMap.get(this.getLinkNodeId(link.source)) || link.source,
      target: nodeMap.get(this.getLinkNodeId(link.target)) || link.target
    }));

    return {
      nodes: Array.from(nodeMap.values()),
      links: transformedLinks
    };
  }

  /**
   * Filters data based on criteria
   */
  filterData(data: NetworkData, criteria: {
    nodeFilter?: (node: NetworkNode) => boolean;
    linkFilter?: (link: NetworkLink) => boolean;
    includeConnectedNodes?: boolean;
  }): NetworkData {
    let filteredNodes = data.nodes;
    let filteredLinks = data.links;

    // Apply node filter
    if (criteria.nodeFilter) {
      filteredNodes = data.nodes.filter(criteria.nodeFilter);
    }

    // Apply link filter
    if (criteria.linkFilter) {
      filteredLinks = data.links.filter(criteria.linkFilter);
    }

    // Include connected nodes if specified
    if (criteria.includeConnectedNodes && criteria.linkFilter) {
      const connectedNodeIds = new Set<string | number>();
      filteredLinks.forEach(link => {
        connectedNodeIds.add(this.getLinkNodeId(link.source));
        connectedNodeIds.add(this.getLinkNodeId(link.target));
      });

      filteredNodes = data.nodes.filter(node =>
        connectedNodeIds.has(node.id) ||
        (criteria.nodeFilter && criteria.nodeFilter(node))
      );
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }

  /**
   * Calculates data statistics
   */
  calculateStatistics(data: NetworkData): {
    nodeCount: number;
    linkCount: number;
    avgDegree: number;
    maxDegree: number;
    minDegree: number;
    density: number;
    clusters: number;
  } {
    const nodeCount = data.nodes.length;
    const linkCount = data.links.length;

    if (nodeCount === 0) {
      return {
        nodeCount: 0,
        linkCount: 0,
        avgDegree: 0,
        maxDegree: 0,
        minDegree: 0,
        density: 0,
        clusters: 0
      };
    }

    // Calculate degree for each node
    const degrees = new Map<string | number, number>();
    data.nodes.forEach(node => degrees.set(node.id, 0));

    data.links.forEach(link => {
      const sourceId = this.getLinkNodeId(link.source);
      const targetId = this.getLinkNodeId(link.target);
      degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
      degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
    });

    const degreeValues = Array.from(degrees.values());
    const maxDegree = Math.max(...degreeValues);
    const minDegree = Math.min(...degreeValues);
    const avgDegree = degreeValues.reduce((sum, degree) => sum + degree, 0) / nodeCount;

    // Calculate density
    const maxPossibleLinks = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleLinks > 0 ? linkCount / maxPossibleLinks : 0;

    // Estimate clusters (connected components)
    const clusters = this.countConnectedComponents(data);

    return {
      nodeCount,
      linkCount,
      avgDegree,
      maxDegree,
      minDegree,
      density,
      clusters
    };
  }

  private isValidNode(node: any): node is NetworkNode {
    return node &&
           (typeof node.id === 'string' || typeof node.id === 'number') &&
           node.id !== null &&
           node.id !== undefined;
  }

  private isValidLink(link: any): link is NetworkLink {
    return link &&
           link.source !== null &&
           link.source !== undefined &&
           link.target !== null &&
           link.target !== undefined;
  }

  private isValidNodeShape(shape: string): shape is NodeShape {
    const validShapes: NodeShape[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];
    return validShapes.includes(shape as NodeShape);
  }

  private isValidLineStyle(style: string): style is LineStyle {
    const validStyles: LineStyle[] = ['solid', 'dashed', 'dotted'];
    return validStyles.includes(style as LineStyle);
  }

  private isValidColor(color: string): boolean {
    // Basic color validation (hex, rgb, named colors)
    const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|\w+)$/;
    return colorRegex.test(color);
  }

  private sanitizeNode(node: NetworkNode): NetworkNode {
    const sanitized: NetworkNode = {
      ...node
    };

    // Ensure required properties
    sanitized.id = node.id;

    // Ensure numeric properties are valid
    if (sanitized.size !== undefined) {
      sanitized.size = Math.max(0, Number(sanitized.size) || 0);
    }

    if (sanitized.x !== undefined) {
      sanitized.x = Number(sanitized.x) || 0;
    }

    if (sanitized.y !== undefined) {
      sanitized.y = Number(sanitized.y) || 0;
    }

    // Sanitize string properties
    if (sanitized.label !== undefined) {
      sanitized.label = String(sanitized.label);
    }

    return sanitized;
  }

  private sanitizeLink(link: NetworkLink): NetworkLink {
    const sanitized: NetworkLink = {
      ...link
    };

    // Ensure required properties
    sanitized.source = link.source;
    sanitized.target = link.target;

    // Ensure numeric properties are valid
    if (sanitized.value !== undefined) {
      sanitized.value = Math.max(0, Number(sanitized.value) || 0);
    }

    if (sanitized.width !== undefined) {
      sanitized.width = Math.max(0, Number(sanitized.width) || 1);
    }

    return sanitized;
  }

  private getLinkNodeId(node: string | number | NetworkNode): string | number {
    if (typeof node === 'string' || typeof node === 'number') {
      return node;
    }
    return node.id;
  }

  private countConnectedComponents(data: NetworkData): number {
    const visited = new Set<string | number>();
    const adjacencyList = new Map<string | number, Set<string | number>>();

    // Build adjacency list
    data.nodes.forEach(node => {
      adjacencyList.set(node.id, new Set());
    });

    data.links.forEach(link => {
      const sourceId = this.getLinkNodeId(link.source);
      const targetId = this.getLinkNodeId(link.target);
      adjacencyList.get(sourceId)?.add(targetId);
      adjacencyList.get(targetId)?.add(sourceId);
    });

    let components = 0;

    // DFS to find connected components
    const dfs = (nodeId: string | number) => {
      visited.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || new Set();
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          dfs(neighborId);
        }
      });
    };

    data.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        components++;
        dfs(node.id);
      }
    });

    return components;
  }
}
