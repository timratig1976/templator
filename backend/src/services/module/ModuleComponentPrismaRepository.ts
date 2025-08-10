import prisma from '../database/prismaClient';
import { Prisma } from '@prisma/client';
import { createLogger } from '../../utils/logger';
import {
  ComponentCategory,
  ComponentFeedback,
  ComponentSearchQuery,
  ComponentSearchResult,
  ComponentType,
  ModuleComponent,
} from './ModuleComponentRepository';

const logger = createLogger();

// Adapter to map between our in-memory ModuleComponent shape and Prisma's ModuleComponent model
function toDomain(row: any): ModuleComponent {
  return {
    component_id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category as ComponentCategory,
    type: row.type as ComponentType,
    complexity_level: row.complexity_level,
    hubspot_version_compatibility: row.hubspot_version_compatibility || [],

    html_template: row.html_template,
    css_styles: row.css_styles ?? undefined,
    javascript_code: row.javascript_code ?? undefined,
    fields_definition: (row.fields_definition ?? []) as any,

    created_at: row.created_at,
    updated_at: row.updated_at,
    version: row.version,
    author: row.author,
    tags: row.tags || [],

    quality_score: row.quality_score ?? 0,
    usage_count: row.usage_count ?? 0,
    rating: (row.rating ?? { average_rating: 0, total_ratings: 0, rating_distribution: {}, recent_feedback: [] }) as any,
    validation_status: row.validation_status,

    dependencies: (row.dependencies ?? []) as any,
    interfaces: (row.interfaces ?? []) as any,
  } as ModuleComponent;
}

function toRow(component: ModuleComponent) {
  return {
    id: component.component_id,
    name: component.name,
    description: component.description,
    category: component.category,
    type: component.type,
    complexity_level: component.complexity_level,
    hubspot_version_compatibility: component.hubspot_version_compatibility,

    html_template: component.html_template,
    css_styles: component.css_styles ?? null,
    javascript_code: component.javascript_code ?? null,
    fields_definition: component.fields_definition as unknown as Prisma.InputJsonValue,

    version: component.version,
    author: component.author,
    tags: component.tags,

    quality_score: component.quality_score,
    usage_count: component.usage_count,
    validation_status: component.validation_status,

    rating: component.rating as unknown as Prisma.InputJsonValue,
    dependencies: component.dependencies as unknown as Prisma.InputJsonValue,
    interfaces: component.interfaces as unknown as Prisma.InputJsonValue,
  };
}

export class ModuleComponentPrismaRepository {
  private static instance: ModuleComponentPrismaRepository;

  public static getInstance(): ModuleComponentPrismaRepository {
    if (!ModuleComponentPrismaRepository.instance) {
      ModuleComponentPrismaRepository.instance = new ModuleComponentPrismaRepository();
    }
    return ModuleComponentPrismaRepository.instance;
  }

  async addComponent(component: Omit<ModuleComponent, 'created_at' | 'updated_at'>): Promise<string> {
    const data = toRow(component as ModuleComponent);
    const created = await prisma.moduleComponent.create({ data });
    logger.info('DB: Component added', { componentId: created.id, name: created.name });
    return created.id;
  }

  async getComponent(componentId: string, trackUsage: boolean = true): Promise<ModuleComponent | null> {
    const row = await prisma.moduleComponent.findUnique({ where: { id: componentId } });
    if (!row) return null;
    if (trackUsage) {
      await prisma.moduleComponent.update({ where: { id: componentId }, data: { usage_count: { increment: 1 } } });
      const updated = await prisma.moduleComponent.findUnique({ where: { id: componentId } });
      return updated ? toDomain(updated) : null;
    }
    return toDomain(row);
  }

  async rateComponent(componentId: string, rating: number, feedback?: Omit<ComponentFeedback, 'feedback_id' | 'created_at'>): Promise<void> {
    const row = await prisma.moduleComponent.findUnique({ where: { id: componentId } });
    if (!row) throw new Error(`Component not found: ${componentId}`);
    const ratingObj = (row.rating || { average_rating: 0, total_ratings: 0, rating_distribution: {}, recent_feedback: [] }) as any;

    // update distribution
    ratingObj.rating_distribution[rating] = (ratingObj.rating_distribution[rating] || 0) + 1;
    ratingObj.total_ratings = (ratingObj.total_ratings || 0) + 1;
    const totalScore = Object.entries(ratingObj.rating_distribution).reduce((sum, [score, count]) => sum + Number(score) * (count as number), 0);
    ratingObj.average_rating = ratingObj.total_ratings > 0 ? totalScore / ratingObj.total_ratings : 0;

    if (feedback) {
      const composed = {
        ...feedback,
        feedback_id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        created_at: new Date(),
      };
      ratingObj.recent_feedback = [...(ratingObj.recent_feedback || []), composed].slice(-50);
    }

    await prisma.moduleComponent.update({ where: { id: componentId }, data: { rating: ratingObj } });
    logger.info('DB: Component rated', { componentId, rating, newAverage: ratingObj.average_rating });
  }

  async getComponentsByCategory(category: ComponentCategory, limit: number = 10): Promise<ModuleComponent[]> {
    const rows = await prisma.moduleComponent.findMany({ where: { category }, orderBy: { quality_score: 'desc' }, take: limit });
    return rows.map(toDomain);
  }

  async getPopularComponents(limit: number = 10): Promise<ModuleComponent[]> {
    const rows = await prisma.moduleComponent.findMany({
      orderBy: [
        { usage_count: 'desc' },
      ],
      take: limit,
    });
    return rows.map(toDomain);
  }

  async searchComponents(query: ComponentSearchQuery): Promise<ComponentSearchResult> {
    const start = Date.now();
    const where: any = {};

    if (query.category) where.category = query.category;
    if (query.type) where.type = query.type;
    if (query.min_quality_score) where.quality_score = { gte: query.min_quality_score };
    if (query.tags?.length) where.tags = { hasSome: query.tags };
    if (query.complexity_level?.length) where.complexity_level = { in: query.complexity_level };

    if (query.query) {
      const q = query.query.toLowerCase();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const orderBy = (() => {
      switch (query.sort_by) {
        case 'quality': return { quality_score: 'desc' } as const;
        case 'popularity': return { usage_count: 'desc' } as const;
        case 'recent': return { updated_at: 'desc' } as const;
        default: return { quality_score: 'desc' } as const;
      }
    })();

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const [rows, total] = await Promise.all([
      prisma.moduleComponent.findMany({ where, orderBy, skip: offset, take: limit }),
      prisma.moduleComponent.count({ where }),
    ]);

    // facets (basic counts)
    const [categoriesAgg, typesAgg, complexityAgg] = await Promise.all([
      prisma.moduleComponent.groupBy({ by: ['category'], _count: { _all: true }, where }),
      prisma.moduleComponent.groupBy({ by: ['type'], _count: { _all: true }, where }),
      prisma.moduleComponent.groupBy({ by: ['complexity_level'], _count: { _all: true }, where }),
    ]);

    const facets: ComponentSearchResult['facets'] = {
      categories: Object.fromEntries(categoriesAgg.map((c: { category: string; _count: { _all: number } }) => [c.category, c._count._all])),
      types: Object.fromEntries(typesAgg.map((c: { type: string; _count: { _all: number } }) => [c.type, c._count._all])),
      complexity_levels: Object.fromEntries(complexityAgg.map((c: { complexity_level: string; _count: { _all: number } }) => [c.complexity_level, c._count._all])),
      tags: {}, // expensive to facet in SQL for arrays; can be added later if needed
    };

    return {
      components: rows.map(toDomain),
      total_count: total,
      facets,
      search_metadata: { query_time_ms: Date.now() - start },
    };
  }
}

export default ModuleComponentPrismaRepository;
