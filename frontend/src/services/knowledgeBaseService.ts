/**
 * Knowledge Base Service
 * Provides searchable documentation and help content
 */

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  last_updated: string;
  author: string;
  views: number;
  helpful_votes: number;
  total_votes: number;
  related_articles: string[];
  attachments?: {
    name: string;
    url: string;
    type: 'image' | 'video' | 'document';
  }[];
}

export interface KnowledgeBaseCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  article_count: number;
  subcategories?: KnowledgeBaseCategory[];
}

export interface SearchResult {
  article: KnowledgeBaseArticle;
  relevance_score: number;
  matched_sections: {
    section: string;
    content: string;
    highlight: string;
  }[];
}

export interface SearchFilters {
  category?: string;
  difficulty?: string;
  tags?: string[];
  date_range?: {
    start: string;
    end: string;
  };
}

class KnowledgeBaseService {
  private baseUrl: string;
  private articles: KnowledgeBaseArticle[] = [];
  private categories: KnowledgeBaseCategory[] = [];

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    this.initializeKnowledgeBase();
  }

  /**
   * Initialize knowledge base with sample content
   */
  private initializeKnowledgeBase(): void {
    this.categories = [
      {
        id: 'getting-started',
        name: 'Getting Started',
        description: 'Learn the basics of using Templator',
        icon: 'play-circle',
        article_count: 8
      },
      {
        id: 'module-creation',
        name: 'Module Creation',
        description: 'Creating and customizing HubSpot modules',
        icon: 'plus-square',
        article_count: 15
      },
      {
        id: 'validation',
        name: 'Validation & Testing',
        description: 'Ensuring module quality and compliance',
        icon: 'check-circle',
        article_count: 10
      },
      {
        id: 'deployment',
        name: 'Export & Deployment',
        description: 'Publishing modules to HubSpot',
        icon: 'upload',
        article_count: 12
      },
      {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Common issues and solutions',
        icon: 'alert-triangle',
        article_count: 20
      },
      {
        id: 'advanced',
        name: 'Advanced Features',
        description: 'Expert-level functionality and customization',
        icon: 'settings',
        article_count: 18
      }
    ];

    this.articles = [
      {
        id: 'quick-start-guide',
        title: 'Quick Start Guide',
        content: 'Learn how to create your first HubSpot module in under 5 minutes...',
        category: 'getting-started',
        tags: ['beginner', 'tutorial', 'first-steps'],
        difficulty: 'beginner',
        last_updated: '2024-01-15',
        author: 'Templator Team',
        views: 1250,
        helpful_votes: 45,
        total_votes: 50,
        related_articles: ['upload-design', 'field-configuration']
      },
      {
        id: 'upload-design',
        title: 'Uploading Your Design',
        content: 'Step-by-step guide to uploading and processing design files...',
        category: 'module-creation',
        tags: ['upload', 'design', 'images'],
        difficulty: 'beginner',
        last_updated: '2024-01-10',
        author: 'Design Team',
        views: 890,
        helpful_votes: 38,
        total_votes: 42,
        related_articles: ['supported-formats', 'design-best-practices']
      },
      {
        id: 'field-configuration',
        title: 'Configuring Module Fields',
        content: 'Complete guide to setting up and customizing module fields...',
        category: 'module-creation',
        tags: ['fields', 'configuration', 'customization'],
        difficulty: 'intermediate',
        last_updated: '2024-01-12',
        author: 'Development Team',
        views: 675,
        helpful_votes: 32,
        total_votes: 35,
        related_articles: ['field-types', 'validation-rules']
      },
      {
        id: 'validation-errors',
        title: 'Understanding Validation Errors',
        content: 'Common validation errors and how to fix them...',
        category: 'validation',
        tags: ['validation', 'errors', 'troubleshooting'],
        difficulty: 'intermediate',
        last_updated: '2024-01-08',
        author: 'QA Team',
        views: 1100,
        helpful_votes: 55,
        total_votes: 60,
        related_articles: ['auto-fix', 'hubspot-compliance']
      },
      {
        id: 'deployment-guide',
        title: 'Deploying to HubSpot',
        content: 'Complete guide to deploying modules directly to HubSpot...',
        category: 'deployment',
        tags: ['deployment', 'hubspot', 'credentials'],
        difficulty: 'intermediate',
        last_updated: '2024-01-14',
        author: 'Deployment Team',
        views: 950,
        helpful_votes: 42,
        total_votes: 45,
        related_articles: ['hubspot-setup', 'environment-management']
      }
    ];
  }

  /**
   * Search knowledge base articles
   */
  async searchArticles(
    query: string,
    filters?: SearchFilters,
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredArticles = this.articles;

    // Apply filters
    if (filters?.category) {
      filteredArticles = filteredArticles.filter(article => article.category === filters.category);
    }

    if (filters?.difficulty) {
      filteredArticles = filteredArticles.filter(article => article.difficulty === filters.difficulty);
    }

    if (filters?.tags && filters.tags.length > 0) {
      filteredArticles = filteredArticles.filter(article =>
        filters.tags!.some(tag => article.tags.includes(tag))
      );
    }

    // Perform search
    const searchResults: SearchResult[] = [];

    for (const article of filteredArticles) {
      const relevanceScore = this.calculateRelevance(article, query);
      
      if (relevanceScore > 0) {
        const matchedSections = this.findMatchedSections(article, query);
        
        searchResults.push({
          article,
          relevance_score: relevanceScore,
          matched_sections: matchedSections
        });
      }
    }

    // Sort by relevance and limit results
    return searchResults
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);
  }

  /**
   * Get article by ID
   */
  async getArticle(articleId: string): Promise<KnowledgeBaseArticle | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const article = this.articles.find(a => a.id === articleId);
    
    if (article) {
      // Increment view count
      article.views += 1;
    }
    
    return article || null;
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<KnowledgeBaseCategory[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.categories;
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(categoryId: string): Promise<KnowledgeBaseArticle[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.articles.filter(article => article.category === categoryId);
  }

  /**
   * Get popular articles
   */
  async getPopularArticles(limit: number = 5): Promise<KnowledgeBaseArticle[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return this.articles
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  /**
   * Get recent articles
   */
  async getRecentArticles(limit: number = 5): Promise<KnowledgeBaseArticle[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return this.articles
      .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
      .slice(0, limit);
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId: string): Promise<KnowledgeBaseArticle[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const article = this.articles.find(a => a.id === articleId);
    if (!article) return [];

    const relatedIds = article.related_articles || [];
    return this.articles.filter(a => relatedIds.includes(a.id));
  }

  /**
   * Vote on article helpfulness
   */
  async voteOnArticle(articleId: string, helpful: boolean): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const article = this.articles.find(a => a.id === articleId);
    if (!article) return false;

    article.total_votes += 1;
    if (helpful) {
      article.helpful_votes += 1;
    }

    return true;
  }

  /**
   * Get contextual help for specific features
   */
  async getContextualHelp(context: string): Promise<KnowledgeBaseArticle[]> {
    const contextMap: Record<string, string[]> = {
      'module-creation': ['quick-start-guide', 'upload-design', 'field-configuration'],
      'validation': ['validation-errors', 'auto-fix'],
      'deployment': ['deployment-guide', 'hubspot-setup'],
      'export': ['export-options', 'package-formats'],
      'versioning': ['version-management', 'rollback-guide']
    };

    const articleIds = contextMap[context] || [];
    const articles: KnowledgeBaseArticle[] = [];

    for (const id of articleIds) {
      const article = await this.getArticle(id);
      if (article) {
        articles.push(article);
      }
    }

    return articles;
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevance(article: KnowledgeBaseArticle, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title match (highest weight)
    if (article.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Tag match
    if (article.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
      score += 5;
    }

    // Content match (partial)
    if (article.content.toLowerCase().includes(queryLower)) {
      score += 3;
    }

    // Category match
    if (article.category.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    return score;
  }

  /**
   * Find matched sections in article content
   */
  private findMatchedSections(article: KnowledgeBaseArticle, query: string): {
    section: string;
    content: string;
    highlight: string;
  }[] {
    const queryLower = query.toLowerCase();
    const sections: { section: string; content: string; highlight: string }[] = [];

    // Check title
    if (article.title.toLowerCase().includes(queryLower)) {
      sections.push({
        section: 'title',
        content: article.title,
        highlight: this.highlightText(article.title, query)
      });
    }

    // Check content (first 200 characters around match)
    const contentLower = article.content.toLowerCase();
    const matchIndex = contentLower.indexOf(queryLower);
    
    if (matchIndex !== -1) {
      const start = Math.max(0, matchIndex - 100);
      const end = Math.min(article.content.length, matchIndex + 100);
      const excerpt = article.content.substring(start, end);
      
      sections.push({
        section: 'content',
        content: excerpt,
        highlight: this.highlightText(excerpt, query)
      });
    }

    return sections;
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(partial: string): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const suggestions: string[] = [];
    const partialLower = partial.toLowerCase();

    // Get suggestions from article titles
    this.articles.forEach(article => {
      if (article.title.toLowerCase().includes(partialLower)) {
        suggestions.push(article.title);
      }
    });

    // Get suggestions from tags
    const allTags = new Set<string>();
    this.articles.forEach(article => {
      article.tags.forEach(tag => {
        if (tag.toLowerCase().includes(partialLower)) {
          allTags.add(tag);
        }
      });
    });

    suggestions.push(...Array.from(allTags));

    // Remove duplicates and limit
    return Array.from(new Set(suggestions)).slice(0, 8);
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService;
