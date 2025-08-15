/**
 * Dead Code Controller (Scaffold)
 * Non-destructive endpoints to fetch the latest dead-code report and trigger a new scan.
 */

import { Request, Response } from 'express';
import { createLogger } from '../../../utils/logger';
import DeadCodeScanner from '../../../services/maintenance/DeadCodeScanner';
import { formatSuccessResponse, sendErrorResponse, formatJsonResponse } from '../utils/responseFormatter';

const logger = createLogger();
const scanner = new DeadCodeScanner();

/**
 * GET /api/monitoring/dead-code/report
 */
export const getDeadCodeReport = async (req: Request, res: Response) => {
  try {
    const report = scanner.getLatestReport();
    const payload = formatSuccessResponse({
      reportAvailable: !!report,
      report
    }, { endpoint: '/api/monitoring/dead-code/report' });
    formatJsonResponse(req, res, payload, 'Dead Code Report');
  } catch (err) {
    logger.error('Failed to read dead-code report', err);
    sendErrorResponse(res, 'Failed to read dead-code report');
  }
};

/**
 * POST /api/monitoring/dead-code/scan
 * Triggers a new scan and returns the new report. Non-destructive.
 */
export const runDeadCodeScan = async (req: Request, res: Response) => {
  try {
    const report = await scanner.scan();
    const payload = formatSuccessResponse(report, { endpoint: '/api/monitoring/dead-code/scan' });
    formatJsonResponse(req, res, payload, 'Dead Code Scan');
  } catch (err) {
    logger.error('Failed to run dead-code scan', err);
    sendErrorResponse(res, 'Failed to run dead-code scan');
  }
};
