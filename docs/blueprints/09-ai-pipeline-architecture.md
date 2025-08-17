# 🤖 AI Pipeline Architecture Blueprint
## OpenAI Integration, Prompt Engineering, RAG & Content Processing

*Comprehensive AI pipeline implementation covering OpenAI integration, progressive enhancement patterns, prompt engineering, RAG systems, and intelligent content processing. Production-ready patterns for AI-powered applications.*

---

Quick links: [Database Integration](#db-integration)

## 🎯 **AI Architecture Principles**

### **Core Components**
- **Progressive Enhancement**: Lightweight operations before expensive AI calls
- **OpenAI Integration**: GPT-4 Vision, text completion, and embedding models
- **Prompt Engineering**: Structured, context-aware prompt templates
- **RAG Systems**: Retrieval-Augmented Generation for knowledge enhancement
- **Content Processing**: Image analysis, text extraction, and structured output

### **Quality Standards**
- **Cost Optimization**: Minimize API calls through caching and progressive enhancement
- **Response Quality**: Structured outputs with validation and fallback handling
- **Performance**: <30s for complex AI operations, <5s for simple queries
- **Reliability**: 99.5% success rate with comprehensive error handling
- **Security**: Input sanitization and output validation for all AI interactions

---

## 🚀 **Progressive Enhancement Pipeline**

### **Multi-Phase AI Pipeline**
```typescript
// src/services/ai/AIFirstPipelineService.ts
export interface PipelineResult {
  phase: string;
  sessionId: string;
  data?: any;
  suggestions?: any[];
  continueFunction?: (input: any) => Promise<PipelineResult>;
}

export class AIFirstPipelineService {
  constructor(
    private openaiService: OpenAIService,
    private promptService: PromptService,
    private ragService: RAGService,
    private logger: Logger,
    private webSocket: WebSocketService,
    private cache: CacheService
  ) {}

  async executeProgressivePipeline(file: Express.Multer.File, userId: string): Promise<PipelineResult> {
    const sessionId = this.generateSessionId();
    
    try {
      // Phase 1: Lightweight section detection (fast, cheap)
      const suggestions = await this.generateLightweightSuggestions(file);
      
      await this.updateProgress(sessionId, userId, 'section-detection', 20, 'Analyzing design sections...');
      
      return {
        phase: 'section-detection',
        sessionId,
        suggestions,
        continueFunction: (confirmedSections) => 
          this.continueWithFullAnalysis(sessionId, confirmedSections)
      };
      
    } catch (error) {
      await this.logError(sessionId, 'pipeline-execution', error);
      throw error;
    }
  }

  private async continueWithFullAnalysis(sessionId: string, confirmedSections: Section[]): Promise<PipelineResult> {
    try {
      const sessionData = await this.cache.get(`session:${sessionId}`);
      const file = this.reconstructFileFromSession(sessionData.file);
      const userId = sessionData.userId;

      // Phase 2: Full AI Vision Analysis
      await this.updateProgress(sessionId, userId, 'ai-analysis', 40, 'Running AI vision analysis...');
      const analysis = await this.openaiService.analyzeDesignWithSections(file, confirmedSections);
      
      // Phase 3: Smart splitting with confirmed sections
      await this.updateProgress(sessionId, userId, 'smart-splitting', 60, 'Applying intelligent content splitting...');
      const smartSplit = await this.applySplittingLogic(analysis, confirmedSections);
      
      // Phase 4: HTML generation with RAG enhancement
      await this.updateProgress(sessionId, userId, 'html-generation', 80, 'Generating optimized HTML...');
      const html = await this.generateEnhancedHTML(smartSplit, analysis);
      
      // Phase 5: Module packaging
      await this.updateProgress(sessionId, userId, 'module-packaging', 95, 'Packaging final module...');
      const module = await this.packageModule(html, analysis);
      
      await this.updateProgress(sessionId, userId, 'completed', 100, 'Pipeline completed successfully!');
      
      return { phase: 'completed', sessionId, data: module };
      
    } catch (error) {
      throw error;
    }
  }

  private async generateLightweightSuggestions(file: Express.Multer.File): Promise<Section[]> {
    const { width, height } = await sharp(file.buffer).metadata();
    const aspectRatio = width! / height!;
    
    const suggestions: Section[] = [
      {
        id: 'header',
        type: 'header',
        bounds: { x: 0, y: 0, width: width!, height: Math.min(height! * 0.15, 120) },
        confidence: 0.9,
        description: 'Header section with navigation and branding'
      },
      {
        id: 'content',
        type: 'content',
        bounds: { x: 0, y: height! * 0.25, width: width!, height: height! * 0.65 },
        confidence: 0.7,
        description: 'Main content area'
      },
      {
        id: 'footer',
        type: 'footer',
        bounds: { x: 0, y: height! * 0.9, width: width!, height: height! * 0.1 },
        confidence: 0.9,
        description: 'Footer section'
      }
    ];

    if (aspectRatio > 1.2) {
      suggestions.splice(1, 0, {
        id: 'hero',
        type: 'hero',
        bounds: { x: 0, y: height! * 0.15, width: width!, height: height! * 0.4 },
        confidence: 0.8,
        description: 'Hero section with main call-to-action'
      });
    }

    return suggestions;
  }

  private generateSessionId(): string {
    return `ai_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## 🧠 **OpenAI Service Integration**

### **Advanced OpenAI Service**
```typescript
// src/services/ai/OpenAIService.ts
export interface DesignAnalysis {
  structure: StructureElement[];
  styling: StylingRecommendations;
  content: ContentAnalysis;
  accessibility: AccessibilityRecommendations;
  responsive: ResponsiveGuidelines;
  metadata: AnalysisMetadata;
}

export class OpenAIService {
  private openai: OpenAI;
  private logger: Logger;
  private cache: CacheService;
  private promptService: PromptService;

  constructor(apiKey: string, logger: Logger, cache: CacheService, promptService: PromptService) {
    this.openai = new OpenAI({ apiKey });
    this.logger = logger;
    this.cache = cache;
    this.promptService = promptService;
  }

  async analyzeDesignWithSections(file: Express.Multer.File, sections: Section[]): Promise<DesignAnalysis> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Check cache first
      const cacheKey = `analysis:${this.hashFile(file)}:${this.hashSections(sections)}`;
      const cached = await this.cache.get<DesignAnalysis>(cacheKey);
      if (cached) {
        return cached;
      }

      const base64Image = file.buffer.toString('base64');
      const prompt = await this.promptService.createDesignAnalysisPrompt(sections, {
        includeAccessibility: true,
        includeResponsive: true,
        outputFormat: 'structured-json'
      });
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer. Analyze designs and generate production-ready HTML structure recommendations.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const duration = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokensUsed, 'gpt-4-vision-preview');
      
      this.logger.info('OpenAI analysis completed', {
        requestId, duration, tokensUsed, cost
      });

      const analysis = await this.parseAndValidateAnalysis(response.choices[0].message.content, requestId);
      await this.cache.set(cacheKey, analysis, { ttl: 3600 });
      
      return analysis;
      
    } catch (error) {
      this.logger.error('OpenAI API error', { requestId, error: error.message });
      return this.createFallbackAnalysis(sections);
    }
  }

  async generateTextContent(prompt: string, options?: { maxTokens?: number; temperature?: number; model?: string }): Promise<string> {
    const model = options?.model || 'gpt-4-turbo-preview';
    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature || 0.7
    });

    return response.choices[0].message.content || '';
  }

  async createEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${this.hashText(text)}`;
    const cached = await this.cache.get<number[]>(cacheKey);
    if (cached) return cached;

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });

    const embedding = response.data[0].embedding;
    await this.cache.set(cacheKey, embedding, { ttl: 86400 });
    
    return embedding;
  }

  private calculateCost(tokens: number, model: string): number {
    const pricing: Record<string, number> = {
      'gpt-4-vision-preview': 0.01,
      'gpt-4-turbo-preview': 0.01,
      'text-embedding-3-small': 0.00002
    };
    return (tokens / 1000) * (pricing[model] || 0.01);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashFile(file: Express.Multer.File): string {
    return crypto.createHash('md5').update(file.buffer).digest('hex');
  }

  private hashSections(sections: Section[]): string {
    return crypto.createHash('md5').update(JSON.stringify(sections)).digest('hex');
  }

  private hashText(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }
}
```

---

## 📝 **Prompt Engineering Service**

### **Advanced Prompt Management**
```typescript
// src/services/ai/PromptService.ts
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: 'analysis' | 'generation' | 'enhancement';
}

export class PromptService {
  private templates = new Map<string, PromptTemplate>();

  constructor(private logger: Logger) {
    this.initializeTemplates();
  }

  async createDesignAnalysisPrompt(sections: Section[], options: any): Promise<string> {
    const template = this.templates.get('design-analysis');
    if (!template) throw new Error('Design analysis template not found');

    return this.renderTemplate(template.template, { sections, options });
  }

  async createContentGenerationPrompt(sectionType: string, context: any): Promise<string> {
    const template = this.templates.get('content-generation');
    if (!template) throw new Error('Content generation template not found');

    return this.renderTemplate(template.template, { sectionType, context });
  }

  private initializeTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: 'design-analysis',
        name: 'Design Analysis',
        category: 'analysis',
        variables: ['sections', 'options'],
        template: `
Analyze this web design image and provide detailed HTML structure recommendations.

SECTIONS IDENTIFIED:
{{#each sections}}
- {{type}}: {{description}} (Confidence: {{confidence}})
{{/each}}

REQUIREMENTS:
1. HTML Structure: Semantic HTML5 for each section
2. CSS Classes: TailwindCSS recommendations
3. Content Hierarchy: Proper heading levels
4. Accessibility: WCAG 2.1 AA compliance
5. Responsive: Mobile-first considerations

Return valid JSON with structure, styling, content, accessibility, and responsive fields.
        `
      },
      {
        id: 'content-generation',
        name: 'Content Generation',
        category: 'generation',
        variables: ['sectionType', 'context'],
        template: `
Generate {{context.tone}} content for a {{sectionType}} section.

Requirements:
- Tone: {{context.tone}}
- Length: {{context.length}}
- Format: HTML with semantic tags
- Include engaging, conversion-focused content

Return clean HTML with TailwindCSS classes.
        `
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private renderTemplate(template: string, variables: any): string {
    // Simple template rendering - in production, use Handlebars or similar
    let rendered = template;
    
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    return rendered;
  }
}
```

---

## 🔍 **RAG (Retrieval-Augmented Generation)**

### **Knowledge Base Integration**
```typescript
// src/services/ai/RAGService.ts
export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding?: number[];
  metadata: Record<string, any>;
}

export class RAGService {
  constructor(
    private openaiService: OpenAIService,
    private cache: CacheService,
    private logger: Logger
  ) {}

  async enhancePromptWithContext(prompt: string, category?: string): Promise<string> {
    try {
      // Create embedding for the prompt
      const promptEmbedding = await this.openaiService.createEmbedding(prompt);
      
      // Find relevant documents
      const relevantDocs = await this.findRelevantDocuments(promptEmbedding, category);
      
      if (relevantDocs.length === 0) {
        return prompt;
      }

      // Build enhanced prompt with context
      const context = relevantDocs.map(doc => `
Title: ${doc.title}
Content: ${doc.content.substring(0, 500)}...
      `).join('\n\n');

      return `
CONTEXT INFORMATION:
${context}

ORIGINAL REQUEST:
${prompt}

Please use the context information above to provide a more accurate and detailed response.
      `;
      
    } catch (error) {
      this.logger.error('RAG enhancement failed', { error: error.message });
      return prompt; // Fallback to original prompt
    }
  }

  async addKnowledgeDocument(doc: Omit<KnowledgeDocument, 'embedding'>): Promise<void> {
    try {
      // Create embedding for the document
      const embedding = await this.openaiService.createEmbedding(doc.content);
      
      const documentWithEmbedding: KnowledgeDocument = {
        ...doc,
        embedding
      };

      // Store in cache (in production, use a vector database)
      await this.cache.set(`knowledge:${doc.id}`, documentWithEmbedding, { ttl: 86400 * 7 });
      
      this.logger.info('Knowledge document added', { id: doc.id, category: doc.category });
      
    } catch (error) {
      this.logger.error('Failed to add knowledge document', { id: doc.id, error: error.message });
    }
  }

  private async findRelevantDocuments(queryEmbedding: number[], category?: string, limit = 3): Promise<KnowledgeDocument[]> {
    // In production, use a proper vector database like Pinecone, Weaviate, or Chroma
    // This is a simplified implementation for demonstration
    
    const allDocs = await this.getAllKnowledgeDocuments();
    
    // Filter by category if specified
    const filteredDocs = category 
      ? allDocs.filter(doc => doc.category === category)
      : allDocs;

    // Calculate similarity scores
    const docsWithScores = filteredDocs.map(doc => ({
      doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding!)
    }));

    // Sort by similarity and return top results
    return docsWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(item => item.score > 0.7) // Similarity threshold
      .map(item => item.doc);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async getAllKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    // In production, query your vector database
    // This is a simplified cache-based implementation
    const keys = await this.cache.redis.keys('knowledge:*');
    const docs: KnowledgeDocument[] = [];
    
    for (const key of keys) {
      const doc = await this.cache.get<KnowledgeDocument>(key.replace('templator:', ''));
      if (doc) docs.push(doc);
    }
    
    return docs;
  }
}
```

---

## 📋 **AI Pipeline Checklist**

### **OpenAI Integration**
- [ ] Configure OpenAI API with proper error handling
- [ ] Implement cost tracking and usage monitoring
- [ ] Set up response caching for expensive operations
- [ ] Add request rate limiting and retry logic
- [ ] Implement fallback responses for API failures

### **Prompt Engineering**
- [ ] Create structured prompt templates
- [ ] Implement dynamic prompt generation
- [ ] Add prompt versioning and A/B testing
- [ ] Set up prompt performance monitoring
- [ ] Create prompt optimization workflows

### **RAG Implementation**
- [ ] Set up vector database for knowledge storage
- [ ] Implement document embedding and indexing
- [ ] Create similarity search functionality
- [ ] Add knowledge base management interface
- [ ] Set up automated knowledge updates

### **Pipeline Optimization**
- [ ] Implement progressive enhancement patterns
- [ ] Add real-time progress tracking
- [ ] Set up comprehensive logging and monitoring
- [ ] Create cost optimization strategies
- [ ] Implement quality assurance checks

---

<a id="db-integration"></a>
## 🗄️ Database Integration
- Prompt operations: use `PromptTemplate`, `PromptVersion`, `PromptRun`, `PromptABTest`, `ABExposure`, `PromptFeedback` (see AI Maintenance blueprint for schema and ownership)
- Telemetry: log pipeline spans and outcomes to `AnalyticsEvent` and link via `requestId`/`sessionId`
- Caching: metadata (keys, TTLs) can live in Redis; DB used for durable runs/metrics only
- Migration ownership: AI service owns prompt/quality tables; platform owns analytics tables

---

## 🔗 Related Blueprints
- `11-ai-maintenance-and-quality.md` — Prompt versioning, evaluation, A/B testing, rollback
- `13-rag-systems.md` — Retrieval strategies, embeddings, vector stores, evaluation

---

*This AI pipeline blueprint provides comprehensive patterns for building intelligent, cost-effective AI-powered applications with robust error handling, optimization, and scalability.*
