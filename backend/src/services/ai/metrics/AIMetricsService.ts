import { createLogger } from '../../../utils/logger';

export type SectionBounds = { x: number; y: number; width: number; height: number };
export type SectionLike = { type?: string; bounds?: SectionBounds; confidence?: number } & Record<string, any>;

export type BaseMetrics = {
  sectionsDetected: number;
  averageConfidence: number | null;
  processingTimeMs: number;
  tokensUsed?: number;
  estimatedCostUsd?: number;
};

export type DetectionKpis = {
  precision: number;
  recall: number;
  f1: number;
  avgIoU: number;
  tp: number;
  fp: number;
  fn: number;
};

export type RunMetrics = BaseMetrics & Partial<DetectionKpis>;

const logger = createLogger();

export class AIMetricsService {
  static computeAverageConfidence(sections: Array<SectionLike | undefined | null>): number | null {
    const vals = (sections || [])
      .map((s) => (s?.confidence == null ? null : Number(s.confidence)))
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum / vals.length;
  }

  static computeBaseMetrics(params: {
    sections: Array<SectionLike> | null | undefined;
    processingTimeMs: number;
    tokensUsed?: number;
    estimatedCostUsd?: number;
    averageConfidenceOverride?: number | null;
  }): BaseMetrics {
    const sections = params.sections || [];
    const averageConfidence =
      params.averageConfidenceOverride != null
        ? params.averageConfidenceOverride
        : AIMetricsService.computeAverageConfidence(sections);
    return {
      sectionsDetected: sections.length,
      averageConfidence,
      processingTimeMs: Math.max(0, Math.floor(params.processingTimeMs || 0)),
      tokensUsed: params.tokensUsed,
      estimatedCostUsd: params.estimatedCostUsd,
    };
  }

  static iou(a: SectionBounds | undefined, b: SectionBounds | undefined): number {
    if (!a || !b) return 0;
    const ax1 = a.x,
      ay1 = a.y,
      ax2 = a.x + a.width,
      ay2 = a.y + a.height;
    const bx1 = b.x,
      by1 = b.y,
      bx2 = b.x + b.width,
      by2 = b.y + b.height;
    const ix1 = Math.max(ax1, bx1),
      iy1 = Math.max(ay1, by1);
    const ix2 = Math.min(ax2, bx2),
      iy2 = Math.min(ay2, by2);
    const iw = Math.max(0, ix2 - ix1),
      ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const areaA = Math.max(0, a.width) * Math.max(0, a.height);
    const areaB = Math.max(0, b.width) * Math.max(0, b.height);
    const union = areaA + areaB - inter;
    return union > 0 ? inter / union : 0;
  }

  static computeValidationKpis(params: {
    predictions: Array<SectionLike> | null | undefined;
    groundTruth: Array<SectionLike> | null | undefined;
    matchThreshold?: number; // IoU threshold
    matchByType?: boolean;
  }): DetectionKpis {
    const preds = (params.predictions || []).slice();
    const gts = (params.groundTruth || []).slice();
    const thr = typeof params.matchThreshold === 'number' ? params.matchThreshold : 0.5;
    const matchByType = !!params.matchByType;

    const matchedGts = new Set<number>();
    let tp = 0;
    for (const p of preds) {
      let best = -1;
      let bestIoU = 0;
      for (let i = 0; i < gts.length; i++) {
        if (matchedGts.has(i)) continue;
        const gt = gts[i];
        if (matchByType && p?.type && gt?.type && p.type !== gt.type) continue;
        const score = AIMetricsService.iou(p?.bounds || (p as any), gt?.bounds || (gt as any));
        if (score > bestIoU) {
          bestIoU = score;
          best = i;
        }
      }
      if (best >= 0 && bestIoU >= thr) {
        tp++;
        matchedGts.add(best);
      }
    }
    const fp = Math.max(0, preds.length - tp);
    const fn = Math.max(0, gts.length - tp);
    const precision = preds.length ? tp / (tp + fp) : 0;
    const recall = gts.length ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    // Avg IoU across matched GTs (best-over-preds per GT)
    const ious: number[] = [];
    matchedGts.forEach((gi) => {
      const gt = gts[gi];
      let best = 0;
      for (const p of preds) {
        const score = AIMetricsService.iou(p?.bounds || (p as any), gt?.bounds || (gt as any));
        if (score > best) best = score;
      }
      ious.push(best);
    });
    const avgIoU = ious.length ? ious.reduce((a, b) => a + b, 0) / ious.length : 0;

    return { precision, recall, f1, avgIoU, tp, fp, fn };
  }

  static merge<T extends object>(...parts: Array<T | null | undefined>): T {
    const out: any = {};
    for (const p of parts) {
      if (p && typeof p === 'object') Object.assign(out, p);
    }
    return out as T;
  }
}

export default AIMetricsService;
