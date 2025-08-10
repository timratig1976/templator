import { createLogger } from '../utils/logger';

const logger = createLogger();

// Matches data URL for common image types and captures the base64 payload
const DATA_URL_REGEX = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,([A-Za-z0-9+/=\s]*)$/;

export function isValidBase64Image(base64String: string): boolean {
  try {
    if (!base64String || typeof base64String !== 'string') {
      logger.error('Invalid base64 string: not a string or empty');
      return false;
    }
    if (!base64String.startsWith('data:image/')) {
      logger.error('Invalid base64 string: does not start with data:image/');
      return false;
    }

    const match = base64String.match(DATA_URL_REGEX);
    if (!match) {
      logger.error('Invalid base64 string: does not match expected format');
      logger.error('String preview:', base64String.substring(0, 100) + '...');
      return false;
    }

    const base64Part = match[2].replace(/\s/g, '');
    const validBase64Regex = /^[A-Za-z0-9+/=]*$/;
    if (!validBase64Regex.test(base64Part)) {
      logger.error('Invalid base64 string: contains invalid characters');
      return false;
    }

    // Strict base64 length and padding rules
    if (base64Part.length === 0 || base64Part.length % 4 !== 0) {
      logger.error('Invalid base64 string: length must be multiple of 4', { length: base64Part.length });
      return false;
    }

    // '=' padding allowed only at the end, max two characters
    const firstPad = base64Part.indexOf('=');
    if (firstPad !== -1) {
      // No '=' allowed before the last two characters
      if (firstPad < base64Part.length - 2) {
        logger.error('Invalid base64 string: padding character found in the middle');
        return false;
      }
      const padCount = base64Part.length - firstPad;
      if (padCount > 2) {
        logger.error('Invalid base64 string: too many padding characters');
        return false;
      }
      // Ensure all trailing characters are '='
      const trailing = base64Part.slice(firstPad);
      if (!/^=+$/.test(trailing)) {
        logger.error('Invalid base64 string: invalid trailing padding sequence');
        return false;
      }
    }

    return true;
  } catch (err) {
    logger.error('Base64 validation threw error', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export function extractBase64Part(base64String: string): string | null {
  const match = base64String.match(DATA_URL_REGEX);
  if (!match) return null;
  return match[2].replace(/\s/g, '');
}

export function getImageMimeFromDataUrl(base64String: string): string | null {
  const match = base64String.match(DATA_URL_REGEX);
  if (!match) return null;
  return `image/${match[1]}`;
}
