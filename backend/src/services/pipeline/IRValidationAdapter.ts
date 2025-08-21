/**
 * IRValidationAdapter
 * Normalizes IR validation behavior and respects feature flags.
 * - off: skip validation, return valid
 * - log: pretend valid but capture errors for logging
 * - enforce: return actual validity (currently stubbed)
 */

import { getFeatureFlags, IRValidationMode } from '../../config/featureFlags';

export interface IRValidationResult {
  mode: IRValidationMode;
  isValid: boolean;
  errors?: Array<{ path?: string; message: string }>;
}

export class IRValidationAdapter {
  async validateIR(stepVersionId: string, ir: Record<string, any>): Promise<IRValidationResult> {
    const flags = getFeatureFlags();
    const mode = flags.IR_VALIDATION_MODE;

    if (mode === 'off') {
      return { mode, isValid: true };
    }

    // TODO: Load IR schema by stepVersionId and validate using AJV/Zod.
    const simulatedErrors: Array<{ path?: string; message: string }> = [];

    if (mode === 'log') {
      return { mode, isValid: true, errors: simulatedErrors };
    }

    // enforce
    const hasErrors = simulatedErrors.length > 0;
    return { mode, isValid: !hasErrors, errors: simulatedErrors };
  }
}
