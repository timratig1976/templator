import { createLogger } from '../../utils/logger';
import HTMLStorageService from '../storage/HTMLStorageService';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger();

export interface SectionComparison {
  id: string;
  originalImagePath: string;
  originalImageBase64?: string;
  generatedHtml: string;
  generatedCss: string;
  prompt: string;
  enhancedPrompt: string;
  context: any;
  quality: {
    userRating?: number; // 1-5 stars
    automaticScore?: number;
    accessibility?: number;
    responsiveness?: number;
    codeQuality?: number;
    visualSimilarity?: number;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    sectionType: string;
    tags: string[];
  };
  feedback?: {
    userComments?: string;
    improvements?: string[];
    issues?: string[];
  };
}

export interface ComparisonSession {
  sessionId: string;
  projectId: string;
  sections: SectionComparison[];
  bestVersions: { [sectionId: string]: string }; // sectionId -> comparisonId
  createdAt: string;
  updatedAt: string;
}

export class SectionComparisonService {
  private htmlStorage: HTMLStorageService;
  private comparisons: Map<string, SectionComparison> = new Map();
  private sessions: Map<string, ComparisonSession> = new Map();
  private storageDir: string;

  constructor() {
    this.htmlStorage = new HTMLStorageService();
    this.storageDir = path.join(process.cwd(), 'storage', 'comparisons');
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'sessions'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create comparison storage directories', { error });
    }
  }

  /**
   * Create a new section comparison
   */
  async createComparison(data: {
    originalImagePath: string;
    generatedHtml: string;
    generatedCss: string;
    prompt: string;
    enhancedPrompt: string;
    context: any;
    sectionType: string;
    projectId?: string;
  }): Promise<SectionComparison> {
    const comparisonId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert image to base64 for easy display
    let imageBase64: string | undefined;
    try {
      const imageBuffer = await fs.readFile(data.originalImagePath);
      imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      logger.warn('Failed to convert image to base64', { error, path: data.originalImagePath });
    }

    const comparison: SectionComparison = {
      id: comparisonId,
      originalImagePath: data.originalImagePath,
      originalImageBase64: imageBase64,
      generatedHtml: data.generatedHtml,
      generatedCss: data.generatedCss,
      prompt: data.prompt,
      enhancedPrompt: data.enhancedPrompt,
      context: data.context,
      quality: {},
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        sectionType: data.sectionType,
        tags: []
      }
    };

    this.comparisons.set(comparisonId, comparison);
    await this.saveComparison(comparison);

    logger.info('Section comparison created', { 
      comparisonId, 
      sectionType: data.sectionType,
      projectId: data.projectId 
    });

    return comparison;
  }

  /**
   * Update comparison with user rating and feedback
   */
  async updateComparisonRating(
    comparisonId: string, 
    rating: {
      userRating?: number;
      userComments?: string;
      improvements?: string[];
      issues?: string[];
    }
  ): Promise<SectionComparison | null> {
    const comparison = this.comparisons.get(comparisonId);
    if (!comparison) {
      logger.warn('Comparison not found for rating update', { comparisonId });
      return null;
    }

    // Update quality rating
    if (rating.userRating !== undefined) {
      comparison.quality.userRating = rating.userRating;
    }

    // Update feedback
    comparison.feedback = {
      ...comparison.feedback,
      userComments: rating.userComments,
      improvements: rating.improvements,
      issues: rating.issues
    };

    comparison.metadata.updatedAt = new Date().toISOString();
    
    await this.saveComparison(comparison);

    logger.info('Comparison rating updated', { 
      comparisonId, 
      userRating: rating.userRating 
    });

    return comparison;
  }

  /**
   * Create a new version of a comparison (regeneration)
   */
  async createComparisonVersion(
    originalComparisonId: string,
    newData: {
      generatedHtml: string;
      generatedCss: string;
      prompt: string;
      enhancedPrompt: string;
      context: any;
    }
  ): Promise<SectionComparison | null> {
    const originalComparison = this.comparisons.get(originalComparisonId);
    if (!originalComparison) {
      logger.warn('Original comparison not found for versioning', { originalComparisonId });
      return null;
    }

    const newComparisonId = `${originalComparisonId}_v${originalComparison.metadata.version + 1}`;
    
    const newComparison: SectionComparison = {
      ...originalComparison,
      id: newComparisonId,
      generatedHtml: newData.generatedHtml,
      generatedCss: newData.generatedCss,
      prompt: newData.prompt,
      enhancedPrompt: newData.enhancedPrompt,
      context: newData.context,
      quality: {}, // Reset quality for new version
      metadata: {
        ...originalComparison.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: originalComparison.metadata.version + 1
      },
      feedback: undefined // Reset feedback for new version
    };

    this.comparisons.set(newComparisonId, newComparison);
    await this.saveComparison(newComparison);

    logger.info('New comparison version created', { 
      originalId: originalComparisonId,
      newId: newComparisonId,
      version: newComparison.metadata.version
    });

    return newComparison;
  }

  /**
   * Get comparison by ID
   */
  getComparison(comparisonId: string): SectionComparison | null {
    return this.comparisons.get(comparisonId) || null;
  }

  /**
   * Get all versions of a comparison
   */
  getComparisonVersions(baseComparisonId: string): SectionComparison[] {
    const baseId = baseComparisonId.split('_v')[0];
    const versions: SectionComparison[] = [];
    
    for (const [id, comparison] of this.comparisons) {
      if (id.startsWith(baseId)) {
        versions.push(comparison);
      }
    }
    
    return versions.sort((a, b) => a.metadata.version - b.metadata.version);
  }

  /**
   * Get best rated comparisons for learning
   */
  getBestComparisons(minRating: number = 4, limit: number = 10): SectionComparison[] {
    const bestComparisons = Array.from(this.comparisons.values())
      .filter(comp => comp.quality.userRating && comp.quality.userRating >= minRating)
      .sort((a, b) => (b.quality.userRating || 0) - (a.quality.userRating || 0))
      .slice(0, limit);

    logger.info('Retrieved best comparisons', { 
      count: bestComparisons.length, 
      minRating, 
      limit 
    });

    return bestComparisons;
  }

  /**
   * Create comparison session for a project
   */
  async createComparisonSession(projectId: string): Promise<ComparisonSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ComparisonSession = {
      sessionId,
      projectId,
      sections: [],
      bestVersions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    logger.info('Comparison session created', { sessionId, projectId });

    return session;
  }

  /**
   * Add comparison to session
   */
  async addComparisonToSession(sessionId: string, comparison: SectionComparison): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found', { sessionId });
      return;
    }

    session.sections.push(comparison);
    session.updatedAt = new Date().toISOString();
    
    await this.saveSession(session);

    logger.info('Comparison added to session', { sessionId, comparisonId: comparison.id });
  }

  /**
   * Mark comparison as best version for a section
   */
  async markAsBestVersion(sessionId: string, sectionId: string, comparisonId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found', { sessionId });
      return;
    }

    session.bestVersions[sectionId] = comparisonId;
    session.updatedAt = new Date().toISOString();
    
    await this.saveSession(session);

    logger.info('Best version marked', { sessionId, sectionId, comparisonId });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ComparisonSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Save comparison to disk
   */
  private async saveComparison(comparison: SectionComparison): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${comparison.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(comparison, null, 2));
    } catch (error) {
      logger.error('Failed to save comparison', { error, comparisonId: comparison.id });
    }
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: ComparisonSession): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, 'sessions', `${session.sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      logger.error('Failed to save session', { error, sessionId: session.sessionId });
    }
  }

  /**
   * Load all comparisons and sessions from disk
   */
  async loadFromStorage(): Promise<void> {
    try {
      // Load comparisons
      const comparisonFiles = await fs.readdir(this.storageDir);
      for (const file of comparisonFiles) {
        if (file.endsWith('.json') && !file.startsWith('session_')) {
          try {
            const filePath = path.join(this.storageDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const comparison: SectionComparison = JSON.parse(content);
            this.comparisons.set(comparison.id, comparison);
          } catch (error) {
            logger.warn('Failed to load comparison file', { file, error });
          }
        }
      }

      // Load sessions
      const sessionDir = path.join(this.storageDir, 'sessions');
      try {
        const sessionFiles = await fs.readdir(sessionDir);
        for (const file of sessionFiles) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(sessionDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              const session: ComparisonSession = JSON.parse(content);
              this.sessions.set(session.sessionId, session);
            } catch (error) {
              logger.warn('Failed to load session file', { file, error });
            }
          }
        }
      } catch (error) {
        // Sessions directory might not exist yet
        logger.info('Sessions directory not found, will be created on first use');
      }

      logger.info('Comparison data loaded from storage', { 
        comparisons: this.comparisons.size,
        sessions: this.sessions.size
      });

    } catch (error) {
      logger.error('Failed to load comparison data from storage', { error });
    }
  }

  /**
   * Get statistics for learning and improvement
   */
  getComparisonStats(): {
    totalComparisons: number;
    averageRating: number;
    bestSectionTypes: { [type: string]: number };
    commonIssues: string[];
    improvementSuggestions: string[];
  } {
    const comparisons = Array.from(this.comparisons.values());
    const ratedComparisons = comparisons.filter(c => c.quality.userRating);
    
    const averageRating = ratedComparisons.length > 0 
      ? ratedComparisons.reduce((sum, c) => sum + (c.quality.userRating || 0), 0) / ratedComparisons.length
      : 0;

    const sectionTypes: { [type: string]: number } = {};
    const issues: string[] = [];
    const improvements: string[] = [];

    comparisons.forEach(comp => {
      // Count section types
      sectionTypes[comp.metadata.sectionType] = (sectionTypes[comp.metadata.sectionType] || 0) + 1;
      
      // Collect feedback
      if (comp.feedback?.issues) {
        issues.push(...comp.feedback.issues);
      }
      if (comp.feedback?.improvements) {
        improvements.push(...comp.feedback.improvements);
      }
    });

    return {
      totalComparisons: comparisons.length,
      averageRating,
      bestSectionTypes: sectionTypes,
      commonIssues: [...new Set(issues)],
      improvementSuggestions: [...new Set(improvements)]
    };
  }
}

export default SectionComparisonService;
