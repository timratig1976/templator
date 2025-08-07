import { PrismaClient, ModuleTemplate } from '@prisma/client';
import { DatabaseService } from './DatabaseService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export interface TemplateSearchCriteria {
  category?: string;
  complexity?: string;
  tags?: string[];
  name?: string;
}

export class TemplateRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance().getPrisma();
  }

  async create(template: Omit<ModuleTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModuleTemplate> {
    try {
      const created = await this.prisma.moduleTemplate.create({
        data: template,
      });
      logger.info('Template created in database', { templateId: created.id, name: created.name });
      return created;
    } catch (error) {
      logger.error('Failed to create template in database', { error, templateName: template.name });
      throw error;
    }
  }

  async findById(id: string): Promise<ModuleTemplate | null> {
    try {
      return await this.prisma.moduleTemplate.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find template by id', { error, templateId: id });
      throw error;
    }
  }

  async findByCategory(category: string): Promise<ModuleTemplate[]> {
    try {
      return await this.prisma.moduleTemplate.findMany({
        where: { category },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find templates by category', { error, category });
      throw error;
    }
  }

  async search(criteria: TemplateSearchCriteria): Promise<ModuleTemplate[]> {
    try {
      const where: any = {};

      if (criteria.category) {
        where.category = criteria.category;
      }

      if (criteria.complexity) {
        where.complexity = criteria.complexity;
      }

      if (criteria.name) {
        where.name = {
          contains: criteria.name,
          mode: 'insensitive',
        };
      }

      if (criteria.tags && criteria.tags.length > 0) {
        where.tags = {
          hasSome: criteria.tags,
        };
      }

      return await this.prisma.moduleTemplate.findMany({
        where,
        orderBy: [
          { usageCount: 'desc' },
          { rating: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    } catch (error) {
      logger.error('Failed to search templates', { error, criteria });
      throw error;
    }
  }

  async update(id: string, data: Partial<Omit<ModuleTemplate, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ModuleTemplate> {
    try {
      const updated = await this.prisma.moduleTemplate.update({
        where: { id },
        data,
      });
      logger.info('Template updated in database', { templateId: id });
      return updated;
    } catch (error) {
      logger.error('Failed to update template', { error, templateId: id });
      throw error;
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      await this.prisma.moduleTemplate.update({
        where: { id },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
      logger.debug('Template usage count incremented', { templateId: id });
    } catch (error) {
      logger.error('Failed to increment template usage', { error, templateId: id });
      throw error;
    }
  }

  async updateRating(id: string, rating: number): Promise<void> {
    try {
      await this.prisma.moduleTemplate.update({
        where: { id },
        data: { rating },
      });
      logger.info('Template rating updated', { templateId: id, rating });
    } catch (error) {
      logger.error('Failed to update template rating', { error, templateId: id });
      throw error;
    }
  }

  async findAll(): Promise<ModuleTemplate[]> {
    try {
      return await this.prisma.moduleTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find all templates', { error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.moduleTemplate.delete({
        where: { id },
      });
      logger.info('Template deleted from database', { templateId: id });
    } catch (error) {
      logger.error('Failed to delete template', { error, templateId: id });
      throw error;
    }
  }

  async getStats(): Promise<{
    totalTemplates: number;
    categoryCounts: Record<string, number>;
    averageRating: number;
    totalUsage: number;
  }> {
    try {
      const totalTemplates = await this.prisma.moduleTemplate.count();
      
      const templates = await this.prisma.moduleTemplate.findMany({
        select: {
          category: true,
          rating: true,
          usageCount: true,
        },
      });

      const categoryCounts: Record<string, number> = {};
      let totalRating = 0;
      let ratedCount = 0;
      let totalUsage = 0;

      templates.forEach(template => {
        categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1;
        
        if (template.rating !== null) {
          totalRating += template.rating;
          ratedCount++;
        }
        
        totalUsage += template.usageCount;
      });

      return {
        totalTemplates,
        categoryCounts,
        averageRating: ratedCount > 0 ? totalRating / ratedCount : 0,
        totalUsage,
      };
    } catch (error) {
      logger.error('Failed to get template stats', { error });
      throw error;
    }
  }
}

export default TemplateRepository;
