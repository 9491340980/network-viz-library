import { Component, Input, ChangeDetectionStrategy, computed, signal, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NetworkLink, NetworkNode, TooltipConfig } from '../../interfaces/network-visualization.interfaces';

@Component({
  selector: 'app-network-tooltip',
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
         [style.z-index]="1000"
         [style.pointer-events]="'none'"
         [style.box-shadow]="'0 2px 4px rgba(0,0,0,0.2)'"
         role="tooltip"
         [attr.aria-hidden]="!visible">
      <div [innerHTML]="safeContent()"></div>
    </div>
  `,
  styles: [`
    .network-tooltip {
      position: absolute;
      transition: opacity 0.2s ease-in-out;
      word-wrap: break-word;
      white-space: nowrap;
    }

    .network-tooltip[aria-hidden="true"] {
      opacity: 0;
    }

    .network-tooltip[aria-hidden="false"] {
      opacity: 1;
    }

    .tooltip-section {
      margin-bottom: 4px;
    }

    .tooltip-section:last-child {
      margin-bottom: 0;
    }

    .tooltip-label {
      font-weight: bold;
    }

    .tooltip-value {
      margin-left: 4px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkTooltipComponent {
  @Input() node: NetworkNode | null = null;
  @Input() link: NetworkLink | null = null;
  @Input() config: TooltipConfig = {};
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() visible: boolean = false;

  get tooltipConfig(): TooltipConfig {
    return {
      enabled: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      textColor: 'white',
      fontSize: 12,
      maxWidth: 200,
      borderRadius: 4,
      padding: '8px 12px',
      showNodeId: true,
      showNodeLabel: true,
      showNodeGroup: true,
      showNodeCategory: true,
      showDelay: 200,
      hideDelay: 100,
      ...this.config
    };
  }

  constructor(private sanitizer: DomSanitizer) {}

  safeContent = computed(() => {
    if (!this.visible) return '';

    let content = '';

    if (this.node) {
      content = this.generateNodeContent(this.node);
    } else if (this.link) {
      content = this.generateLinkContent(this.link);
    }

    return this.sanitizer.sanitize(SecurityContext.HTML, content) || '';
  });

  private generateNodeContent(node: NetworkNode): string {
    const config = this.tooltipConfig;

    // Use custom template if provided
    if (config.customTemplate) {
      return config.customTemplate(node);
    }

    const sections: string[] = [];

    // Node ID
    if (config.showNodeId !== false) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">ID:</span>
        <span class="tooltip-value">${this.escapeHtml(node.id.toString())}</span>
      </div>`);
    }

    // Node Label
    if (config.showNodeLabel !== false && node.label && node.label !== node.id) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Label:</span>
        <span class="tooltip-value">${this.escapeHtml(node.label)}</span>
      </div>`);
    }

    // Node Group
    if (config.showNodeGroup !== false && node.group !== undefined) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Group:</span>
        <span class="tooltip-value">${this.escapeHtml(node.group.toString())}</span>
      </div>`);
    }

    // Node Category
    if (config.showNodeCategory !== false && node.category) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Category:</span>
        <span class="tooltip-value">${this.escapeHtml(node.category)}</span>
      </div>`);
    }

    // Node Size
    if (node.size !== undefined) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Size:</span>
        <span class="tooltip-value">${node.size}</span>
      </div>`);
    }

    // Custom Fields
    if (config.showCustomFields && config.showCustomFields.length > 0) {
      config.showCustomFields.forEach(field => {
        if (node[field] !== undefined && node[field] !== null) {
          const fieldName = this.formatFieldName(field);
          const fieldValue = this.formatFieldValue(node[field]);
          sections.push(`<div class="tooltip-section">
            <span class="tooltip-label">${this.escapeHtml(fieldName)}:</span>
            <span class="tooltip-value">${this.escapeHtml(fieldValue)}</span>
          </div>`);
        }
      });
    }

    return sections.length > 0 ? sections.join('') : `<div class="tooltip-section">Node ${this.escapeHtml(node.id.toString())}</div>`;
  }

  private generateLinkContent(link: NetworkLink): string {
    const config = this.tooltipConfig;

    // Use custom link template if provided
    if (config.customLinkTemplate) {
      return config.customLinkTemplate(link);
    }

    const sections: string[] = [];

    // Source and Target
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    sections.push(`<div class="tooltip-section">
      <span class="tooltip-label">Link:</span>
      <span class="tooltip-value">${this.escapeHtml(sourceId.toString())} → ${this.escapeHtml(targetId.toString())}</span>
    </div>`);

    // Link Label
    if (link.label) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Label:</span>
        <span class="tooltip-value">${this.escapeHtml(link.label)}</span>
      </div>`);
    }

    // Link Value/Weight
    if (link.value !== undefined) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Value:</span>
        <span class="tooltip-value">${link.value}</span>
      </div>`);
    }

    // Link Width
    if (link.width !== undefined) {
      sections.push(`<div class="tooltip-section">
        <span class="tooltip-label">Width:</span>
        <span class="tooltip-value">${link.width}</span>
      </div>`);
    }

    return sections.join('');
  }

  private formatFieldName(field: string): string {
    // Convert camelCase or snake_case to Title Case
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return value.toString();
      }
    }

    if (typeof value === 'number') {
      // Format numbers with appropriate precision
      if (value % 1 === 0) {
        return value.toString();
      } else {
        return value.toFixed(2);
      }
    }

    return value.toString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
