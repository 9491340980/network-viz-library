// interfaces/plugin.interfaces.ts

import { NetworkData, NetworkEvent, NetworkLink, NetworkNode } from "../interfaces/network-visualization.interfaces";

export interface PluginAction {
  id: string;
  label: string;
  icon?: string;
  category?: string;
  execute: () => void;
}

export interface PluginContext {
  // Core data access
  getData(): NetworkData;

  // SVG and DOM access
  getSvgElement(): SVGElement | null;

  // State management
  setState(key: string, value: any): void;
  getState(key: string): any;

  // Zoom and transform
  getZoomTransform(): { scale: number; translate: [number, number] } | undefined;

  // Configuration access
  getConfig(): any;

  // Additional context properties
  data?: NetworkData;
  config?: any;
  svg?: any;
  injector?: any;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags?: string[];
}

export interface PluginHooks {
  onInit?: (context: PluginContext) => void;
  onDestroy?: () => void;
  onDataChange?: (context: PluginContext, data: NetworkData) => void;
  onZoomChange?: (context: PluginContext, transform: { scale: number; translate: [number, number] }) => void;
  onNodeClick?: (context: PluginContext, event: NetworkEvent) => void;
  onNodeHover?: (context: PluginContext, event: NetworkEvent) => void;
  onBeforeRender?: (context: PluginContext) => void;
  onAfterRender?: (context: PluginContext) => void;
}

export abstract class BaseNetworkPlugin {
  abstract metadata: PluginMetadata;
  abstract actions: PluginAction[];
  abstract hooks: PluginHooks;

  // Lifecycle methods that can be overridden
  async install(context: PluginContext): Promise<void> {
    // Default implementation
    console.log(`Installing plugin: ${this.metadata.name}`);
  }

  async uninstall(context: PluginContext): Promise<void> {
    // Default implementation
    console.log(`Uninstalling plugin: ${this.metadata.name}`);
  }

  // Utility methods
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.metadata.name}] ${message}`, ...args);
  }

  protected error(message: string, error?: Error): void {
    console.error(`[${this.metadata.name}] ${message}`, error);
  }
}

// Legacy interface for compatibility
export interface NetworkPlugin {
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle hooks
  onInit?(context: PluginContext): void;
  onDestroy?(): void;

  // Data processing hooks
  onDataChange?(data: NetworkData): NetworkData;
  onNodeClick?(event: NetworkEvent): void;
  onNodeHover?(event: NetworkEvent): void;

  // Rendering hooks
  onBeforeRender?(context: RenderContext): void;
  onAfterRender?(context: RenderContext): void;

  // Custom functionality
  getActions?(): PluginAction[];
  getMenuItems?(): PluginMenuItem[];
}

export interface RenderContext {
  svg: any;
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface PluginMenuItem {
  id: string;
  label: string;
  action: () => void;
  separator?: boolean;
}
