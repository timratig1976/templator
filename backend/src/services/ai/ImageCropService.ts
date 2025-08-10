import sharp from 'sharp';
import storage from '../../services/storage';
import splitAssetRepo from '../database/SplitAssetRepository';

export type NormalizedBounds = {
  x: number; // pixels
  y: number; // pixels
  width: number; // pixels
  height: number; // pixels
};

export type SectionInput = {
  index: number;
  id?: string;
  bounds: { x: number; y: number; width: number; height: number };
  unit: 'px' | 'percent';
};

export type CropResult = {
  key: string;
  width: number;
  height: number;
  bounds: NormalizedBounds;
  asset?: any;
};

export class ImageCropService {
  /**
   * Crop sections from an image on disk and persist as SplitAssets (kind='image-crop').
   * - Outputs PNG at original pixel size for each crop.
   * - Stores via storage service and records SplitAsset with meta including key and bounds.
   */
  async createCropsForSplit(
    splitId: string,
    sourceBuffer: Buffer,
    sections: SectionInput[]
  ) {
    const buf = sourceBuffer;
    const img = sharp(sourceBuffer);
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error('Unable to read image dimensions');

    const results: CropResult[] = [];

    for (const s of sections) {
      const b = this.normalizeBounds(s.bounds, s.unit, meta.width, meta.height);
      // Ensure bounds are within image
      const left = Math.max(0, Math.min(meta.width - 1, Math.round(b.x)));
      const top = Math.max(0, Math.min(meta.height - 1, Math.round(b.y)));
      const width = Math.max(1, Math.min(meta.width - left, Math.round(b.width)));
      const height = Math.max(1, Math.min(meta.height - top, Math.round(b.height)));

      const cropBuffer = await sharp(buf).extract({ left, top, width, height }).png().toBuffer();

      const fileName = `split_${splitId}_section_${s.index}.png`;
      const put = await storage.put(cropBuffer, { mime: 'image/png', extension: 'png' });

      // Persist as SplitAsset (store key in meta; storageUrl can be left null or set to key)
      const created = await splitAssetRepo.create({
        splitId,
        kind: 'image-crop',
        storageUrl: put.key, // store key here; consumers should request signed URL
        meta: {
          key: put.key,
          fileName,
          mime: 'image/png',
          width,
          height,
          bounds: { x: left, y: top, width, height },
          originalDimensions: { width: meta.width, height: meta.height },
          sectionId: s.id ?? null,
        },
        order: s.index,
      });

      results.push({ key: put.key, width, height, bounds: { x: left, y: top, width, height }, asset: created });
    }

    return results;
  }

  normalizeBounds(
    b: { x: number; y: number; width: number; height: number },
    unit: 'px' | 'percent',
    imgW: number,
    imgH: number
  ): NormalizedBounds {
    if (unit === 'px') return b as NormalizedBounds;
    // percent -> px
    return {
      x: Math.round((b.x / 100) * imgW),
      y: Math.round((b.y / 100) * imgH),
      width: Math.round((b.width / 100) * imgW),
      height: Math.round((b.height / 100) * imgH),
    };
  }
}

export default new ImageCropService();
