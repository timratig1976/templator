/**
 * Pipeline Monitoring Routes
 * Refactored modular monitoring system with separated concerns
 * 
 * This file serves as a clean re-export of the new modular monitoring system.
 * The original 1,552-line monolithic file has been broken down into:
 * - Controllers: Separated by domain (pipeline, quality, system, error, rawData)
 * - Services: Business logic and data collection
 * - Utils: Response formatting and utilities
 */

// Import and re-export the refactored modular monitoring routes
import monitoringRouter, { progressTracker, qualityDashboard, errorRecovery } from './monitoring/index';

// Export the services for use in other parts of the application
export { progressTracker, qualityDashboard, errorRecovery };

// Export the router as default
export default monitoringRouter;
