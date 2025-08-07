import { DatabaseService } from '../services/database/DatabaseService';
import { TemplateRepository } from '../services/database/TemplateRepository';
import { createLogger } from '../utils/logger';

const logger = createLogger();

/**
 * Migration script to create basic templates in database for MVP
 */
async function migrateTemplatesToDatabase(): Promise<void> {
  logger.info('🚀 Starting template migration to database...');

  try {
    const dbService = DatabaseService.getInstance();
    await dbService.connect();
    
    const templateRepo = new TemplateRepository();
    
    const basicTemplates = [
      {
        name: 'Basic Hero Section',
        description: 'A clean, responsive hero section with title, subtitle, and call-to-action button',
        category: 'HERO',
        complexity: 'SIMPLE',
        htmlContent: `<section class="hero-section" role="banner">
  <div class="hero-content">
    <div class="container">
      <h1 class="hero-title">{{ module.hero_title }}</h1>
      <p class="hero-subtitle">{{ module.hero_subtitle }}</p>
      <a href="{{ module.hero_cta_url }}" class="hero-cta btn btn-primary">
        {{ module.hero_cta_text }}
      </a>
    </div>
  </div>
</section>`,
        cssContent: `.hero-section {
  position: relative;
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-cta {
  display: inline-block;
  padding: 1rem 2rem;
  background: #ff6b6b;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-weight: 600;
}`,
        jsContent: '',
        tags: ['hero', 'cta', 'responsive'],
        version: '1.0.0',
        usageCount: 0,
        rating: 4.5,
      },
      {
        name: 'Feature Grid',
        description: 'A responsive grid layout for showcasing features',
        category: 'FEATURE',
        complexity: 'INTERMEDIATE',
        htmlContent: `<section class="features-section">
  <div class="container">
    <h2 class="features-title">{{ module.section_title }}</h2>
    <div class="features-grid">
      {% for feature in module.features_list %}
        <div class="feature-item">
          <h3 class="feature-title">{{ feature.feature_title }}</h3>
          <p class="feature-description">{{ feature.feature_description }}</p>
        </div>
      {% endfor %}
    </div>
  </div>
</section>`,
        cssContent: `.features-section {
  padding: 4rem 0;
}

.features-title {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-item {
  text-align: center;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.feature-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}`,
        jsContent: '',
        tags: ['features', 'grid', 'responsive'],
        version: '1.0.0',
        usageCount: 0,
        rating: 4.7,
      }
    ];
    
    let migratedCount = 0;
    let skippedCount = 0;

    for (const templateData of basicTemplates) {
      try {
        const existingTemplates = await templateRepo.search({ name: templateData.name });
        
        if (existingTemplates.length > 0) {
          logger.debug(`Template ${templateData.name} already exists in database, skipping`);
          skippedCount++;
          continue;
        }

        await templateRepo.create(templateData);
        migratedCount++;
        
        logger.debug(`Created template: ${templateData.name}`);
        
      } catch (error) {
        logger.error(`Failed to create template ${templateData.name}:`, error);
      }
    }

    logger.info(`✅ Template migration completed: ${migratedCount} created, ${skippedCount} skipped`);

    const dbTemplates = await templateRepo.findAll();
    logger.info(`Database now contains ${dbTemplates.length} templates`);

    await dbService.disconnect();
    
  } catch (error) {
    logger.error('❌ Template migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateTemplatesToDatabase()
    .then(() => {
      logger.info('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateTemplatesToDatabase };
