import { isValidBase64Image, extractBase64Part, getImageMimeFromDataUrl } from '../../../utils/base64';

// Some small, valid base64 payloads (not necessarily real images, but valid base64 strings)
const VALID_BASE64 = 'AAA='; // length 4, valid padding
const VALID_BASE64_LONG = 'AQIDBAUGBwgJ'; // valid base64 without padding

// Minimal but valid-looking data URLs for supported types
const PNG_DATA_URL = `data:image/png;base64,${VALID_BASE64}`;
const JPEG_DATA_URL = `data:image/jpeg;base64,${VALID_BASE64_LONG}`;
const JPG_DATA_URL = `data:image/jpg;base64,${VALID_BASE64_LONG}`;
const GIF_DATA_URL = `data:image/gif;base64,${VALID_BASE64}`;
const WEBP_DATA_URL = `data:image/webp;base64,${VALID_BASE64}`;
const BMP_DATA_URL = `data:image/bmp;base64,${VALID_BASE64}`;
const SVG_DATA_URL = 'data:image/svg+xml;base64,PHN2Zy8+'; // '<svg/>' base64-ish

// Invalid variants
const MISSING_PREFIX = `${VALID_BASE64}`;
const WRONG_MIME = `data:text/plain;base64,${VALID_BASE64}`;
const INVALID_CHARS = 'data:image/png;base64,@@@!';
const BAD_PADDING = 'data:image/png;base64,A==='; // length 4 but invalid padding pattern (non-multiple 4 after strip handled by rule)

describe('utils/base64 image validation', () => {
  describe('isValidBase64Image()', () => {
    it('accepts supported image mime types with valid base64 payload', () => {
      expect(isValidBase64Image(PNG_DATA_URL)).toBe(true);
      expect(isValidBase64Image(JPEG_DATA_URL)).toBe(true);
      expect(isValidBase64Image(JPG_DATA_URL)).toBe(true);
      expect(isValidBase64Image(GIF_DATA_URL)).toBe(true);
      expect(isValidBase64Image(WEBP_DATA_URL)).toBe(true);
      expect(isValidBase64Image(BMP_DATA_URL)).toBe(true);
      expect(isValidBase64Image(SVG_DATA_URL)).toBe(true);
    });

    it('rejects strings without the data:image/ prefix', () => {
      expect(isValidBase64Image(MISSING_PREFIX)).toBe(false);
    });

    it('rejects unsupported mime types', () => {
      expect(isValidBase64Image(WRONG_MIME)).toBe(false);
    });

    it('rejects invalid base64 character sets', () => {
      expect(isValidBase64Image(INVALID_CHARS)).toBe(false);
    });

    it('rejects invalid base64 length/padding when grossly wrong', () => {
      expect(isValidBase64Image(BAD_PADDING)).toBe(false);
    });
  });

  describe('extractBase64Part()', () => {
    it('extracts the base64 payload from a valid data URL', () => {
      expect(extractBase64Part(PNG_DATA_URL)).toBe(VALID_BASE64);
      expect(extractBase64Part(JPEG_DATA_URL)).toBe(VALID_BASE64_LONG);
    });

    it('returns null for invalid data URLs', () => {
      expect(extractBase64Part(MISSING_PREFIX)).toBeNull();
      expect(extractBase64Part(WRONG_MIME)).toBeNull();
    });
  });

  describe('getImageMimeFromDataUrl()', () => {
    it('returns the correct mime type', () => {
      expect(getImageMimeFromDataUrl(PNG_DATA_URL)).toBe('image/png');
      expect(getImageMimeFromDataUrl(JPEG_DATA_URL)).toBe('image/jpeg');
      expect(getImageMimeFromDataUrl(SVG_DATA_URL)).toBe('image/svg+xml');
    });

    it('returns null for invalid data URLs', () => {
      expect(getImageMimeFromDataUrl(MISSING_PREFIX)).toBeNull();
      expect(getImageMimeFromDataUrl(WRONG_MIME)).toBeNull();
    });
  });
});
