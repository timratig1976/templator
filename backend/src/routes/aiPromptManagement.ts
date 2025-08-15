import express from 'express';
import { aiPromptRepository } from '../services/ai/AIPromptRepository';
import { enhancedLayoutDetectionService } from '../services/ai/EnhancedLayoutDetectionService';
import { createLogger } from '../utils/logger';
import prisma from '../services/database/prismaClient';
import LocalStorageService from '../services/storage/LocalStorageService';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';

const router = express.Router();
const logger = createLogger();
const localStorage = new LocalStorageService();

/**
 * Initialize AI processes with default prompts
 * POST /api/admin/ai-prompts/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    await aiPromptRepository.initializeAIProcesses();
    res.json({
      success: true,
      message: 'AI processes initialized successfully'
    });
  } catch (error) {
    logger.error('Failed to initialize AI processes', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to initialize AI processes'
    });
  }
});

/**
 * Import historical JSONL backup logs into DB for a process
 * POST /api/admin/ai-prompts/processes/:processName/backfill-jsonl
 * Optional body: { limit?: number } limits total inserted rows this run
 */
router.post('/processes/:processName/backfill-jsonl', async (req, res) => {
  const { processName } = req.params;
  const limit = Math.max(0, Math.min(Number(req.body?.limit ?? 0) || 0, 5000));
  const p: any = prisma as any;
  const logsDir = path.resolve(process.cwd(), 'storage', 'logs', 'prompt-runs');
  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  try {
    const files = await fs.promises.readdir(logsDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl')).sort();
    for (const file of jsonlFiles) {
      const abs = path.join(logsDir, file);
      const content = await fs.promises.readFile(abs, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        scanned++;
        try {
          const entry = JSON.parse(line);
          if (!entry || entry.processName !== processName) { skipped++; continue; }

          // Derive base metrics like live path
          const preds = Array.isArray(entry?.detectResponse?.sections) ? entry.detectResponse.sections : [];
          const baseMetrics: any = {
            sectionsDetected: preds.length,
            averageConfidence: typeof entry?.detectResponse?.averageConfidence === 'number' ? entry.detectResponse.averageConfidence : null,
            processingTime: typeof entry?.detectResponse?.processingTime === 'number' ? entry.detectResponse.processingTime : null
          };
          const mergedMetrics = { ...baseMetrics, ...(entry?.kpis || {}) };

          // Resolve or create prompt
          let resolvedPromptId: string | null = entry.activePromptId || null;
          try {
            if (!resolvedPromptId) {
              const active = await p.aIPrompt.findFirst({
                where: { process: { name: processName }, isActive: true },
                select: { id: true }
              });
              resolvedPromptId = active?.id || null;
            }
            if (!resolvedPromptId) {
              let processRec = await p.aIProcess.findUnique({ where: { name: processName } });
              if (!processRec) {
                processRec = await p.aIProcess.create({ data: { name: processName, title: processName } });
              }
              const existingAny = await p.aIPrompt.findFirst({ where: { processId: processRec.id }, select: { id: true } });
              if (existingAny?.id) {
                resolvedPromptId = existingAny.id;
              } else {
                const created = await p.aIPrompt.create({
                  data: {
                    processId: processRec.id,
                    version: 1,
                    title: `${processName} default`,
                    content: entry?.promptContent || '',
                    isActive: true
                  },
                  select: { id: true }
                });
                resolvedPromptId = created.id;
              }
            }
          } catch (e) {
            logger.warn('backfill: prompt resolution failed; will try insert without promptId', { processName, error: (e as Error).message });
          }

          // Create test result
          try {
            await p.aIPromptTestResult.create({
              data: {
                promptId: resolvedPromptId,
                testFileName: entry?.inputMeta?.fileName || null,
                input: {
                  promptMode: entry?.promptMode,
                  promptHash: entry?.promptHash,
                  promptPartsPresent: !!entry?.promptContent,
                  requestId: entry?.requestId,
                  inputMeta: entry?.inputMeta || null,
                  datasetCaseId: entry?.datasetCaseId || null,
                  groundTruthPresent: !!entry?.groundTruthPresent,
                  promptParts: entry?.promptParts || null,
                  status: entry?.status || 'success',
                  errorMessage: entry?.errorMessage || null
                },
                output: entry?.detectResponse || null,
                metrics: mergedMetrics,
                status: entry?.status || 'success',
                errorMessage: entry?.errorMessage || null,
                executionTime: typeof entry?.detectResponse?.processingTime === 'number' ? entry.detectResponse.processingTime : null
              }
            });
            inserted++;
          } catch (e) {
            skipped++;
            logger.warn('backfill: insert failed (possibly duplicate)', { error: (e as Error).message });
          }

          if (limit && inserted >= limit) {
            return res.json({ success: true, data: { scanned, inserted, skipped, done: true } });
          }
        } catch (e) {
          skipped++;
          logger.warn('backfill: bad JSONL line', { error: (e as Error).message });
        }
      }
    }
    return res.json({ success: true, data: { scanned, inserted, skipped, done: true } });
  } catch (error) {
    logger.error('Failed backfill-jsonl', { processName, error });
    return res.status(500).json({ success: false, error: 'Failed backfill-jsonl' });
  }
});

/**
 * Record a prompt run and compute KPIs when possible.
 * POST /api/admin/ai-prompts/processes/:processName/record-run
 * This appends a JSONL entry under logs/prompt-runs/YYYY-MM-DD.jsonl using LocalStorageService.
 * Does not depend on DB migrations; safe for immediate use.
 */
router.post('/processes/:processName/record-run', async (req, res) => {
  try {
    const { processName } = req.params;
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);

    const body = req.body || {};
    const {
      promptMode,              // 'active' | 'custom'
      promptContent,           // string | undefined when custom
      activePromptId,          // string | undefined
      userId,                  // string | undefined
      requestId,               // string | undefined
      inputMeta,               // { fileName?, layoutHash?, context? }
      detectResponse,          // { sections, averageConfidence, processingTime, tokens? }
      groundTruth,             // for split-detection: { sections: [...] } optional
      datasetCaseId            // if this run came from a known validation case
    } = body;

    // Compute KPIs only when feasible. For split-detection, use IoU >= 0.5.
    let kpis: any = null;
    if (processName === 'split-detection' && groundTruth && Array.isArray(groundTruth.sections)) {
      const preds = Array.isArray(detectResponse?.sections) ? detectResponse.sections : [];
      const gts = groundTruth.sections || [];
      const iou = (a: any, b: any): number => {
        if (!a || !b) return 0;
        const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.width, ay2 = a.y + a.height;
        const bx1 = b.x, by1 = b.y, bx2 = b.x + b.width, by2 = b.y + b.height;
        const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
        const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
        const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
        const inter = iw * ih;
        const areaA = Math.max(0, a.width) * Math.max(0, a.height);
        const areaB = Math.max(0, b.width) * Math.max(0, b.height);
        const union = areaA + areaB - inter;
        return union > 0 ? inter / union : 0;
      };
      const matchedGts = new Set<number>();
      let tp = 0;
      for (const p of preds) {
        let best = -1; let bestIou = 0; let idx = -1;
        for (let i = 0; i < gts.length; i++) {
          if (matchedGts.has(i)) continue;
          const gt = gts[i];
          if (p.type && gt.type && p.type !== gt.type) continue;
          const score = iou(p.bounds || p, gt.bounds || gt);
          if (score > bestIou) { bestIou = score; best = i; }
        }
        if (best >= 0 && bestIou >= 0.5) {
          tp++;
          matchedGts.add(best);
        }
      }
      const fp = Math.max(0, preds.length - tp);
      const fn = Math.max(0, gts.length - tp);
      const precision = preds.length ? tp / (tp + fp) : 0;
      const recall = gts.length ? tp / (tp + fn) : 0;
      const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
      const avgIoU = (() => {
        const ious: number[] = [];
        matchedGts.forEach((gi) => {
          const gt = gts[gi];
          // find matched pred again for IoU calc
          let best = 0;
          for (const p of preds) {
            const score = iou(p.bounds || p, gt.bounds || gt);
            if (score > best) best = score;
          }
          ious.push(best);
        });
        return ious.length ? ious.reduce((a, b) => a + b, 0) / ious.length : 0;
      })();
      kpis = { precision, recall, f1, tp, fp, fn, avgIoU };
    }

    const statusFromBody: 'success' | 'error' = (req.body?.status === 'error') ? 'error' : 'success';
    const errorMessageFromBody: string | null = req.body?.errorMessage || null;
    const promptPartsFromBody: any = req.body?.promptParts || null;

    const entry = {
      ts: now.toISOString(),
      processName,
      promptMode,
      activePromptId,
      userId,
      requestId,
      inputMeta,
      promptHash: promptContent ? createHash('sha1').update(promptContent).digest('hex') : null,
      promptContent: promptContent || null,
      promptParts: promptPartsFromBody,
      detectResponse,
      datasetCaseId: datasetCaseId || null,
      groundTruthPresent: !!groundTruth,
      status: statusFromBody,
      errorMessage: errorMessageFromBody,
      kpis
    };

    // Always capture base metrics even without ground truth
    const preds = Array.isArray(detectResponse?.sections) ? detectResponse.sections : [];
    const baseMetrics: any = {
      sectionsDetected: preds.length,
      averageConfidence: typeof detectResponse?.averageConfidence === 'number' ? detectResponse.averageConfidence : null,
      processingTime: typeof detectResponse?.processingTime === 'number' ? detectResponse.processingTime : null
    };
    const mergedMetrics = { ...baseMetrics, ...(kpis || {}) };

    // Optional JSONL backup log; never required for app correctness
    const enableJsonl = process.env.AI_RUNS_JSONL_ENABLED !== 'false';
    if (enableJsonl) {
      try {
        const line = JSON.stringify(entry) + '\n';
        const logsDir = path.resolve(process.cwd(), 'storage', 'logs', 'prompt-runs');
        await fs.promises.mkdir(logsDir, { recursive: true });
        const absPath = path.join(logsDir, `${dateKey}.jsonl`);
        await fs.promises.appendFile(absPath, line, { encoding: 'utf8' });
      } catch (e) {
        // Do not block on backup logging
        logger.warn('JSONL backup write failed (non-fatal)', { error: (e as Error).message });
      }
    }

    // Persist to DB using existing Prisma models
    const p: any = prisma as any;
    let resolvedPromptId: string | null = null;
    if (activePromptId) {
      resolvedPromptId = activePromptId;
    } else {
      try {
        const active = await p.aIPrompt.findFirst({
          where: { process: { name: processName }, isActive: true },
          select: { id: true }
        });
        resolvedPromptId = active?.id || null;
      } catch (e) {
        logger.warn('Could not resolve active prompt for record-run', { processName, error: (e as Error).message });
      }
    }

    // Fallback: ensure a prompt exists so we can always persist the run
    if (!resolvedPromptId) {
      try {
        let processRec = await p.aIProcess.findUnique({ where: { name: processName } });
        if (!processRec) {
          processRec = await p.aIProcess.create({ data: { name: processName, title: processName } });
        }
        const existingAny = await p.aIPrompt.findFirst({ where: { processId: processRec.id }, select: { id: true } });
        if (existingAny?.id) {
          resolvedPromptId = existingAny.id;
        } else {
          const created = await p.aIPrompt.create({
            data: {
              processId: processRec.id,
              version: 1,
              title: `${processName} default`,
              content: promptContent || '',
              isActive: true
            },
            select: { id: true }
          });
          resolvedPromptId = created.id;
        }
      } catch (e) {
        logger.warn('record-run fallback failed to create default prompt', { processName, error: (e as Error).message });
      }
    }

    try {
      if (resolvedPromptId) {
        await p.aIPromptTestResult.create({
          data: {
            promptId: resolvedPromptId,
            testFileName: inputMeta?.fileName || null,
            input: {
              promptMode,
              promptHash: entry.promptHash,
              promptPartsPresent: !!promptContent,
              requestId,
              inputMeta,
              datasetCaseId: datasetCaseId || null,
              groundTruthPresent: !!groundTruth,
              promptParts: promptPartsFromBody,
              status: statusFromBody,
              errorMessage: errorMessageFromBody
            },
            output: detectResponse || null,
            metrics: mergedMetrics,
            status: statusFromBody,
            errorMessage: errorMessageFromBody,
            executionTime: typeof detectResponse?.processingTime === 'number' ? detectResponse.processingTime : null
          }
        });
      } else {
        logger.warn('record-run: no promptId resolved; skipping DB insert');
      }
    } catch (e) {
      logger.error('Failed to persist prompt test result', { error: (e as Error).message });
    }

    return res.json({ success: true, data: { recorded: true, kpis, promptId: resolvedPromptId } });
  } catch (error) {
    logger.error('Failed to record prompt run', { error });
    return res.status(500).json({ success: false, error: 'Failed to record prompt run' });
  }
});

/**
 * List recent prompt runs for a process (optionally by version)
 * GET /api/admin/ai-prompts/processes/:processName/runs?versionId=...&limit=...
 */
router.get('/processes/:processName/runs', async (req, res) => {
  const { processName } = req.params;
  const { versionId, limit } = req.query as { versionId?: string; limit?: string };
  const p: any = prisma as any;
  try {
    const take = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 200);
    const where: any = {
      prompt: {
        process: { name: processName }
      }
    };
    if (versionId) where.promptId = versionId;
    const runs = await p.aIPromptTestResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        promptId: true,
        testFileName: true,
        input: true,
        output: true,
        metrics: true,
        status: true,
        errorMessage: true,
        executionTime: true,
        createdAt: true,
        prompt: {
          select: { id: true, version: true, title: true, isActive: true }
        }
      }
    });
    return res.json({ success: true, data: runs });
  } catch (error) {
    logger.error('Failed to list prompt runs', { processName, error });
    return res.status(500).json({ success: false, error: 'Failed to list prompt runs' });
  }
});

/**
 * Compute simple aggregate metrics for a process/version on demand
 * GET /api/admin/ai-prompts/processes/:processName/metrics?versionId=...
 */
router.get('/processes/:processName/metrics', async (req, res) => {
  const { processName } = req.params;
  const { versionId } = req.query as { versionId?: string };
  const p: any = prisma as any;
  try {
    const where: any = {
      prompt: { process: { name: processName } }
    };
    if (versionId) where.promptId = versionId;
    const runs = await p.aIPromptTestResult.findMany({ where, select: { metrics: true, status: true } });
    let count = runs.length;
    let withKpis = 0;
    let sums = { precision: 0, recall: 0, f1: 0, avgIoU: 0 } as any;
    for (const r of runs) {
      const m = r.metrics || {};
      if (m && (m.precision != null || m.recall != null || m.f1 != null || m.avgIoU != null)) {
        withKpis++;
        sums.precision += Number(m.precision || 0);
        sums.recall += Number(m.recall || 0);
        sums.f1 += Number(m.f1 || 0);
        sums.avgIoU += Number(m.avgIoU || 0);
      }
    }
    const avg = withKpis > 0 ? {
      precision: sums.precision / withKpis,
      recall: sums.recall / withKpis,
      f1: sums.f1 / withKpis,
      avgIoU: sums.avgIoU / withKpis
    } : null;
    return res.json({ success: true, data: { count, withKpis, avg } });
  } catch (error) {
    logger.error('Failed to compute metrics', { processName, error });
    return res.status(500).json({ success: false, error: 'Failed to compute metrics' });
  }
});

/**
 * Get validation dataset (golden set) for a process
 * GET /api/admin/ai-prompts/processes/:processName/validation/dataset
 */
router.get('/processes/:processName/validation/dataset', async (req, res) => {
  try {
    const { processName } = req.params;
    // Only supported process: html-generation
    const isHtml = processName === 'html-generation';
    if (!isHtml) {
      return res.status(400).json({ success: false, error: `Validation dataset only supported for html-generation` });
    }

    // Find artifacts marked as golden set
    const where: any = { meta: { path: ['isGoldenSet'], equals: true }, type: 'html' };
    const artifacts = await prisma.generatedArtifact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    const toMime = (p: string): string => {
      const ext = path.extname(p).toLowerCase();
      switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream';
      }
    };

    const dataset: Array<any> = [];
    for (const art of artifacts) {
      try {
        const meta: any = art.meta as any;
        // Return canonical HTML artifacts for template library
        dataset.push({
          id: art.id,
          name: meta?.name || meta?.title || 'Golden HTML',
          category: meta?.category || 'component',
          moduleRef: meta?.moduleRef || (art.moduleId ? { moduleId: art.moduleId } : undefined),
          type: art.type,
          content: art.content || null,
          contentUrl: art.contentUrl || null,
          standards: meta?.standards || null,
          selectors: meta?.selectors || null,
          responsiveBreakpoints: meta?.responsiveBreakpoints || null,
          dependencies: meta?.dependencies || null,
          previewImageUrl: meta?.previewImageUrl || null,
          previewImageBase64: meta?.previewImageBase64 || null
        });
      } catch (e) {
        logger.warn('Failed to include golden-set artifact in dataset', { id: art.id, error: (e as Error).message });
        continue;
      }
    }

    return res.json({ success: true, data: dataset });
  } catch (error) {
    logger.error('Failed to get validation dataset', { error });
    return res.status(500).json({ success: false, error: 'Failed to get validation dataset' });
  }
});

/**
 * Get all AI processes
 * GET /api/admin/ai-prompts/processes
 */
router.get('/processes', async (req, res) => {
  try {
    const processes = await aiPromptRepository.getAllProcesses();
    res.json({
      success: true,
      data: processes
    });
  } catch (error) {
    logger.error('Failed to get AI processes', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get AI processes'
    });
  }
});

/**
 * Get active prompt for a process
 * GET /api/admin/ai-prompts/processes/:processName/active
 */
router.get('/processes/:processName/active', async (req, res) => {
  try {
    const { processName } = req.params;
    const activePrompt = await aiPromptRepository.getActivePrompt(processName);
    
    if (!activePrompt) {
      return res.status(404).json({
        success: false,
        error: 'No active prompt found for this process'
      });
    }

    res.json({
      success: true,
      data: activePrompt
    });
  } catch (error) {
    logger.error('Failed to get active prompt', { error, processName: req.params.processName });
    res.status(500).json({
      success: false,
      error: 'Failed to get active prompt'
    });
  }
});

/**
 * Get all prompt versions for a process
 * GET /api/admin/ai-prompts/processes/:processName/versions
 */
router.get('/processes/:processName/versions', async (req, res) => {
  try {
    const { processName } = req.params;
    const versions = await aiPromptRepository.getPromptVersions(processName);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    logger.error('Failed to get prompt versions', { error, processName: req.params.processName });
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt versions'
    });
  }
});

/**
 * Create new prompt version
 * POST /api/admin/ai-prompts/processes/:processName/versions
 */
router.post('/processes/:processName/versions', async (req, res) => {
  try {
    const { processName } = req.params;
    const {
      version,
      promptContent,
      title,
      description,
      author,
      tags,
      metadata,
      setAsActive
    } = req.body;

    if (!version || !promptContent || !author) {
      return res.status(400).json({
        success: false,
        error: 'Version, promptContent, and author are required'
      });
    }

    const newPrompt = await aiPromptRepository.createPromptVersion(
      processName,
      version,
      promptContent,
      {
        title,
        description,
        author,
        tags: tags || [],
        metadata: metadata || {},
        setAsActive: setAsActive || false
      }
    );

    res.status(201).json({
      success: true,
      data: newPrompt
    });
  } catch (error) {
    logger.error('Failed to create prompt version', { error, processName: req.params.processName });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create prompt version'
    });
  }
});

/**
 * Set prompt as active
 * PUT /api/admin/ai-prompts/prompts/:promptId/activate
 */
router.put('/prompts/:promptId/activate', async (req, res) => {
  try {
    const { promptId } = req.params;
    await aiPromptRepository.setActivePrompt(promptId);
    
    res.json({
      success: true,
      message: 'Prompt set as active successfully'
    });
  } catch (error) {
    logger.error('Failed to set prompt as active', { error, promptId: req.params.promptId });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set prompt as active'
    });
  }
});

/**
 * Delete prompt version
 * DELETE /api/admin/ai-prompts/prompts/:promptId
 */
router.delete('/prompts/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    await aiPromptRepository.deletePromptVersion(promptId);
    
    res.json({
      success: true,
      message: 'Prompt version deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete prompt version', { error, promptId: req.params.promptId });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete prompt version'
    });
  }
});

/**
 * Test prompt with static file
 * POST /api/admin/ai-prompts/processes/:processName/test
 */
router.post('/processes/:processName/test', async (req, res) => {
  try {
    const { processName } = req.params;
    const {
      promptContent,
      testFileId,
      testFileName,
      inputData,
      promptId
    } = req.body;

    if (!promptContent && !promptId) {
      return res.status(400).json({
        success: false,
        error: 'Either promptContent or promptId is required'
      });
    }

    const startTime = Date.now();
    let testResult;

    // Route to appropriate AI service based on process
    switch (processName) {
      case 'split-detection':
        testResult = await testSplitDetectionPrompt(promptContent, inputData);
        break;
      case 'html-generation':
        testResult = await testHTMLGenerationPrompt(promptContent, inputData);
        break;
      case 'content-enhancement':
        testResult = await testContentEnhancementPrompt(promptContent, inputData);
        break;
      case 'quality-analysis':
        testResult = await testQualityAnalysisPrompt(promptContent, inputData);
        break;
      case 'image-analysis':
        testResult = await testImageAnalysisPrompt(promptContent, inputData);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown process: ${processName}`
        });
    }

    const processingTime = Date.now() - startTime;

    // Record test result if promptId provided
    if (promptId) {
      const process = await aiPromptRepository.getAllProcesses();
      const targetProcess = process.find(p => p.name === processName);
      
      if (targetProcess) {
        await aiPromptRepository.recordTestResult({
          promptId,
          testFileName: testFileName || 'unknown',
          testFileId,
          input: inputData,
          output: testResult,
          metrics: extractMetrics(testResult, processName),
          status: 'success',
          executionTime: processingTime
        });
      }
    }

    res.json({
      success: true,
      data: {
        result: testResult,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to test prompt', { error, processName: req.params.processName });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test prompt'
    });
  }
});

/**
 * Get test results for a prompt
 * GET /api/admin/ai-prompts/prompts/:promptId/test-results
 */
router.get('/prompts/:promptId/test-results', async (req, res) => {
  try {
    const { promptId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const testResults = await aiPromptRepository.getTestResults(promptId, limit);
    
    res.json({
      success: true,
      data: testResults
    });
  } catch (error) {
    logger.error('Failed to get test results', { error, promptId: req.params.promptId });
    res.status(500).json({
      success: false,
      error: 'Failed to get test results'
    });
  }
});

// Helper functions for testing different AI processes
async function testSplitDetectionPrompt(promptContent: string, inputData: any) {
  // For now, use the standard detection service
  // TODO: Implement custom prompt injection when needed
  const result = await enhancedLayoutDetectionService.detectLayoutSections(
    inputData.imageBase64,
    inputData.fileName || 'test-image.jpg',
    inputData.options || {}
  );
  
  // Add custom prompt info to result for testing purposes
  return {
    ...result,
    customPrompt: promptContent,
    testMode: true
  };
}

async function testHTMLGenerationPrompt(promptContent: string, inputData: any) {
  // Mock HTML generation testing
  return {
    html: '<div class="test-section">Generated HTML</div>',
    css: '.test-section { padding: 20px; }',
    editableFields: [],
    metadata: { testMode: true }
  };
}

async function testContentEnhancementPrompt(promptContent: string, inputData: any) {
  // Mock content enhancement testing
  return {
    enhancedContent: 'Enhanced content based on prompt',
    improvements: [],
    qualityScore: { overall: 85 }
  };
}

async function testQualityAnalysisPrompt(promptContent: string, inputData: any) {
  // Mock quality analysis testing
  return {
    overallScore: 85,
    dimensionScores: {
      technical: 90,
      content: 85,
      userExperience: 88,
      seo: 82,
      brandCompliance: 87
    },
    issues: [],
    recommendations: []
  };
}

async function testImageAnalysisPrompt(promptContent: string, inputData: any) {
  // Mock image analysis testing
  return {
    complexity: { level: 'medium', score: 0.75 },
    designPatterns: [],
    colorPalette: { primary: ['#1a365d'], secondary: ['#4a5568'] },
    typography: { headingLevels: 3 },
    layoutStructure: { gridSystem: '12-column' }
  };
}

function extractMetrics(result: any, processName: string): Record<string, number> {
  switch (processName) {
    case 'split-detection':
      return {
        sectionsDetected: result.sections?.length || 0,
        averageConfidence: result.detectionMetrics?.averageConfidence || 0,
        accuracy: 85 // Mock accuracy for now
      };
    case 'html-generation':
      return {
        codeQuality: 90,
        accessibility: 85,
        performance: 88
      };
    case 'content-enhancement':
      return {
        qualityImprovement: result.qualityScore?.overall || 0,
        improvementsCount: result.improvements?.length || 0
      };
    case 'quality-analysis':
      return {
        overallScore: result.overallScore || 0,
        issuesFound: result.issues?.length || 0
      };
    case 'image-analysis':
      return {
        complexityScore: result.complexity?.score || 0,
        patternsDetected: result.designPatterns?.length || 0
      };
    default:
      return {};
  }
}

export default router;
