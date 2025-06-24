// Core Network Interfaces
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
  borderStyle?: BorderStyle;
  fillColor?: string;
  x?: number;
  y?: number;
  fx?: number; // Fixed position
  fy?: number;
  [key: string]: any; // Allow custom properties
}

export interface NetworkLink {
  source: string | number | NetworkNode;
  target: string | number | NetworkNode;
  id?: string;
  label?: string;
  color?: string;
  width?: number;
  style?: LineStyle;
  strength?: number;
  distance?: number;
  [key: string]: any;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

// Shape and Style Types
export type NodeShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'hexagon';
export type BorderStyle = 'solid' | 'dashed' | 'dotted';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

// Configuration Interfaces
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

export interface LegendItem {
  label: string;
  color: string;
  shape?: NodeShape;
  size?: number;
  visible?: boolean;
}

export interface LegendConfig {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  customPosition?: { x: number; y: number };
  orientation?: 'vertical' | 'horizontal';
  title?: string;
  maxWidth?: number;
  maxHeight?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  fontSize?: number;
  itemSpacing?: number;
  symbolSize?: number;
  customItems?: LegendItem[];
  showGroupColors?: boolean;
  showCategoryColors?: boolean;
  itemTemplate?: (item: LegendItem) => string;
}

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
  // Backward compatibility
  enableLegend?: boolean;
  enableTooltip?: boolean;
  enableLabels?: boolean;
  labelFontSize?: number;
  labelColor?: string;
}

// Event Interfaces
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

// Validation Interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Plugin Interfaces
export interface PluginContext {
  data: NetworkData;
  config: NetworkVisualizationConfig;
  svg: any;
  injector: any;
}

export interface RenderContext {
  svg: any;
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface PluginAction {
  id: string;
  label: string;
  icon?: string;
  execute: () => void;
}

export interface PluginMenuItem {
  id: string;
  label: string;
  action: () => void;
  separator?: boolean;
}

export interface NetworkPlugin {
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle hooks
  onInit?(context: PluginContext): void;
  onDestroy?(): void;

  // Data processing hooks
  onDataChange?(data: NetworkData): NetworkData;
  onNodeClick?(event: NetworkEvent): void;
  onNodeHover?(event: NetworkEvent): void;

  // Rendering hooks
  onBeforeRender?(context: RenderContext): void;
  onAfterRender?(context: RenderContext): void;

  // Custom functionality
  getActions?(): PluginAction[];
  getMenuItems?(): PluginMenuItem[];
}
