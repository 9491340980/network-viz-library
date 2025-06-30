import { Component, Input, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LegendConfig, LegendItem, NodeShape } from '../../interfaces/network-visualization.interfaces';

@Component({
  selector: 'app-network-legend',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="network-legend"
         *ngIf="visible && visibleItems().length > 0"
         [class]="'legend-' + (legendConfig.position || 'top-right')"
         [style.max-width.px]="200"
         [style.max-height.px]="300"
         [style.background-color]="legendConfig.backgroundColor || 'rgba(255, 255, 255, 0.95)'"
         [style.color]="legendConfig.textColor || '#333'"
         [style.border]="'1px solid ' + (legendConfig.borderColor || '#ddd')"
         [style.border-radius.px]="legendConfig.borderRadius || 4"
         [style.padding.px]="legendConfig.padding || 10"
         [style.font-size.px]="legendConfig.fontSize || 12"
         [style.box-shadow]="'0 2px 4px rgba(0,0,0,0.1)'"
         [style.z-index]="100"
         role="region"
         aria-label="Legend">

      <div class="legend-items"
           [style.gap.px]="4">
        <div class="legend-item"
             *ngFor="let item of visibleItems(); trackBy: trackItem"
             [style.margin-bottom.px]="2">

          <!-- Symbol (Shape or Color) -->
          <div class="legend-symbol"
               [style.width.px]="getSymbolSize(item)"
               [style.height.px]="getSymbolSize(item)"
               [style.min-width.px]="getSymbolSize(item)"
               [style.background-color]="item.color || '#69b3a2'"
               [style.border-radius]="getShapeStyle(item.shape)"
               [style.border]="'1px solid transparent'"
               [attr.aria-label]="'Symbol for ' + item.label">

            <!-- Custom shape rendering for non-circle shapes -->
            <svg *ngIf="item.shape && item.shape !== 'circle'"
                 [attr.width]="getSymbolSize(item)"
                 [attr.height]="getSymbolSize(item)"
                 [style.display]="'block'">
              <path [attr.d]="getShapePath(item.shape, getSymbolSize(item) / 2)"
                    [attr.fill]="item.color || '#69b3a2'"
                    [attr.stroke]="'transparent'"
                    [attr.stroke-width]="1"
                    [attr.transform]="'translate(' + (getSymbolSize(item) / 2) + ',' + (getSymbolSize(item) / 2) + ')'">
              </path>
            </svg>
          </div>

          <!-- Label -->
          <span class="legend-label"
                [style.font-size.px]="legendConfig.fontSize || 12"
                [style.line-height]="'1.2'"
                [title]="item.label">
            {{ item.label }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .network-legend {
      position: absolute;
      overflow: auto;
      user-select: none;
    }

    .legend-top-left {
      top: 10px;
      left: 10px;
    }

    .legend-top-right {
      top: 10px;
      right: 10px;
    }

    .legend-bottom-left {
      bottom: 10px;
      left: 10px;
    }

    .legend-bottom-right {
      bottom: 10px;
      right: 10px;
    }

    .legend-items {
      display: flex;
      flex-direction: column;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }

    .legend-symbol {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .legend-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .network-legend {
        max-width: calc(100vw - 40px) !important;
        font-size: 11px !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkLegendComponent {
  @Input() items: LegendItem[] = [];
  @Input() config: LegendConfig = {};
  @Input() visible: boolean = true;

  get legendConfig(): LegendConfig {
    return {
      enabled: true,
      position: 'top-right',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      textColor: '#333',
      borderColor: '#ddd',
      borderRadius: 4,
      padding: 10,
      fontSize: 12,
      showShapes: true,
      showColors: true,
      showSizes: false,
      ...this.config
    };
  }

  constructor(private sanitizer: DomSanitizer) {}

  visibleItems = computed(() => {
    let filteredItems: LegendItem[] = [...this.items];

    // Filter by configuration
    if (!this.legendConfig.showColors) {
      filteredItems = filteredItems.filter(item => !item.color || item.shape || item.size);
    }

    if (!this.legendConfig.showShapes) {
      filteredItems = filteredItems.filter(item => !item.shape || item.color || item.size);
    }

    if (!this.legendConfig.showSizes) {
      filteredItems = filteredItems.filter(item => !item.size || item.color || item.shape);
    }

    return filteredItems;
  });

  trackItem(index: number, item: LegendItem): any {
    return item.label; // Using label since id might not exist
  }

  getSymbolSize(item: LegendItem): number {
    if (item.size !== undefined) {
      return Math.max(8, Math.min(24, item.size));
    }
    return 12; // Default size since symbolSize might not exist in config
  }

  getShapeStyle(shape?: NodeShape): string {
    if (!shape || shape === 'circle') {
      return '50%'; // Circular
    }
    if (shape === 'square') {
      return '0'; // Square corners
    }
    return '2px'; // Slightly rounded for other shapes
  }

  getShapePath(shape: NodeShape, radius: number): string {
    switch (shape) {
      case 'square':
        return `M ${-radius},${-radius} L ${radius},${-radius} L ${radius},${radius} L ${-radius},${radius} Z`;

      case 'triangle':
        const height = radius * Math.sqrt(3);
        return `M 0,${-height * 0.6} L ${radius},${height * 0.4} L ${-radius},${height * 0.4} Z`;

      case 'diamond':
        return `M 0,${-radius} L ${radius},0 L 0,${radius} L ${-radius},0 Z`;

      case 'star':
        return this.generateStarPath(radius);

      case 'hexagon':
        return this.generateHexagonPath(radius);

      default: // circle
        return `M 0,${-radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,${-radius}`;
    }
  }

  private generateStarPath(radius: number): string {
    const points: string[] = [];
    const outerRadius = radius;
    const innerRadius = radius * 0.4;

    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
    }

    return points.join(' ') + ' Z';
  }

  private generateHexagonPath(radius: number): string {
    const points: string[] = [];

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
    }

    return points.join(' ') + ' Z';
  }
}
