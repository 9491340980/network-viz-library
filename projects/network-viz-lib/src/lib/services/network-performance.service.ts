import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, filter } from 'rxjs/operators';

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
  linkCount: number;
  fps: number;
  lastUpdate: Date;
  averageRenderTime: number;
  peakMemoryUsage: number;
  renderCount: number;
}

export interface PerformanceBenchmark {
  nodeCount: number;
  linkCount: number;
  renderTime: number;
  memoryUsage: number;
  fps: number;
  timestamp: Date;
  userAgent: string;
}

export interface PerformanceWarning {
  type: 'memory' | 'render' | 'fps' | 'dataset';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  metrics: Partial<PerformanceMetrics>;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkPerformanceService {
  private metrics$ = new BehaviorSubject<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    linkCount: 0,
    fps: 60,
    lastUpdate: new Date(),
    averageRenderTime: 0,
    peakMemoryUsage: 0,
    renderCount: 0
  });

  private warnings$ = new BehaviorSubject<PerformanceWarning[]>([]);
  private benchmarks: PerformanceBenchmark[] = [];

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private renderStartTime = 0;
  private renderTimes: number[] = [];
  private fpsHistory: number[] = [];
  private isMonitoring = false;

  // Thresholds for warnings
  private readonly THRESHOLDS = {
    renderTime: 100, // ms
    memoryUsage: 100, // MB
    fps: 30,
    largeDataset: { nodes: 1000, links: 5000 }
  };

  /**
   * Current performance metrics observable
   */
  get metrics(): Observable<PerformanceMetrics> {
    return this.metrics$.asObservable();
  }

  /**
   * Performance warnings observable
   */
  get warnings(): Observable<PerformanceWarning[]> {
    return this.warnings$.asObservable();
  }

  /**
   * Current metrics snapshot
   */
  get currentMetrics(): PerformanceMetrics {
    return this.metrics$.value;
  }

  /**
   * Current warnings snapshot
   */
  get currentWarnings(): PerformanceWarning[] {
    return this.warnings$.value;
  }

  /**
   * Start render time measurement
   */
  startRenderMeasurement(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * End render time measurement and update metrics
   */
  endRenderMeasurement(nodeCount: number, linkCount: number): void {
    const renderTime = performance.now() - this.renderStartTime;

    // Update render times history
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > 10) {
      this.renderTimes.shift();
    }

    const averageRenderTime = this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
    const renderCount = this.currentMetrics.renderCount + 1;

    // Measure memory usage
    const memoryUsage = this.measureMemoryUsage();
    const peakMemoryUsage = Math.max(this.currentMetrics.peakMemoryUsage, memoryUsage);

    // Update metrics
    const newMetrics: PerformanceMetrics = {
      ...this.currentMetrics,
      renderTime,
      memoryUsage,
      nodeCount,
      linkCount,
      averageRenderTime,
      peakMemoryUsage,
      renderCount,
      lastUpdate: new Date()
    };

    this.metrics$.next(newMetrics);

    // Check for performance issues
    this.checkPerformanceWarnings(newMetrics);

    // Store benchmark if significant
    if (nodeCount > 100 || linkCount > 200) {
      this.storeBenchmark(newMetrics);
    }
  }

  /**
   * Start continuous performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();

    // Monitor FPS every second
    interval(1000).pipe(
      filter(() => this.isMonitoring)
    ).subscribe(() => {
      this.updateFPS();
    });

    // Monitor memory usage every 5 seconds
    interval(5000).pipe(
      filter(() => this.isMonitoring)
    ).subscribe(() => {
      this.updateMemoryUsage();
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  /**
   * Record a frame for FPS calculation
   */
  recordFrame(): void {
    this.frameCount++;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: PerformanceMetrics;
    warnings: PerformanceWarning[];
    benchmarks: PerformanceBenchmark[];
    recommendations: string[];
  } {
    const current = this.currentMetrics;
    const warnings = this.currentWarnings;
    const recommendations = this.generateRecommendations(current, warnings);

    return {
      current,
      warnings,
      benchmarks: [...this.benchmarks],
      recommendations
    };
  }

  /**
   * Clear performance warnings
   */
  clearWarnings(): void {
    this.warnings$.next([]);
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.renderTimes = [];
    this.fpsHistory = [];
    this.benchmarks = [];
    this.clearWarnings();
  }

  /**
   * Export performance data
   */
  exportPerformanceData(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      metrics: this.currentMetrics,
      warnings: this.currentWarnings,
      benchmarks: this.benchmarks,
      history: {
        renderTimes: this.renderTimes,
        fpsHistory: this.fpsHistory
      }
    }, null, 2);
  }

  /**
   * Compare performance against benchmarks
   */
  comparePerformance(nodeCount: number, linkCount: number): {
    renderTimePercentile: number;
    memoryUsagePercentile: number;
    fpsPercentile: number;
    recommendations: string[];
  } {
    const similarBenchmarks = this.benchmarks.filter(b =>
      Math.abs(b.nodeCount - nodeCount) < nodeCount * 0.2 &&
      Math.abs(b.linkCount - linkCount) < linkCount * 0.2
    );

    if (similarBenchmarks.length < 3) {
      return {
        renderTimePercentile: 50,
        memoryUsagePercentile: 50,
        fpsPercentile: 50,
        recommendations: ['Not enough benchmark data for comparison']
      };
    }

    const current = this.currentMetrics;
    const renderTimes = similarBenchmarks.map(b => b.renderTime).sort((a, b) => a - b);
    const memoryUsages = similarBenchmarks.map(b => b.memoryUsage).sort((a, b) => a - b);
    const fpsList = similarBenchmarks.map(b => b.fps).sort((a, b) => b - a);

    const renderTimePercentile = this.calculatePercentile(renderTimes, current.renderTime);
    const memoryUsagePercentile = this.calculatePercentile(memoryUsages, current.memoryUsage);
    const fpsPercentile = this.calculatePercentile(fpsList, current.fps, true);

    const recommendations = this.generateComparisonRecommendations(
      renderTimePercentile,
      memoryUsagePercentile,
      fpsPercentile
    );

    return {
      renderTimePercentile,
      memoryUsagePercentile,
      fpsPercentile,
      recommendations
    };
  }

  /**
   * Get optimal configuration suggestions
   */
  getOptimalConfigSuggestions(nodeCount: number, linkCount: number): {
    forceConfig: any;
    interactionConfig: any;
    renderingConfig: any;
    reasoning: string[];
  } {
    const suggestions: {
      forceConfig: any;
      interactionConfig: any;
      renderingConfig: any;
      reasoning: string[];
    } = {
      forceConfig: {},
      interactionConfig: {},
      renderingConfig: {},
      reasoning: []
    };

    // Large dataset optimizations
    if (nodeCount > this.THRESHOLDS.largeDataset.nodes) {
      suggestions.forceConfig = {
        chargeStrength: -50,
        linkDistance: 20,
        velocityDecay: 0.6,
        alphaDecay: 0.05
      };
      suggestions.interactionConfig = {
        enableHover: false,
        enableTooltip: false
      };
      suggestions.renderingConfig = {
        nodeSize: 6,
        linkWidth: 1,
        enableLabels: false
      };
      suggestions.reasoning.push('Large dataset detected: reduced visual complexity for better performance');
    }

    // High link density optimizations
    if (linkCount > this.THRESHOLDS.largeDataset.links) {
      suggestions.forceConfig = {
        ...suggestions.forceConfig,
        linkDistance: Math.max(15, 30 - linkCount / 1000)
      };
      suggestions.reasoning.push('High link density: adjusted force parameters');
    }

    // Memory usage optimizations
    if (this.currentMetrics.memoryUsage > this.THRESHOLDS.memoryUsage) {
      suggestions.renderingConfig = {
        ...suggestions.renderingConfig,
        enableAnimations: false,
        simplifiedRendering: true
      };
      suggestions.reasoning.push('High memory usage: disabled animations and simplified rendering');
    }

    return suggestions;
  }

  private measureMemoryUsage(): number {
    if ((performance as any).memory) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }

  private updateFPS(): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    const fps = Math.round((this.frameCount * 1000) / deltaTime);

    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 10) {
      this.fpsHistory.shift();
    }

    const averageFps = this.fpsHistory.reduce((sum, f) => sum + f, 0) / this.fpsHistory.length;

    this.metrics$.next({
      ...this.currentMetrics,
      fps: averageFps,
      lastUpdate: new Date()
    });

    this.frameCount = 0;
    this.lastFrameTime = now;
  }

  private updateMemoryUsage(): void {
    const memoryUsage = this.measureMemoryUsage();
    const peakMemoryUsage = Math.max(this.currentMetrics.peakMemoryUsage, memoryUsage);

    this.metrics$.next({
      ...this.currentMetrics,
      memoryUsage,
      peakMemoryUsage,
      lastUpdate: new Date()
    });
  }

  private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
    const warnings: PerformanceWarning[] = [];

    // Render time warnings
    if (metrics.renderTime > this.THRESHOLDS.renderTime) {
      warnings.push({
        type: 'render',
        message: `Slow rendering detected: ${metrics.renderTime.toFixed(1)}ms`,
        severity: metrics.renderTime > this.THRESHOLDS.renderTime * 2 ? 'high' : 'medium',
        timestamp: new Date(),
        metrics: { renderTime: metrics.renderTime }
      });
    }

    // Memory warnings
    if (metrics.memoryUsage > this.THRESHOLDS.memoryUsage) {
      warnings.push({
        type: 'memory',
        message: `High memory usage: ${metrics.memoryUsage}MB`,
        severity: metrics.memoryUsage > this.THRESHOLDS.memoryUsage * 2 ? 'high' : 'medium',
        timestamp: new Date(),
        metrics: { memoryUsage: metrics.memoryUsage }
      });
    }

    // FPS warnings
    if (metrics.fps < this.THRESHOLDS.fps) {
      warnings.push({
        type: 'fps',
        message: `Low frame rate: ${metrics.fps.toFixed(1)} FPS`,
        severity: metrics.fps < this.THRESHOLDS.fps / 2 ? 'high' : 'medium',
        timestamp: new Date(),
        metrics: { fps: metrics.fps }
      });
    }

    // Large dataset warnings
    if (metrics.nodeCount > this.THRESHOLDS.largeDataset.nodes ||
        metrics.linkCount > this.THRESHOLDS.largeDataset.links) {
      warnings.push({
        type: 'dataset',
        message: `Large dataset: ${metrics.nodeCount} nodes, ${metrics.linkCount} links`,
        severity: 'low',
        timestamp: new Date(),
        metrics: { nodeCount: metrics.nodeCount, linkCount: metrics.linkCount }
      });
    }

    if (warnings.length > 0) {
      const currentWarnings = this.currentWarnings;
      const newWarnings = [...currentWarnings, ...warnings];

      // Keep only recent warnings (last 10)
      if (newWarnings.length > 10) {
        newWarnings.splice(0, newWarnings.length - 10);
      }

      this.warnings$.next(newWarnings);
    }
  }

  private storeBenchmark(metrics: PerformanceMetrics): void {
    const benchmark: PerformanceBenchmark = {
      nodeCount: metrics.nodeCount,
      linkCount: metrics.linkCount,
      renderTime: metrics.renderTime,
      memoryUsage: metrics.memoryUsage,
      fps: metrics.fps,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    };

    this.benchmarks.push(benchmark);

    // Keep only last 50 benchmarks
    if (this.benchmarks.length > 50) {
      this.benchmarks.shift();
    }
  }

  private generateRecommendations(metrics: PerformanceMetrics, warnings: PerformanceWarning[]): string[] {
    const recommendations: string[] = [];

    if (warnings.some(w => w.type === 'render' && w.severity === 'high')) {
      recommendations.push('Consider reducing node/link count or simplifying visual styles');
      recommendations.push('Disable animations and hover effects for better performance');
    }

    if (warnings.some(w => w.type === 'memory' && w.severity === 'high')) {
      recommendations.push('Consider data pagination or virtualization');
      recommendations.push('Reduce node/link visual complexity');
    }

    if (warnings.some(w => w.type === 'fps' && w.severity === 'high')) {
      recommendations.push('Reduce force simulation complexity');
      recommendations.push('Consider static layout instead of dynamic forces');
    }

    if (warnings.some(w => w.type === 'dataset')) {
      recommendations.push('Consider using performance-optimized configuration preset');
      recommendations.push('Implement data filtering or clustering');
    }

    return recommendations;
  }

  private calculatePercentile(values: number[], target: number, reverse = false): number {
    const position = values.findIndex(v => reverse ? v <= target : v >= target);
    if (position === -1) return reverse ? 0 : 100;
    return Math.round((position / values.length) * 100);
  }

  private generateComparisonRecommendations(
    renderPercentile: number,
    memoryPercentile: number,
    fpsPercentile: number
  ): string[] {
    const recommendations: string[] = [];

    if (renderPercentile > 75) {
      recommendations.push('Render time is slower than 75% of similar visualizations');
    }

    if (memoryPercentile > 75) {
      recommendations.push('Memory usage is higher than 75% of similar visualizations');
    }

    if (fpsPercentile < 25) {
      recommendations.push('Frame rate is lower than 75% of similar visualizations');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within normal range for this dataset size');
    }

    return recommendations;
  }
}
