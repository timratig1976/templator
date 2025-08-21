import sharp from 'sharp'

export type DetectedLine = { y: number; strength: number }
export type DetectedSection = { index: number; yStart: number; yEnd: number; height: number }

/**
 * Simple horizontal split-line detector using Sobel gradients + row energy aggregation.
 * No native deps beyond sharp. Works best on screenshots/layout images.
 */
export class SplitlineDetectionService {
  async detectLines(buf: Buffer, opts?: { minGapPx?: number; threshold?: number }) {
    const image = sharp(buf).greyscale()
    const meta = await image.metadata()
    if (!meta.width || !meta.height) throw new Error('Unable to read image metadata')

    // Sobel kernels
    const ky = {
      width: 3,
      height: 3,
      kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    }

    const gyImg = image.clone().convolve(ky)
    const gy = await gyImg.raw().toBuffer()

    const w = meta.width
    const h = meta.height

    // Aggregate vertical gradient magnitude per row
    const rowEnergy = new Float32Array(h)
    for (let y = 0; y < h; y++) {
      let sum = 0
      for (let x = 0; x < w; x++) {
        // single-channel grayscale
        const v = gy[y * w + x]
        sum += Math.abs(v)
      }
      rowEnergy[y] = sum / w
    }

    // Smooth with simple moving average
    const smoothed = new Float32Array(h)
    const win = 5
    for (let y = 0; y < h; y++) {
      let s = 0
      let c = 0
      for (let k = -win; k <= win; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) {
          s += rowEnergy[yy]
          c++
        }
      }
      smoothed[y] = s / c
    }

    // Normalize
    let max = 1
    for (let y = 0; y < h; y++) max = Math.max(max, smoothed[y])
    const norm = new Float32Array(h)
    for (let y = 0; y < h; y++) norm[y] = smoothed[y] / max

    // Peak picking
    const threshold = opts?.threshold ?? 0.25
    const minGap = opts?.minGapPx ?? Math.round(Math.max(30, h * 0.03))
    const peaks: DetectedLine[] = []

    let lastY = -minGap
    for (let y = 1; y < h - 1; y++) {
      if (norm[y] > threshold && norm[y] >= norm[y - 1] && norm[y] >= norm[y + 1]) {
        if (y - lastY >= minGap) {
          peaks.push({ y, strength: norm[y] })
          lastY = y
        }
      }
    }

    return peaks
  }

  buildSections(lines: DetectedLine[], height: number): DetectedSection[] {
    const ys = [0, ...lines.map((l) => l.y), height]
    const sections: DetectedSection[] = []
    for (let i = 0; i < ys.length - 1; i++) {
      const yStart = ys[i]
      const yEnd = ys[i + 1]
      const h = Math.max(1, yEnd - yStart)
      sections.push({ index: i, yStart, yEnd, height: h })
    }
    return sections
  }
}

export default new SplitlineDetectionService()
