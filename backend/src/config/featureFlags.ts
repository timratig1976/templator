/**
 * Feature flag helpers for pipeline logging and IR validation.
 * Defaults are conservative to avoid impacting current UI/flows.
 */

export type IRValidationMode = 'off' | 'log' | 'enforce';

export interface FeatureFlags {
  PIPELINE_LOGGING_ENABLED: boolean;
  IR_VALIDATION_MODE: IRValidationMode;
}

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function toIRMode(value: string | undefined, defaultValue: IRValidationMode): IRValidationMode {
  if (!value) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === 'off' || v === 'log' || v === 'enforce') return v as IRValidationMode;
  return defaultValue;
}

export function getFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    PIPELINE_LOGGING_ENABLED: toBoolean(env.PIPELINE_LOGGING_ENABLED, false),
    IR_VALIDATION_MODE: toIRMode(env.IR_VALIDATION_MODE, 'off'),
  };
}

export const FeatureFlagDefaults: FeatureFlags = {
  PIPELINE_LOGGING_ENABLED: false,
  IR_VALIDATION_MODE: 'off',
};
