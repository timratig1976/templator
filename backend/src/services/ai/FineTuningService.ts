import { createLogger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger();

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Fine-Tuning Service (Optional Approach 3)
 * Manages OpenAI fine-tuning jobs for highly specialized HubSpot module generation
 */

interface TrainingExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

interface FineTuningJob {
  id: string;
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  model: string;
  trainingFile: string;
  validationFile?: string;
  createdAt: string;
  finishedAt?: string;
  fineTunedModel?: string;
  hyperparameters: {
    nEpochs: number;
    batchSize?: number;
    learningRateMultiplier?: number;
  };
}

export class FineTuningService {
  private static instance: FineTuningService;
  private trainingDataPath: string;
  private activeJobs: Map<string, FineTuningJob> = new Map();

  private constructor() {
    this.trainingDataPath = path.join(process.cwd(), 'data', 'fine-tuning');
  }

  static getInstance(): FineTuningService {
    if (!FineTuningService.instance) {
      FineTuningService.instance = new FineTuningService();
    }
    return FineTuningService.instance;
  }

  // ============================================================
  // TRAINING DATA PREPARATION
  // ============================================================

  /**
   * Prepare training data from successful pipeline outputs
   */
  async prepareTrainingData(): Promise<string> {
    logger.info('Preparing fine-tuning training data...');

    const trainingExamples: TrainingExample[] = [
      // HubSpot Module Structure Examples
      {
        messages: [
          {
            role: 'system',
            content: 'You are an expert HubSpot module developer. Generate high-quality, accessible HTML modules with proper HubSpot field integration.'
          },
          {
            role: 'user',
            content: 'Create a hero section module with title, subtitle, image, and CTA button fields.'
          },
          {
            role: 'assistant',
            content: `<div class="hero-section">
  <div class="hero-content">
    <h1 class="hero-title">{{ module.title }}</h1>
    <p class="hero-subtitle">{{ module.subtitle }}</p>
    <div class="hero-image">
      <img src="{{ module.image.src }}" alt="{{ module.image.alt }}" loading="lazy">
    </div>
    <a href="{{ module.cta_url }}" class="hero-cta btn btn-primary" aria-label="{{ module.cta_text }}">
      {{ module.cta_text }}
    </a>
  </div>
</div>

<style>
.hero-section {
  padding: 4rem 2rem;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-image img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.hero-cta {
  display: inline-block;
  padding: 1rem 2rem;
  background: rgba(255,255,255,0.2);
  border: 2px solid white;
  border-radius: 8px;
  color: white;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
}

.hero-cta:hover {
  background: white;
  color: #667eea;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .hero-title { font-size: 2rem; }
  .hero-section { padding: 2rem 1rem; }
}
</style>`
          }
        ]
      },
      
      // Accessibility-focused example
      {
        messages: [
          {
            role: 'system',
            content: 'You are an expert in web accessibility and HubSpot development. Always prioritize WCAG compliance and semantic HTML.'
          },
          {
            role: 'user',
            content: 'Create an accessible card grid module for displaying team members with images, names, and roles.'
          },
          {
            role: 'assistant',
            content: `<section class="team-grid" aria-labelledby="team-heading">
  <h2 id="team-heading" class="team-title">{{ module.section_title }}</h2>
  
  <div class="team-cards" role="list">
    {% for item in module.team_members %}
    <article class="team-card" role="listitem">
      <div class="team-image">
        <img src="{{ item.image.src }}" 
             alt="{{ item.image.alt or item.name }}"
             loading="lazy"
             width="300" 
             height="300">
      </div>
      <div class="team-info">
        <h3 class="team-name">{{ item.name }}</h3>
        <p class="team-role" aria-label="Role: {{ item.role }}">{{ item.role }}</p>
        {% if item.bio %}
        <p class="team-bio">{{ item.bio }}</p>
        {% endif %}
      </div>
    </article>
    {% endfor %}
  </div>
</section>

<style>
.team-grid {
  padding: 4rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.team-title {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: #333;
}

.team-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.team-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.team-card:hover,
.team-card:focus-within {
  transform: translateY(-5px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.team-image img {
  width: 100%;
  height: 300px;
  object-fit: cover;
}

.team-info {
  padding: 1.5rem;
}

.team-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.team-role {
  color: #667eea;
  font-weight: 500;
  margin-bottom: 1rem;
}

.team-bio {
  color: #666;
  line-height: 1.6;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .team-card {
    border: 2px solid #000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .team-card {
    transition: none;
  }
}

@media (max-width: 768px) {
  .team-cards {
    grid-template-columns: 1fr;
  }
  .team-title {
    font-size: 2rem;
  }
}
</style>`
          }
        ]
      }
    ];

    // Add more training examples based on successful outputs
    await this.collectSuccessfulOutputs(trainingExamples);

    // Save training data to file
    const trainingFile = path.join(this.trainingDataPath, `training-${Date.now()}.jsonl`);
    await this.ensureDirectoryExists(this.trainingDataPath);
    
    const trainingData = trainingExamples
      .map(example => JSON.stringify(example))
      .join('\n');
    
    await fs.writeFile(trainingFile, trainingData);
    
    logger.info(`Training data prepared: ${trainingExamples.length} examples`, {
      file: trainingFile,
      size: trainingData.length
    });

    return trainingFile;
  }

  /**
   * Collect successful pipeline outputs for training data
   */
  private async collectSuccessfulOutputs(trainingExamples: TrainingExample[]): Promise<void> {
    // This would integrate with your pipeline history to collect successful outputs
    // For now, we'll add some template examples
    
    const additionalExamples: TrainingExample[] = [
      // Performance-optimized example
      {
        messages: [
          {
            role: 'system',
            content: 'You are a performance optimization expert for HubSpot modules. Always prioritize fast loading and efficient CSS.'
          },
          {
            role: 'user',
            content: 'Create a high-performance image gallery module with lazy loading and responsive design.'
          },
          {
            role: 'assistant',
            content: `<div class="gallery-container">
  <div class="gallery-grid">
    {% for item in module.images %}
    <div class="gallery-item" data-aos="fade-up" data-aos-delay="{{ loop.index0 * 100 }}">
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3C/svg%3E"
           data-src="{{ item.src }}"
           alt="{{ item.alt }}"
           class="gallery-image lazy"
           loading="lazy"
           width="400"
           height="300">
      <div class="gallery-overlay">
        <h3 class="gallery-title">{{ item.title }}</h3>
      </div>
    </div>
    {% endfor %}
  </div>
</div>

<style>
.gallery-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  grid-auto-rows: 250px;
}

.gallery-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: #f8f9fa;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.gallery-image.lazy {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.gallery-image.loaded {
  opacity: 1;
}

.gallery-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  color: white;
  padding: 1rem;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.gallery-item:hover .gallery-overlay {
  transform: translateY(0);
}

.gallery-item:hover .gallery-image {
  transform: scale(1.05);
}

.gallery-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

/* Performance optimizations */
.gallery-item {
  will-change: transform;
  contain: layout style paint;
}

@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    grid-auto-rows: 200px;
  }
}
</style>

<script>
// Intersection Observer for lazy loading
const lazyImages = document.querySelectorAll('.lazy');
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.remove('lazy');
      img.classList.add('loaded');
      observer.unobserve(img);
    }
  });
});

lazyImages.forEach(img => imageObserver.observe(img));
</script>`
          }
        ]
      }
    ];

    trainingExamples.push(...additionalExamples);
  }

  // ============================================================
  // FINE-TUNING JOB MANAGEMENT
  // ============================================================

  /**
   * Create a fine-tuning job
   */
  async createFineTuningJob(
    trainingFile: string,
    model: string = 'gpt-3.5-turbo',
    hyperparameters: { nEpochs: number; batchSize?: number; learningRateMultiplier?: number } = { nEpochs: 3 }
  ): Promise<string> {
    try {
      logger.info('Creating fine-tuning job...', { model, hyperparameters });

      // Upload training file to OpenAI
      const fileId = await this.uploadTrainingFile(trainingFile);

      // Create fine-tuning job
      const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          training_file: fileId,
          model: model,
          hyperparameters: hyperparameters
        })
      });

      const job = await response.json();
      
      // Store job information
      this.activeJobs.set(job.id, {
        id: job.id,
        status: job.status,
        model: job.model,
        trainingFile: fileId,
        createdAt: job.created_at,
        hyperparameters: job.hyperparameters
      });

      logger.info('Fine-tuning job created successfully', { jobId: job.id });
      return job.id;

    } catch (error) {
      logger.error('Error creating fine-tuning job', { error: getErrorMessage(error) });
      throw error;
    }
  }

  /**
   * Upload training file to OpenAI
   */
  private async uploadTrainingFile(filePath: string): Promise<string> {
    const formData = new FormData();
    const fileContent = await fs.readFile(filePath);
    const blob = new Blob([fileContent], { type: 'application/jsonl' });
    
    formData.append('file', blob, path.basename(filePath));
    formData.append('purpose', 'fine-tune');

    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const result = await response.json();
    return result.id;
  }

  /**
   * Check fine-tuning job status
   */
  async checkJobStatus(jobId: string): Promise<FineTuningJob | null> {
    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      const job = await response.json();
      
      // Update stored job information
      if (this.activeJobs.has(jobId)) {
        const storedJob = this.activeJobs.get(jobId)!;
        storedJob.status = job.status;
        storedJob.finishedAt = job.finished_at;
        storedJob.fineTunedModel = job.fine_tuned_model;
        this.activeJobs.set(jobId, storedJob);
      }

      return {
        id: job.id,
        status: job.status,
        model: job.model,
        trainingFile: job.training_file,
        createdAt: job.created_at,
        finishedAt: job.finished_at,
        fineTunedModel: job.fine_tuned_model,
        hyperparameters: job.hyperparameters
      };

    } catch (error) {
      logger.error('Error checking job status', { jobId, error: getErrorMessage(error) });
      return null;
    }
  }

  /**
   * List all fine-tuning jobs
   */
  async listJobs(): Promise<FineTuningJob[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      const data = await response.json();
      return data.data.map((job: any) => ({
        id: job.id,
        status: job.status,
        model: job.model,
        trainingFile: job.training_file,
        createdAt: job.created_at,
        finishedAt: job.finished_at,
        fineTunedModel: job.fine_tuned_model,
        hyperparameters: job.hyperparameters
      }));

    } catch (error) {
      logger.error('Error listing jobs', { error: getErrorMessage(error) });
      return [];
    }
  }

  /**
   * Cancel a fine-tuning job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      const result = await response.json();
      
      if (this.activeJobs.has(jobId)) {
        const job = this.activeJobs.get(jobId)!;
        job.status = 'cancelled';
        this.activeJobs.set(jobId, job);
      }

      logger.info('Fine-tuning job cancelled', { jobId });
      return result.status === 'cancelled';

    } catch (error) {
      logger.error('Error cancelling job', { jobId, error: getErrorMessage(error) });
      return false;
    }
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Get fine-tuning recommendations
   */
  getFineTuningRecommendations(): {
    shouldFineTune: boolean;
    reasons: string[];
    estimatedCost: string;
    timeframe: string;
  } {
    // Analyze current system performance to determine if fine-tuning is needed
    const reasons: string[] = [];
    let shouldFineTune = false;

    // This would analyze your actual usage patterns
    const mockAnalysis = {
      consistencyIssues: false,
      domainSpecificNeeds: true,
      volumeJustification: false,
      qualityGaps: false
    };

    if (mockAnalysis.domainSpecificNeeds) {
      reasons.push('High domain specificity for HubSpot modules detected');
      shouldFineTune = true;
    }

    if (mockAnalysis.consistencyIssues) {
      reasons.push('Consistency issues in output format detected');
      shouldFineTune = true;
    }

    if (mockAnalysis.volumeJustification) {
      reasons.push('High volume usage justifies fine-tuning investment');
      shouldFineTune = true;
    }

    if (!shouldFineTune) {
      reasons.push('Current RAG + Dynamic Context approach is sufficient');
      reasons.push('Fine-tuning not recommended at this time');
    }

    return {
      shouldFineTune,
      reasons,
      estimatedCost: shouldFineTune ? '$100-500 for initial training' : 'N/A',
      timeframe: shouldFineTune ? '2-4 hours for training completion' : 'N/A'
    };
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      activeJobs: this.activeJobs.size,
      trainingDataPath: this.trainingDataPath,
      jobStatuses: Array.from(this.activeJobs.values()).reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recommendations: this.getFineTuningRecommendations()
    };
  }
}

export default FineTuningService;
