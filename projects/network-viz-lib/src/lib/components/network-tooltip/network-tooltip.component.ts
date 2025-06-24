import { Component, Input, ChangeDetectionStrategy, computed, signal, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NetworkNode, TooltipConfig } from '../../interfaces/network-visualization.interfaces';

@Component({
  selector: 'nvl-network-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="network-tooltip"
         [style.display]="visible ? 'block' : 'none'"
         [style.left.px]="position.x"
         [style.top.px]="position.y"
         [style.background-color]="tooltipConfig.backgroundColor || 'rgba(0, 0, 0, 0.8)'"
         [style.color]="tooltipConfig.textColor || 'white'"
         [style.font-size.px]="tooltipConfig.fontSize || 12"
         [style.max-width.px]="tooltipConfig.maxWidth || 200"
         [style.border-radius.px]="tooltipConfig.borderRadius || 4"
         [style.padding]="tooltipConfig.padding || '8px 12px'"
         role="tooltip"
         [attr.aria-hidden]="!visible">
      <div [innerHTML]="safeContent()"></div>
    </div>
  `,
  styles: [`
    .network-tooltip {
      position: absolute;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: opacity 0.2s ease-in-out;
    }

    .network-tooltip[aria-hidden="true"] {
      opacity: 0;
    }

    .network-tooltip[aria-hidden="false"] {
      opacity: 1;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkTooltipComponent {
  @Input() node: NetworkNode | null = null;
  @Input() config: TooltipConfig = {};
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() visible: boolean = false;

  get tooltipConfig(): TooltipConfig {
    return {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: 'white',
      fontSize: 12,
      maxWidth: 200,
      borderRadius: 4,
      padding: '8px 12px',
      showNodeLabel: true,
      showNodeGroup: true,
      showNodeCategory: true,
      ...this.config
    };
  }

  safeContent = computed(() => {
    if (!this.node || !this.visible) return '';

    const content = this.generateContent(this.node);
    return this.sanitizer.sanitize(SecurityContext.HTML, content) || '';
  });

  constructor(private sanitizer: DomSanitizer) {}

  private generateContent(node: NetworkNode): string {
    const config = this.tooltipConfig;

    // Use custom template if provided
    if (config.customTemplate) {
      return config.customTemplate(node);
    }

    let content = '';

    if (config.showNodeLabel !== false && (node.label || config.showNodeId !== false)) {
      content += `<strong>${this.escapeHtml(node.label || node.id.toString())}</strong>`;
    } else if (config.showNodeId !== false) {
      content += `<strong>${this.escapeHtml(node.id.toString())}</strong>`;
    }

    if (config.showNodeGroup !== false && node.group) {
      content += `<br>Group: ${this.escapeHtml(node.group.toString())}`;
    }

    if (config.showNodeCategory !== false && node.category) {
      content += `<br>Category: ${this.escapeHtml(node.category)}`;
    }

    // Show custom fields
    if (config.showCustomFields) {
      config.showCustomFields.forEach(field => {
        if (node[field] !== undefined) {
          const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
          content += `<br>${this.escapeHtml(fieldName)}: ${this.escapeHtml(String(node[field]))}`;
        }
      });
    }

    return content || `Node ${this.escapeHtml(node.id.toString())}`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
