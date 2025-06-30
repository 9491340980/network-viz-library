import { NetworkLink } from './../interfaces/network-visualization.interfaces';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NetworkData, NetworkNode, NetworkVisualizationConfig } from '../interfaces/network-visualization.interfaces';

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // Approximate size in bytes
  ttl?: number; // Time to live in milliseconds
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  maxMemory: number; // Maximum memory usage in bytes
  defaultTTL: number; // Default time to live in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class NetworkCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private statistics$ = new BehaviorSubject<CacheStatistics>({
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
    missRate: 0,
    oldestEntry: null,
    newestEntry: null
  });

  private hits = 0;
  private misses = 0;
  private cleanupTimer: any;

  private readonly config: CacheConfig = {
    maxSize: 100,
    maxMemory: 50 * 1024 * 1024, // 50MB
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  };

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Cache statistics observable
   */
  get statistics(): Observable<CacheStatistics> {
    return this.statistics$.asObservable();
  }

  /**
   * Current cache statistics
   */
  get currentStatistics(): CacheStatistics {
    return this.statistics$.value;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const size = this.calculateSize(data);
    const entry: CacheEntry<T> = {
      data: this.deepClone(data),
      timestamp: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      size,
      ttl: ttl || this.config.defaultTTL
    };

    // Check if we need to make space
    this.ensureSpace(size);

    this.cache.set(key, entry);
    this.updateStatistics();
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      this.updateStatistics();
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      this.updateStatistics();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.hits++;
    this.updateStatistics();

    return this.deepClone(entry.data);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateStatistics();
      return false;
    }

    return true;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.updateStatistics();
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.updateStatistics();
  }

  /**
   * Get or set cached data with a provider function
   */
  getOrSet<T>(key: string, provider: () => T, ttl?: number): T {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = provider();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Cache network data with computed key
   */
  cacheNetworkData(data: NetworkData, config?: NetworkVisualizationConfig): string {
    const key = this.generateDataKey(data, config);
    this.set(key, data);
    return key;
  }

  /**
   * Get cached network data
   */
  getCachedNetworkData(data: NetworkData, config?: NetworkVisualizationConfig): NetworkData | null {
    const key = this.generateDataKey(data, config);
    return this.get<NetworkData>(key);
  }

  /**
   * Cache computed layouts
   */
  cacheLayout(dataKey: string, layout: { nodes: NetworkNode[], links: NetworkLink[] }): void {
    const key = `layout_${dataKey}`;
    this.set(key, layout, this.config.defaultTTL * 2); // Layouts last longer
  }

  /**
   * Get cached layout
   */
  getCachedLayout(dataKey: string): { nodes: NetworkNode[], links: NetworkLink[] } | null {
    const key = `layout_${dataKey}`;
    return this.get(key);
  }

  /**
   * Cache configuration presets
   */
  cacheConfigPreset(name: string, config: NetworkVisualizationConfig): void {
    const key = `preset_${name}`;
    this.set(key, config, this.config.defaultTTL * 10); // Presets last very long
  }

  /**
   * Get cached configuration preset
   */
  getCachedConfigPreset(name: string): NetworkVisualizationConfig | null {
    const key = `preset_${name}`;
    return this.get(key);
  }

  /**
   * Cache computed statistics
   */
  cacheStatistics(dataKey: string, stats: any): void {
    const key = `stats_${dataKey}`;
    this.set(key, stats);
  }

  /**
   * Get cached statistics
   */
  getCachedStatistics(dataKey: string): any | null {
    const key = `stats_${dataKey}`;
    return this.get(key);
  }

  /**
   * Prefetch data (cache without returning)
   */
  prefetch<T>(key: string, provider: () => T, ttl?: number): void {
    if (!this.has(key)) {
      const data = provider();
      this.set(key, data, ttl);
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    Object.assign(this.config, newConfig);

    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.stopCleanupTimer();
      this.startCleanupTimer();
    }

    // Clean up if size limits changed
    if (newConfig.maxSize || newConfig.maxMemory) {
      this.cleanup();
    }
  }

  /**
   * Manual cleanup of expired entries
   */
  cleanup(): void {
    const now = new Date();
    const toDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.cache.delete(key));

    // If still over limits, remove LRU entries
    this.ensureSpace(0);

    this.updateStatistics();
  }

  /**
   * Export cache for debugging
   */
  export(): any {
    const entries: any = {};

    this.cache.forEach((entry, key) => {
      entries[key] = {
        timestamp: entry.timestamp,
        lastAccessed: entry.lastAccessed,
        accessCount: entry.accessCount,
        size: entry.size,
        ttl: entry.ttl,
        hasData: !!entry.data
      };
    });

    return {
      statistics: this.currentStatistics,
      config: this.config,
      entries
    };
  }

  /**
   * Import cache configuration
   */
  import(exportedData: any): void {
    if (exportedData.config) {
      this.updateConfig(exportedData.config);
    }
  }

  private generateDataKey(data: NetworkData, config?: NetworkVisualizationConfig): string {
    // Create a hash of the data structure
    const dataHash = this.hashObject({
      nodeCount: data.nodes.length,
      linkCount: data.links.length,
      nodeIds: data.nodes.slice(0, 10).map(n => n.id), // Sample for performance
      linkPairs: data.links.slice(0, 10).map(l => `${l.source}-${l.target}`)
    });

    const configHash = config ? this.hashObject(config) : '';

    return `data_${dataHash}_${configHash}`;
  }

  private hashObject(obj: any): string {
    return btoa(JSON.stringify(obj)).replace(/[/+=]/g, '').substring(0, 16);
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2;
    }
  }

  private deepClone<T>(obj: T): T {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj; // Fallback for non-serializable objects
    }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp.getTime() > entry.ttl;
  }

  private ensureSpace(newEntrySize: number): void {
    // Check size limit
    while (this.cache.size >= this.config.maxSize) {
      this.removeLRU();
    }

    // Check memory limit
    let totalSize = this.calculateTotalSize();
    while (totalSize + newEntrySize > this.config.maxMemory && this.cache.size > 0) {
      this.removeLRU();
      totalSize = this.calculateTotalSize();
    }
  }

  private removeLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private calculateTotalSize(): number {
    let total = 0;
    this.cache.forEach(entry => {
      total += entry.size;
    });
    return total;
  }

  private updateStatistics(): void {
    const entries = Array.from(this.cache.values());
    const total = this.hits + this.misses;

    const stats: CacheStatistics = {
      totalEntries: this.cache.size,
      totalSize: this.calculateTotalSize(),
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.misses / total) * 100 : 0,
      oldestEntry: entries.length > 0 ?
        new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : null,
      newestEntry: entries.length > 0 ?
        new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : null
    };

    this.statistics$.next(stats);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}

// Re-export types for convenience
export type { NetworkNode, NetworkLink } from '../interfaces/network-visualization.interfaces';
