import prisma from "../database/prismaClient";

export type AILogInsert = {
  timestamp?: Date;
  level: string;
  category?: string | null;
  process?: string | null;
  step?: string | null;
  requestId?: string | null;
  model?: string | null;
  durationMs?: number | null;
  tokensTotal?: number | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  costUsd?: number | null;
  prompt?: string | null;
  error?: string | null;
  message?: string | null;
  initiator?: string | null;
  rag?: any | null;
  input?: any | null;
  output?: any | null;
  quality?: any | null;
  meta?: any | null;
};

export type AILogQuery = {
  limit?: number;
  offset?: number;
  level?: string;
  category?: string;
  process?: string;
  from?: string;
  to?: string;
  rag?: string; // any truthy value -> has rag
  error?: string; // any truthy value -> has error
  q?: string; // search
};

export class AILogService {
  static async insert(entry: AILogInsert) {
    try {
      await prisma.aILog.create({
        data: {
          timestamp: entry.timestamp ?? new Date(),
          level: entry.level,
          category: entry.category ?? null,
          process: entry.process ?? null,
          step: entry.step ?? null,
          requestId: entry.requestId ?? null,
          model: entry.model ?? null,
          durationMs: entry.durationMs ?? null,
          tokensTotal: entry.tokensTotal ?? null,
          tokensInput: entry.tokensInput ?? null,
          tokensOutput: entry.tokensOutput ?? null,
          costUsd: entry.costUsd ?? null,
          prompt: entry.prompt ?? null,
          error: entry.error ?? null,
          message: entry.message ?? null,
          initiator: entry.initiator ?? null,
          rag: entry.rag ?? undefined,
          input: entry.input ?? undefined,
          output: entry.output ?? undefined,
          quality: entry.quality ?? undefined,
          meta: entry.meta ?? undefined,
        },
      });
    } catch (e) {
      // Swallow to avoid impacting runtime if DB is unreachable
    }
  }

  static async query(params: AILogQuery) {
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 1000);
    const offset = Math.max(Number(params.offset) || 0, 0);

    const where: any = {};
    if (params.level) where.level = params.level;
    if (params.category) where.category = params.category;
    if (params.process) where.process = params.process;

    // Date range
    if (params.from || params.to) {
      where.timestamp = {} as any;
      if (params.from) (where.timestamp as any).gte = new Date(params.from);
      if (params.to) (where.timestamp as any).lte = new Date(params.to);
    }

    // has rag
    if (params.rag) where.rag = { not: null };
    // has error
    if (params.error) where.error = { not: null };

    // Basic text search across a few string fields
    // Prisma doesn't support full-text across JSON without extra extensions
    const q = params.q?.trim();
    let searchOr: any[] = [];
    if (q) {
      searchOr = [
        { message: { contains: q, mode: "insensitive" } },
        { prompt: { contains: q, mode: "insensitive" } },
        { step: { contains: q, mode: "insensitive" } },
        { process: { contains: q, mode: "insensitive" } },
        { requestId: { contains: q, mode: "insensitive" } },
        { error: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.aILog.count({ where: q ? { AND: [where], OR: searchOr } : where }),
      prisma.aILog.findMany({
        where: q ? { AND: [where], OR: searchOr } : where,
        orderBy: { timestamp: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return { total, items };
  }
}
