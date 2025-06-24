export interface NetworkNode {
  id: string | number;
  label?: string;
  group?: string | number;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: any;
}

export interface NetworkLink {
  source: string | number | NetworkNode;
  target: string | number | NetworkNode;
  label?: string;
  weight?: number;
  color?: string;
  width?: number;
  [key: string]: any;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface NetworkConfig {
  width?: number;
  height?: number;
  nodeRadius?: number;
  linkWidth?: number;
  theme?: 'light' | 'dark' | 'corporate' | 'cyberpunk';
  interactions?: InteractionConfig;
  layout?: LayoutConfig;
  tooltip?: TooltipConfig;
  legend?: LegendConfig;
  performance?: PerformanceConfig;
}

export interface InteractionConfig {
  enableHover?: boolean;
  enableClick?: boolean;
  enableDrag?: boolean;
  enableZoom?: boolean;
  enableRightClick?: boolean;
}

export interface LayoutConfig {
  type?: 'force' | 'circular' | 'hierarchical' | 'grid';
  forceStrength?: number;
  linkDistance?: number;
  centerForce?: number;
}

export interface TooltipConfig {
  enabled?: boolean;
  template?: (node: NetworkNode) => string;
  position?: 'mouse' | 'fixed';
}

export interface LegendConfig {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  items?: LegendItem[];
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: 'circle' | 'square' | 'triangle';
}

export interface PerformanceConfig {
  enableOptimizations?: boolean;
  maxNodes?: number;
  renderMode?: 'canvas' | 'svg' | 'webgl';
  throttleDelay?: number;
}

export interface NetworkEvent {
  type: 'nodeClick' | 'nodeHover' | 'linkClick' | 'linkHover' | 'backgroundClick';
  data?: NetworkNode | NetworkLink;
  event?: Event;
}
