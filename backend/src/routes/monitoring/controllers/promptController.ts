import { Request, Response } from 'express';
import prisma from '../../../services/database/prismaClient';

// GET /api/monitoring/prompts/summary
// Optional filters: sectionId, designSplitId (maps to pipelineId), search, offset, limit
export async function getPromptsSummary(req: Request, res: Response) {
  try {
    const {
      sectionId,
      designSplitId,
      search,
      offset = '0',
      limit = '50',
      ragOnly,
    } = req.query as Record<string, string | undefined>;

    const skip = Math.max(0, parseInt(offset || '0', 10));
    const take = Math.min(200, Math.max(1, parseInt(limit || '50', 10)));

    const where: any = {};
    if (sectionId) where.sectionId = sectionId;
    if (designSplitId) where.pipelineId = designSplitId;
    if (search) {
      where.OR = [
        { prompt: { contains: search, mode: 'insensitive' } },
        { pipelineId: { contains: search, mode: 'insensitive' } },
        { sectionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.promptData.count({ where }),
      prisma.promptData.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          results: {
            select: { id: true, qualityScore: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 25, // recent slice is enough for aggregates
          },
        },
      }),
    ]);

    // Preload artifacts for the pipelines in view to compute RAG usage quickly
    const pipelineIds = Array.from(new Set(items.map((i) => i.pipelineId).filter(Boolean))) as string[];
    let artifactsByKey = new Map<string, { ragCount: number; lastRagAt: Date | null }>();
    if (pipelineIds.length > 0) {
      const arts = await prisma.generatedArtifact.findMany({
        where: { designSplitId: { in: pipelineIds }, type: 'html' },
        orderBy: { createdAt: 'desc' },
        take: 2000, // cap to keep fast; ordering ensures lastRagAt accurate enough
      });
      for (const a of arts) {
        const meta: any = a.meta as any;
        const sec = meta?.sectionId;
        const rag = !!meta?.ragUsed;
        if (!sec) continue;
        const key = `${a.designSplitId}::${sec}`;
        const prev = artifactsByKey.get(key) || { ragCount: 0, lastRagAt: null };
        if (rag) {
          prev.ragCount += 1;
          if (!prev.lastRagAt || a.createdAt > prev.lastRagAt) prev.lastRagAt = a.createdAt;
        }
        artifactsByKey.set(key, prev);
      }
    }

    let summary = items.map((pd) => {
      const usageCount = pd.results.length; // recent, not total; still indicative
      let avgQuality: number | null = null;
      if (pd.results.length > 0) {
        const vals = pd.results.map((r) => (typeof r.qualityScore === 'number' ? r.qualityScore : null)).filter((v): v is number => v !== null);
        if (vals.length > 0) avgQuality = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      const lastUsed = pd.results[0]?.createdAt || pd.updatedAt;
      const key = `${pd.pipelineId}::${pd.sectionId}`;
      const ragStats = artifactsByKey.get(key) || { ragCount: 0, lastRagAt: null };
      return {
        id: pd.id,
        pipelineId: pd.pipelineId,
        sectionId: pd.sectionId,
        prompt: pd.prompt,
        updatedAt: pd.updatedAt,
        usageCount,
        avgQuality,
        lastUsed,
        ragUsageCount: ragStats.ragCount,
        lastRagUsedAt: ragStats.lastRagAt,
      };
    });

    if (ragOnly === 'true') {
      summary = summary.filter((s) => (s.ragUsageCount || 0) > 0);
    }

    res.json({ success: true, total, offset: skip, limit: take, items: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load prompts summary' });
  }
}

// GET /api/monitoring/prompts/:id
export async function getPromptDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const item = await prisma.promptData.findUnique({
      where: { id },
      include: {
        results: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            result: true,
            qualityScore: true,
            metrics: true,
            createdAt: true,
          },
          take: 100,
        },
      },
    });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });

    const usageCount = item.results.length;
    const vals = item.results.map((r) => (typeof r.qualityScore === 'number' ? r.qualityScore : null)).filter((v): v is number => v !== null);
    const avgQuality = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // Pull recent generated artifacts that relate to this prompt's pipeline/section context
    let relatedArtifacts: Array<{
      id: string;
      createdAt: Date;
      label?: string | null;
      ragUsed?: boolean;
      enhancedPrompt?: string | null;
      selected?: boolean;
      type: string;
    }> = [];
    if (item.pipelineId && item.sectionId) {
      const artifacts = await prisma.generatedArtifact.findMany({
        where: {
          designSplitId: item.pipelineId,
          type: 'html',
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      relatedArtifacts = artifacts
        .filter((a) => (a.meta as any)?.sectionId === item.sectionId)
        .map((a) => ({
          id: a.id,
          createdAt: a.createdAt,
          label: (a.meta as any)?.label ?? null,
          ragUsed: !!(a.meta as any)?.ragUsed,
          enhancedPrompt: ((a.meta as any)?.enhancedPrompt as string) || null,
          selected: !!(a.meta as any)?.selected,
          type: a.type,
        }));
    }

    res.json({
      success: true,
      item: {
        id: item.id,
        pipelineId: item.pipelineId,
        sectionId: item.sectionId,
        prompt: item.prompt,
        context: item.context,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        usageCount,
        avgQuality,
        lastUsed: item.results[0]?.createdAt || item.updatedAt,
        results: item.results,
        relatedArtifacts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load prompt detail' });
  }
}
