import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import {
  NetworkPlugin,
  PluginContext,
  PluginAction,
  PluginRegistryEntry,
  PluginManagerEvent,
  PluginInstallResult,
  PluginValidationResult,
  PluginConfig
} from '../interfaces/plugin.interfaces';
import { NetworkData, NetworkEvent, NetworkVisualizationConfig, NetworkNode } from '../interfaces/network-visualization.interfaces';
import { NetworkStateService } from './network-state.service';
import { NetworkRendererService } from './network-renderer.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkPluginService {
  private plugins = new Map<string, PluginRegistryEntry>();
  private pluginEvents$ = new Subject<PluginManagerEvent>();
  private actions$ = new BehaviorSubject<PluginAction[]>([]);
  private pluginState = new Map<string, Map<string, any>>();

  constructor(
    private stateService: NetworkStateService,
    private rendererService: NetworkRendererService
  ) {
    this.initializeBuiltInPlugins();
  }

  /**
   * Plugin manager events
   */
  get events(): Observable<PluginManagerEvent> {
    return this.pluginEvents$.asObservable();
  }

  /**
   * Available plugin actions
   */
  get actions(): Observable<PluginAction[]> {
    return this.actions$.asObservable();
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): PluginRegistryEntry[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins only
   */
  getEnabledPlugins(): PluginRegistryEntry[] {
    return this.getPlugins().filter(entry => entry.enabled);
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): PluginRegistryEntry | undefined {
    return this.plugins.get(id);
  }

  /**
   * Install a plugin
   */
  async installPlugin(plugin: NetworkPlugin, config?: PluginConfig): Promise<PluginInstallResult> {
    try {
      // Validate plugin
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        return {
          success: false,
          pluginId: plugin.metadata.id,
          errors: validation.errors
        };
      }

      // Check if already installed
      if (this.plugins.has(plugin.metadata.id)) {
        return {
          success: false,
          pluginId: plugin.metadata.id,
          errors: ['Plugin is already installed']
        };
      }

      // Create plugin context
      const context = this.createPluginContext(plugin.metadata.id);

      // Create registry entry
      const entry: PluginRegistryEntry = {
        plugin,
        context,
        installed: false,
        enabled: config?.enabled ?? true,
        installDate: new Date(),
        errors: []
      };

      // Install plugin
      await plugin.install(context);

      // Configure plugin
      if (config?.settings && plugin.configure) {
        plugin.configure(config.settings);
      }

      // Register plugin
      this.plugins.set(plugin.metadata.id, {
        ...entry,
        installed: true
      });

      // Update actions
      this.updateActions();

      // Emit event
      this.pluginEvents$.next({
        type: 'installed',
        pluginId: plugin.metadata.id,
        plugin,
        timestamp: new Date()
      });

      return {
        success: true,
        pluginId: plugin.metadata.id,
        warnings: validation.warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        pluginId: plugin.metadata.id,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      const entry = this.plugins.get(pluginId);
      if (!entry) {
        return false;
      }

      // Uninstall plugin
      await entry.plugin.uninstall(entry.context);

      // Remove from registry
      this.plugins.delete(pluginId);

      // Clean up plugin state
      this.pluginState.delete(pluginId);

      // Update actions
      this.updateActions();

      // Emit event
      this.pluginEvents$.next({
        type: 'uninstalled',
        pluginId,
        plugin: entry.plugin,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error(`Error uninstalling plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Enable a plugin
   */
  enablePlugin(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry || !entry.installed) {
      return false;
    }

    entry.enabled = true;
    this.updateActions();

    this.pluginEvents$.next({
      type: 'enabled',
      pluginId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Disable a plugin
   */
  disablePlugin(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return false;
    }

    entry.enabled = false;
    this.updateActions();

    this.pluginEvents$.next({
      type: 'disabled',
      pluginId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Execute a plugin action
   */
  async executeAction(actionId: string, ...args: unknown[]): Promise<boolean> {
    try {
      const action = this.findAction(actionId);
      if (!action) {
        return false;
      }

      const pluginEntry = this.findPluginByAction(actionId);
      if (!pluginEntry || !pluginEntry.enabled) {
        return false;
      }

      // Update last used
      pluginEntry.lastUsed = new Date();

      // Execute action
      await action.execute(pluginEntry.context, ...args);
      return true;
    } catch (error) {
      console.error(`Error executing action ${actionId}:`, error);
      return false;
    }
  }

  /**
   * Trigger plugin hooks
   */
  async triggerHook(hookName: keyof Required<NetworkPlugin>['hooks'], ...args: unknown[]): Promise<void> {
    const enabledPlugins = this.getEnabledPlugins();

    for (const entry of enabledPlugins) {
      try {
        const hook = entry.plugin.hooks?.[hookName] as ((...args: unknown[]) => void | Promise<void>) | undefined;
        if (hook) {
          await hook(entry.context, ...args);
        }
      } catch (error) {
        console.error(`Error in plugin ${entry.plugin.metadata.id} hook ${hookName}:`, error);
        entry.errors = entry.errors || [];
        entry.errors.push(`Hook ${hookName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    total: number;
    installed: number;
    enabled: number;
    disabled: number;
    errors: number;
  } {
    const plugins = this.getPlugins();

    return {
      total: plugins.length,
      installed: plugins.filter(p => p.installed).length,
      enabled: plugins.filter(p => p.enabled).length,
      disabled: plugins.filter(p => !p.enabled).length,
      errors: plugins.filter(p => p.errors && p.errors.length > 0).length
    };
  }

  private validatePlugin(plugin: NetworkPlugin): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredDependencies: string[] = [];
    const missingDependencies: string[] = [];

    // Validate metadata
    if (!plugin.metadata) {
      errors.push('Plugin metadata is required');
    } else {
      if (!plugin.metadata.id) errors.push('Plugin ID is required');
      if (!plugin.metadata.name) errors.push('Plugin name is required');
      if (!plugin.metadata.version) errors.push('Plugin version is required');
    }

    // Validate required methods
    if (typeof plugin.install !== 'function') {
      errors.push('Plugin must implement install method');
    }

    // Check dependencies
    if (plugin.metadata?.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        requiredDependencies.push(dep);
        if (!this.plugins.has(dep)) {
          missingDependencies.push(dep);
          errors.push(`Missing dependency: ${dep}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiredDependencies,
      missingDependencies
    };
  }

  private createPluginContext(pluginId: string): PluginContext {
    // Initialize plugin state
    if (!this.pluginState.has(pluginId)) {
      this.pluginState.set(pluginId, new Map());
    }

    const pluginStateMap = this.pluginState.get(pluginId)!;

    return {
      // Data access
      getData: () => this.stateService.currentData,
      getConfig: () => this.stateService.currentConfig,
      getSelectedNodes: () => this.stateService.currentState.selectedNodes,
      getHoveredNode: () => this.stateService.currentState.hoveredNode,

      // Visualization control
      updateData: (data: Partial<NetworkData>) => {
        const currentData = this.stateService.currentData;
        this.stateService.updateData({
          nodes: data.nodes || currentData.nodes,
          links: data.links || currentData.links
        });
      },
      updateConfig: (config: Partial<NetworkVisualizationConfig>) => {
        this.stateService.updateConfig(config);
      },
      selectNodes: (nodeIds: (string | number)[]) => {
        this.stateService.setSelectedNodes(nodeIds);
      },
      highlightNodes: (nodeIds: (string | number)[], style?: any) => {
        this.rendererService.highlightNodes(nodeIds, style);
      },

      // Events
      events$: this.rendererService.events,
      emit: (event: NetworkEvent) => {
        // Could emit to a global event bus if needed
      },

      // Rendering
      getSvgElement: () => {
        // Would need to get this from renderer service
        return null; // Placeholder
      },
      getZoomTransform: () => this.rendererService.getCurrentZoom(),
      zoomToFit: () => this.rendererService.zoomToFit(),
      zoomIn: () => this.rendererService.zoomIn(),
      zoomOut: () => this.rendererService.zoomOut(),
      resetView: () => this.rendererService.resetZoom(),

      // State management
      getState: <T>(key: string): T | undefined => {
        return pluginStateMap.get(key) as T;
      },
      setState: <T>(key: string, value: T): void => {
        pluginStateMap.set(key, value);
      },
      removeState: (key: string): void => {
        pluginStateMap.delete(key);
      }
    };
  }

  private updateActions(): void {
    const allActions: PluginAction[] = [];

    for (const entry of this.getEnabledPlugins()) {
      if (entry.plugin.actions) {
        allActions.push(...entry.plugin.actions);
      }
    }

    this.actions$.next(allActions);
  }

  private findAction(actionId: string): PluginAction | undefined {
    for (const entry of this.getEnabledPlugins()) {
      const action = entry.plugin.actions?.find(a => a.id === actionId);
      if (action) {
        return action;
      }
    }
    return undefined;
  }

  private findPluginByAction(actionId: string): PluginRegistryEntry | undefined {
    for (const entry of this.getEnabledPlugins()) {
      const hasAction = entry.plugin.actions?.some(a => a.id === actionId);
      if (hasAction) {
        return entry;
      }
    }
    return undefined;
  }

  private initializeBuiltInPlugins(): void {
    // Could register built-in plugins here
    // For example: export plugins, layout algorithms, etc.
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.pluginEvents$.complete();
    this.actions$.complete();
  }
}
