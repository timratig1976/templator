/**
 * Maintenance Dashboard Module Exports
 * Centralized exports for all maintenance dashboard components
 */

// Main Dashboard Component
export { default as MaintenanceDashboard } from './MaintenanceDashboard';

// Hooks
export { useMaintenanceData } from './hooks/useMaintenanceData';
export type { 
  SystemHealth, 
  BuildTestStatus, 
  QualityMetrics, 
  MaintenanceData, 
  UseMaintenanceDataReturn 
} from './hooks/useMaintenanceData';

// UI Components
export { default as Tooltip } from './ui/Tooltip';
export { default as Modal } from './ui/Modal';
export { default as RawDataModal } from './ui/RawDataModal';
export { default as TabNavigation } from './ui/TabNavigation';
export type { TooltipProps } from './ui/Tooltip';
export type { ModalProps } from './ui/Modal';
export type { RawDataModalProps } from './ui/RawDataModal';
export type { Tab, TabNavigationProps } from './ui/TabNavigation';

// Feature Components
export { default as SystemHealthCard } from './features/SystemHealthCard';
export { default as BuildTestCard } from './features/BuildTestCard';
export { default as QualityMetricsCard } from './features/QualityMetricsCard';
export type { SystemHealthCardProps } from './features/SystemHealthCard';
export type { BuildTestCardProps } from './features/BuildTestCard';
export type { QualityMetricsCardProps } from './features/QualityMetricsCard';

// Utilities
export {
  getQualityColors,
  getPercentageColors,
  getResponseTimeColors,
  getStatusColor,
  getStatusBgColor
} from './utils/colorUtils';
export type { ColorScheme } from './utils/colorUtils';
