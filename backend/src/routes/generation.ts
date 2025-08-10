import { Router, Request, Response } from 'express';
import GeneratedArtifactRepository from '../services/database/GeneratedArtifactRepository';
import prisma from '../services/database/prismaClient';
import openAIService from '../services/ai/openaiService';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';

// Module-level EnhancedAIService singleton with lazy initialization
const enhancedAI = new EnhancedAIService();
let enhancedAIInitialized = false;
async function ensureEnhancedAI() {
  if (!enhancedAIInitialized) {
    await enhancedAI.initialize();
    enhancedAIInitialized = true;
  }
}

const router = Router();

// Load saved prompts for a section within an optional designSplit scope
router.get('/sections/:sectionId/prompts', async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { designSplitId } = req.query as { designSplitId?: string };

    if (!designSplitId) {
      return res.json({ success: true, prompts: null });
    }

    const pd = await prisma.promptData.findUnique({
      where: { pipelineId_sectionId: { pipelineId: designSplitId, sectionId } },
    });

    if (!pd) return res.json({ success: true, prompts: null });

    const context = (pd.context as any) || {};
    res.json({
      success: true,
      prompts: {
        basePrompt: typeof context.basePrompt === 'string' ? context.basePrompt : '',
        customPrompt: typeof context.customPrompt === 'string' ? context.customPrompt : '',
        label: typeof context.label === 'string' ? context.label : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load prompts' });
  }
});

// Save prompts for a section within a designSplit scope
router.put('/sections/:sectionId/prompts', async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { designSplitId, basePrompt, customPrompt, label } = req.body as {
      designSplitId: string;
      basePrompt?: string;
      customPrompt?: string;
      label?: string | null;
    };

    if (!designSplitId) {
      return res.status(400).json({ success: false, error: 'designSplitId is required' });
    }

    const context: any = {
      basePrompt: basePrompt || '',
      customPrompt: customPrompt || '',
      label: label || null,
    };

    const upserted = await prisma.promptData.upsert({
      where: { pipelineId_sectionId: { pipelineId: designSplitId, sectionId } },
      create: {
        pipelineId: designSplitId,
        sectionId,
        prompt: context.customPrompt || context.basePrompt || '',
        context,
      },
      update: {
        prompt: context.customPrompt || context.basePrompt || '',
        context,
      },
    });

    res.json({ success: true, prompts: context });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to save prompts' });
  }
});

// List versions for a section (optionally scoped to a designSplitId)
router.get('/sections/:sectionId/versions', async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { designSplitId } = req.query as { designSplitId?: string };

    // Fetch artifacts filtered by split if provided, then filter by meta.sectionId
    const list = designSplitId
      ? await GeneratedArtifactRepository.listBySplit(designSplitId)
      : await prisma.generatedArtifact.findMany({ orderBy: { createdAt: 'desc' } });

    const versions = list.filter((a: any) => (a.type === 'html') && (a.meta as any)?.sectionId === sectionId);

    res.json({ success: true, versions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load versions' });
  }
});

// Create (regenerate) a new HTML version for a section
router.post('/sections/:sectionId/versions', async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { designSplitId, basePrompt, customPrompt, label, useRag } = req.body as {
      designSplitId?: string | null;
      basePrompt?: string;
      customPrompt?: string;
      label?: string;
      useRag?: boolean;
    };

    const prompt = ((customPrompt && customPrompt.trim()) || basePrompt || '').trim();

    // Compose strict instruction for AI generation
    let strictInstruction = [
      `You are generating production-ready, accessible HTML with TailwindCSS for a specific section: ${label || sectionId}.`,
      `Output ONLY the HTML markup (no markdown, no explanations).`,
      `Use semantic tags, ARIA where helpful, and responsive Tailwind classes.`,
      `Do not include <html>, <head>, or <body>; return a self-contained snippet for the section root.`,
      `If images are needed, use <img src="data:image/svg+xml;base64,PHN2Zy8+" alt="" /> minimal placeholders.`,
      prompt ? `Design/prompt guidance: ${prompt}` : ''
    ].filter(Boolean).join('\n');

    // If requested, enhance the prompt via RAG + dynamic context
    let enhancedPrompt: string | null = null;
    if (useRag) {
      try {
        await ensureEnhancedAI();
        strictInstruction = await enhancedAI.enhancePrompt(strictInstruction, {
          pipelinePhase: 'ai_generation',
          hubspotRequirements: ['semantic_html', 'accessibility', 'responsive_design'],
        });
        enhancedPrompt = strictInstruction;
      } catch (e) {
        // If enhancement fails, fall back to original strictInstruction
      }
    }

    // Base scaffold to refine against
    const baseHtml = `<section class="w-full">${label ? `<!-- ${label} -->` : ''}</section>`;

    let contentHtml = '';
    try {
      // Attempt AI refinement/generation
      contentHtml = await openAIService.refineHTML(baseHtml, strictInstruction);
      if (!contentHtml || contentHtml.trim().length < 10) {
        throw new Error('Empty AI HTML');
      }
    } catch (e) {
      // Fallback placeholder to keep UX flowing
      contentHtml = `<!-- placeholder for ${sectionId} -->\n<div class="p-4 border rounded">${label || 'Section'} — generated at ${new Date().toISOString()}</div>`;
    }

    const artifact = await GeneratedArtifactRepository.create({
      designSplitId: designSplitId ?? null,
      type: 'html',
      status: 'completed',
      content: contentHtml,
      meta: {
        sectionId,
        label: label || null,
        prompt,
        ragUsed: !!useRag,
        enhancedPrompt: enhancedPrompt || undefined,
        selected: false,
      } as any,
    });

    res.status(201).json({ success: true, version: artifact });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create version' });
  }
});

// Mark a version as selected for a section (unselect others)
router.patch('/sections/:sectionId/versions/:versionId/select', async (req: Request, res: Response) => {
  try {
    const { sectionId, versionId } = req.params;
    const { designSplitId } = req.body as { designSplitId?: string | null };

    // Load candidates in scope and update selected flags precisely
    const candidates = await prisma.generatedArtifact.findMany({
      where: {
        type: 'html',
        ...(designSplitId ? { designSplitId } : {}),
      },
    });

    // First, unselect all other versions for this section
    const relevant = candidates.filter((c: any) => ((c.meta as any)?.sectionId === sectionId));
    for (const c of relevant) {
      const meta = (c.meta as any) || {};
      const next = { ...meta, selected: c.id === versionId };
      await prisma.generatedArtifact.update({ where: { id: c.id }, data: { meta: next as any } });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to select version' });
  }
});

// Preview RAG-enhanced prompt (no artifact created)
router.post('/sections/:sectionId/rag-preview', async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { basePrompt, customPrompt, label } = req.body as {
      basePrompt?: string;
      customPrompt?: string;
      label?: string;
    };

    const prompt = ((customPrompt && customPrompt.trim()) || basePrompt || '').trim();
    let strictInstruction = [
      `You are generating production-ready, accessible HTML with TailwindCSS for a specific section: ${label || sectionId}.`,
      `Output ONLY the HTML markup (no markdown, no explanations).`,
      `Use semantic tags, ARIA where helpful, and responsive Tailwind classes.`,
      `Do not include <html>, <head>, or <body>; return a self-contained snippet for the section root.`,
      `If images are needed, use <img src="data:image/svg+xml;base64,PHN2Zy8+" alt="" /> minimal placeholders.`,
      prompt ? `Design/prompt guidance: ${prompt}` : ''
    ].filter(Boolean).join('\n');

    await ensureEnhancedAI();
    const enhancedPrompt = await enhancedAI.enhancePrompt(strictInstruction, {
      pipelinePhase: 'ai_generation',
      hubspotRequirements: ['semantic_html', 'accessibility', 'responsive_design'],
    });

    res.json({ success: true, enhancedPrompt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to preview RAG prompt' });
  }
});

export default router;
