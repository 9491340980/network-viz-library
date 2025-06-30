export interface NetworkNode {
  id: string | number;
  label?: string;
  group?: string | number;
  category?: string;
  size?: number;
  color?: string;
  shape?: NodeShape;
  borderColor?: string;
  borderWidth?: number;
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
  value?: number;
  color?: string;
  width?: number;
  style?: LineStyle;
  [key: string]: any;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export type NodeShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'hexagon';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

export interface TooltipConfig {
  enabled?: boolean;
  showNodeId?: boolean;
  showNodeLabel?: boolean;
  showNodeGroup?: boolean;
  showNodeCategory?: boolean;
  showCustomFields?: string[];
  customTemplate?: (node: NetworkNode) => string;
  customLinkTemplate?: (link: NetworkLink) => string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  maxWidth?: number;
  borderRadius?: number;
  padding?: string;
  showDelay?: number;
  hideDelay?: number;
}

export interface LabelConfig {
  enabled?: boolean;
  showFor?: 'all' | 'none' | 'selected' | 'hovered';
  field?: keyof NetworkNode | 'id' | 'label' | ((node: NetworkNode) => string);
  formatter?: (value: any, node: NetworkNode) => string;
  maxLength?: number;
  truncateStyle?: 'ellipsis' | 'middle' | 'none';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  offset?: { x: number; y: number };
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  showBackground?: boolean;
  wrapText?: boolean;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface NodeStyleConfig {
  defaultSize?: number;
  defaultColor?: string;
  defaultShape?: NodeShape;
  defaultBorderColor?: string;
  defaultBorderWidth?: number;
  defaultBorderStyle?: BorderStyle;
  defaultFillColor?: string;
  sizeRange?: [number, number];
  colorScheme?: string[];
  groupColors?: Record<string | number, string>;
  categoryStyles?: Record<string, Partial<NodeStyleConfig>>;
}

export interface LinkStyleConfig {
  defaultColor?: string;
  defaultWidth?: number;
  defaultStyle?: LineStyle;
  defaultStrength?: number;
  defaultDistance?: number;
  colorScheme?: string[];
  widthRange?: [number, number];
}

export interface ForceConfig {
  enabled?: boolean;
  strength?: number;
  centerStrength?: number;
  collideRadius?: number;
  linkStrength?: number;
  linkDistance?: number;
  chargeStrength?: number;
  velocityDecay?: number;
  alphaDecay?: number;
}

export interface InteractionConfig {
  enableHover?: boolean;
  enableClick?: boolean;
  enableRightClick?: boolean;
  enableTouch?: boolean;
  enableDrag?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  zoomExtent?: [number, number];
  doubleClickToFit?: boolean;
}

export interface ZoomConfig {
  initialZoom?: number;
  initialPosition?: { x: number; y: number };
  minZoom?: number;
  maxZoom?: number;
  zoomOnLoad?: 'fit' | 'center' | 'custom' | 'none';
  animationDuration?: number;
  smoothTransitions?: boolean;
}

export interface LegendConfig {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  fontSize?: number;
  showShapes?: boolean;
  showColors?: boolean;
  showSizes?: boolean;
  customItems?: LegendItem[];
}

export interface LegendItem {
  label: string;
  color?: string;
  shape?: NodeShape;
  size?: number;
}

export interface NetworkVisualizationConfig {
  width?: number;
  height?: number;
  nodeStyles?: NodeStyleConfig;
  linkStyles?: LinkStyleConfig;
  forceConfig?: ForceConfig;
  interactionConfig?: InteractionConfig;
  legendConfig?: LegendConfig;
  tooltipConfig?: TooltipConfig;
  labelConfig?: LabelConfig;
  zoomConfig?: ZoomConfig;
  backgroundColor?: string;
  // Deprecated properties for backward compatibility
  enableLegend?: boolean;
  enableTooltip?: boolean;
  enableLabels?: boolean;
  labelFontSize?: number;
  labelColor?: string;
}

export interface NetworkEvent<T = any> {
  type: 'nodeClick' | 'nodeHover' | 'nodeRightClick' | 'linkClick' | 'linkHover' | 'backgroundClick';
  data?: T;
  originalEvent?: Event;
  position?: { x: number; y: number };
}

export interface NetworkError {
  type: 'data' | 'rendering' | 'interaction' | 'configuration';
  message: string;
  originalError?: Error;
  context?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
