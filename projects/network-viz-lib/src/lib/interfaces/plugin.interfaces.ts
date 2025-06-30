// plugin.interfaces.ts
import { Observable } from 'rxjs';
import { NetworkNode, NetworkLink, NetworkData, NetworkEvent, NetworkVisualizationConfig } from './network-visualization.interfaces';

/**
 * Plugin metadata and configuration
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Plugin context provides access to visualization state and services
 */
export interface PluginContext {
  // Data access
  getData(): NetworkData;
  getConfig(): NetworkVisualizationConfig;
  getSelectedNodes(): Set<string | number>;
  getHoveredNode(): NetworkNode | null;

  // Visualization control
  updateData(data: Partial<NetworkData>): void;
  updateConfig(config: Partial<NetworkVisualizationConfig>): void;
  selectNodes(nodeIds: (string | number)[]): void;
  highlightNodes(nodeIds: (string | number)[], style?: any): void;

  // Events
  events$: Observable<NetworkEvent>;
  emit(event: NetworkEvent): void;

  // Rendering
  getSvgElement(): SVGElement | null;
  getZoomTransform(): { scale: number; translate: [number, number] } | null;
  zoomToFit(): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;

  // State management
  getState<T = any>(key: string): T | undefined;
  setState<T = any>(key: string, value: T): void;
  removeState(key: string): void;
}

/**
 * Plugin actions that can be triggered
 */
export interface PluginAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  category?: string;
  enabled?: boolean;
  visible?: boolean;
  execute: (context: PluginContext, ...args: any[]) => void | Promise<void>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  onInit?: (context: PluginContext) => void | Promise<void>;
  onDestroy?: (context: PluginContext) => void | Promise<void>;
  onDataChange?: (context: PluginContext, data: NetworkData) => void | Promise<void>;
  onConfigChange?: (context: PluginContext, config: NetworkVisualizationConfig) => void | Promise<void>;
  onNodeClick?: (context: PluginContext, event: NetworkEvent) => void | Promise<void>;
  onNodeHover?: (context: PluginContext, event: NetworkEvent) => void | Promise<void>;
  onLinkClick?: (context: PluginContext, event: NetworkEvent) => void | Promise<void>;
  onRender?: (context: PluginContext) => void | Promise<void>;
  onZoomChange?: (context: PluginContext, transform: { scale: number; translate: [number, number] }) => void | Promise<void>;
}

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  enabled?: boolean;
  priority?: number;
  settings?: Record<string, any>;
}

/**
 * Main plugin interface
 */
export interface NetworkPlugin {
  metadata: PluginMetadata;
  config?: PluginConfig;
  hooks?: PluginHooks;
  actions?: PluginAction[];

  // Plugin lifecycle
  install(context: PluginContext): void | Promise<void>;
  uninstall(context: PluginContext): void | Promise<void>;

  // Optional plugin methods
  configure?(settings: Record<string, any>): void;
  getSettingsSchema?(): any; // JSON Schema for plugin settings
  validate?(context: PluginContext): boolean | string[];
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  plugin: NetworkPlugin;
  context: PluginContext;
  installed: boolean;
  enabled: boolean;
  installDate: Date;
  lastUsed?: Date;
  errors?: string[];
}

/**
 * Plugin manager events
 */
export interface PluginManagerEvent {
  type: 'installed' | 'uninstalled' | 'enabled' | 'disabled' | 'error';
  pluginId: string;
  plugin?: NetworkPlugin;
  error?: Error;
  timestamp: Date;
}

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  success: boolean;
  pluginId: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiredDependencies: string[];
  missingDependencies: string[];
}

/**
 * Built-in plugin types for common functionality
 */
export abstract class BaseNetworkPlugin implements NetworkPlugin {
  abstract metadata: PluginMetadata;

  config: PluginConfig = {
    enabled: true,
    priority: 0,
    settings: {}
  };

  hooks: PluginHooks = {};
  actions: PluginAction[] = [];

  abstract install(context: PluginContext): void | Promise<void>;

  uninstall(context: PluginContext): void | Promise<void> {
    // Default implementation - override if needed
  }

  configure(settings: Record<string, any>): void {
    this.config.settings = { ...this.config.settings, ...settings };
  }

  validate(context: PluginContext): boolean | string[] {
    return true; // Default: always valid
  }
}

/**
 * Data processing plugin interface
 */
export interface DataProcessorPlugin extends NetworkPlugin {
  processData(data: NetworkData, context: PluginContext): NetworkData | Promise<NetworkData>;
}

/**
 * Visualization enhancement plugin interface
 */
export interface VisualizationPlugin extends NetworkPlugin {
  enhanceVisualization(svg: SVGElement, context: PluginContext): void | Promise<void>;
}

/**
 * Export plugin interface
 */
export interface ExportPlugin extends NetworkPlugin {
  export(format: string, options: any, context: PluginContext): string | Blob | Promise<string | Blob>;
  getSupportedFormats(): string[];
}

/**
 * Analysis plugin interface
 */
export interface AnalysisPlugin extends NetworkPlugin {
  analyze(data: NetworkData, options: any): any | Promise<any>;
  getAnalysisTypes(): string[];
}

/**
 * Layout plugin interface
 */
export interface LayoutPlugin extends NetworkPlugin {
  layout(nodes: NetworkNode[], links: NetworkLink[], options: any): NetworkNode[] | Promise<NetworkNode[]>;
  getLayoutTypes(): string[];
}

/**
 * Filter plugin interface
 */
export interface FilterPlugin extends NetworkPlugin {
  filter(data: NetworkData, criteria: any, context: PluginContext): NetworkData | Promise<NetworkData>;
  getFilterTypes(): string[];
}
