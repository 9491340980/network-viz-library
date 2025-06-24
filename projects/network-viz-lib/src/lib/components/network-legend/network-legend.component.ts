import { Component, Input, ChangeDetectionStrategy, computed, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LegendItem, LegendConfig } from '../../interfaces/network-visualization.interfaces';

@Component({
  selector: 'nvl-network-legend',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="network-legend"
         *ngIf="visible && items.length > 0"
         [class]="'legend-' + legendConfig.position"
         [style.left.px]="legendPosition().x"
         [style.top.px]="legendPosition().y"
         [style.max-width.px]="legendConfig.maxWidth"
         [style.max-height.px]="legendConfig.maxHeight"
         [style.background-color]="legendConfig.backgroundColor || 'rgba(255, 255, 255, 0.95)'"
         [style.border-color]="legendConfig.borderColor || '#ddd'"
         [style.border-radius.px]="legendConfig.borderRadius || 4"
         [style.padding.px]="legendConfig.padding || 10"
         [style.font-size.px]="legendConfig.fontSize || 12"
         role="region"
         aria-label="Legend">

      <h4 *ngIf="legendConfig.title" [style.margin]="'0 0 8px 0'">
        {{ legendConfig.title }}
      </h4>

      <div class="legend-items"
           [class.horizontal]="legendConfig.orientation === 'horizontal'"
           [style.gap.px]="legendConfig.itemSpacing || 4">
        <div class="legend-item"
             *ngFor="let item of visibleItems(); trackBy: trackItem"
             [innerHTML]="getSafeItemHtml(item)">
        </div>
      </div>
    </div>
  `,
  styles: [`
    .network-legend {
      position: absolute;
      border: 1px solid #ddd;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 100;
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

    .legend-custom {
      /* Position will be set via style binding */
    }

    .network-legend h4 {
      margin: 0 0 8px 0;
      font-weight: 600;
    }

    .legend-items {
      display: flex;
      flex-direction: column;
    }

    .legend-items.horizontal {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }

    .legend-symbol {
      flex-shrink: 0;
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
      position: 'bottom-left',
      orientation: 'vertical',
      maxWidth: 200,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderRadius: 4,
      padding: 10,
      fontSize: 12,
      itemSpacing: 4,
      symbolSize: 12,
      ...this.config
    };
  }

  visibleItems = computed(() => {
    return this.items.filter(item => item.visible !== false);
  });

  legendPosition = computed(() => {
    const config = this.legendConfig;

    if (config.position === 'custom' && config.customPosition) {
      return config.customPosition;
    }

    return { x: 0, y: 0 };
  });

  constructor(private sanitizer: DomSanitizer) {}

  getSafeItemHtml(item: LegendItem): SafeHtml | null {
    try {
      const config = this.legendConfig;

      if (config.itemTemplate) {
        const html = config.itemTemplate(item);
        return this.sanitizer.sanitize(SecurityContext.HTML, html);
      }

      const symbolSize = item.size || config.symbolSize || 12;
      const shape = item.shape || 'circle';

      let symbolHtml = this.generateSymbolHtml(shape, symbolSize, item.color);
      const html = `${symbolHtml}<span>${this.escapeHtml(item.label)}</span>`;

      return this.sanitizer.sanitize(SecurityContext.HTML, html);
    } catch (error) {
      console.warn('Error generating legend item HTML:', error);
      return null;
    }
  }

  trackItem(index: number, item: LegendItem): string {
    return `${item.label}_${item.color}_${item.shape}`;
  }

  private generateSymbolHtml(shape: string, size: number, color: string): string {
    const commonStyle = `width: ${size}px; height: ${size}px; background-color: ${color}; display: inline-block; margin-right: 6px;`;

    switch (shape) {
      case 'circle':
        return `<div class="legend-symbol" style="${commonStyle} border-radius: 50%;"></div>`;
      case 'square':
        return `<div class="legend-symbol" style="${commonStyle}"></div>`;
      case 'triangle':
        return `<div class="legend-symbol" style="width: 0; height: 0; border-left: ${size/2}px solid transparent; border-right: ${size/2}px solid transparent; border-bottom: ${size}px solid ${color}; display: inline-block; margin-right: 6px;"></div>`;
      case 'diamond':
        return `<div class="legend-symbol" style="${commonStyle} transform: rotate(45deg);"></div>`;
      default:
        return `<div class="legend-symbol" style="${commonStyle} border-radius: 2px;"></div>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
