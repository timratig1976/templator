/**
 * Template Test Data Factory
 * Generates consistent test data for template-related tests
 */

import { faker } from '@faker-js/faker';

export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  htmlContent: string;
  cssContent: string;
  jsContent?: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  authorId: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  metadata: {
    components: string[];
    framework: string;
    responsive: boolean;
    accessibility: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateDto {
  name: string;
  description: string;
  htmlContent: string;
  cssContent: string;
  jsContent?: string;
  category: string;
  tags: string[];
  isPublic: boolean;
}

export class TemplateFactory {
  /**
   * Create a valid template DTO for creation
   */
  static createTemplateDto(overrides: Partial<CreateTemplateDto> = {}): CreateTemplateDto {
    const templateName = faker.commerce.productName();
    
    return {
      name: templateName,
      description: faker.commerce.productDescription(),
      htmlContent: this.generateSampleHTML(templateName),
      cssContent: this.generateSampleCSS(),
      jsContent: this.generateSampleJS(),
      category: faker.helpers.arrayElement(['landing-page', 'email', 'blog', 'ecommerce', 'portfolio']),
      tags: faker.helpers.arrayElements(['responsive', 'modern', 'clean', 'professional', 'animated'], { min: 1, max: 3 }),
      isPublic: faker.datatype.boolean(),
      ...overrides
    };
  }

  /**
   * Create a complete template entity
   */
  static createTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
    const templateDto = this.createTemplateDto();
    
    return {
      id: faker.string.uuid(),
      ...templateDto,
      authorId: faker.string.uuid(),
      version: faker.system.semver(),
      status: faker.helpers.arrayElement(['draft', 'published', 'archived']),
      metadata: {
        components: faker.helpers.arrayElements(['header', 'footer', 'sidebar', 'carousel', 'form'], { min: 2, max: 4 }),
        framework: faker.helpers.arrayElement(['vanilla', 'react', 'vue', 'angular']),
        responsive: faker.datatype.boolean(),
        accessibility: faker.datatype.boolean()
      },
      createdAt: faker.date.recent({ days: 30 }),
      updatedAt: faker.date.recent({ days: 7 }),
      ...overrides
    };
  }

  /**
   * Create multiple templates
   */
  static createMany(count: number, overrides: Partial<TestTemplate> = {}): TestTemplate[] {
    return Array.from({ length: count }, () => this.createTemplate(overrides));
  }

  /**
   * Create a published template
   */
  static createPublishedTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
    return this.createTemplate({
      status: 'published',
      isPublic: true,
      version: '1.0.0',
      ...overrides
    });
  }

  /**
   * Create a draft template
   */
  static createDraftTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
    return this.createTemplate({
      status: 'draft',
      isPublic: false,
      version: '0.1.0',
      ...overrides
    });
  }

  /**
   * Create a responsive template
   */
  static createResponsiveTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
    return this.createTemplate({
      metadata: {
        components: ['header', 'footer', 'grid'],
        framework: 'vanilla',
        responsive: true,
        accessibility: true
      },
      tags: ['responsive', 'mobile-friendly', 'modern'],
      ...overrides
    });
  }

  /**
   * Generate sample HTML content
   */
  private static generateSampleHTML(title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body>
    <header class="header">
        <h1>${title}</h1>
        <nav class="navigation">
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main class="main-content">
        <section class="hero">
            <h2>${faker.lorem.sentence()}</h2>
            <p>${faker.lorem.paragraph()}</p>
            <button class="cta-button">Get Started</button>
        </section>
        
        <section class="features">
            <div class="feature">
                <h3>${faker.lorem.words(3)}</h3>
                <p>${faker.lorem.paragraph()}</p>
            </div>
        </section>
    </main>
    
    <footer class="footer">
        <p>&copy; 2024 ${title}. All rights reserved.</p>
    </footer>
</body>
</html>`;
  }

  /**
   * Generate sample CSS content
   */
  private static generateSampleCSS(): string {
    return `/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
}

/* Header styles */
.header {
    background: #2c3e50;
    color: white;
    padding: 1rem 0;
}

.header h1 {
    text-align: center;
    margin-bottom: 1rem;
}

.navigation ul {
    display: flex;
    justify-content: center;
    list-style: none;
}

.navigation li {
    margin: 0 1rem;
}

.navigation a {
    color: white;
    text-decoration: none;
    transition: color 0.3s ease;
}

.navigation a:hover {
    color: #3498db;
}

/* Main content */
.main-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.hero {
    text-align: center;
    padding: 4rem 0;
}

.hero h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #2c3e50;
}

.cta-button {
    background: #3498db;
    color: white;
    padding: 1rem 2rem;
    border: none;
    border-radius: 5px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background 0.3s ease;
}

.cta-button:hover {
    background: #2980b9;
}

/* Features */
.features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 4rem;
}

.feature {
    padding: 2rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    text-align: center;
}

/* Footer */
.footer {
    background: #34495e;
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 4rem;
}

/* Responsive design */
@media (max-width: 768px) {
    .navigation ul {
        flex-direction: column;
        align-items: center;
    }
    
    .hero h2 {
        font-size: 2rem;
    }
    
    .features {
        grid-template-columns: 1fr;
    }
}`;
  }

  /**
   * Generate sample JavaScript content
   */
  private static generateSampleJS(): string {
    return `// Template JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.navigation a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // CTA button interaction
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function() {
            // Add your CTA logic here
            console.log('CTA button clicked');
            
            // Example: Show alert or redirect
            alert('Thank you for your interest!');
        });
    }

    // Add loading animation
    const features = document.querySelectorAll('.feature');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    features.forEach(feature => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(20px)';
        feature.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(feature);
    });
});`;
  }

  /**
   * Create template for specific category
   */
  static createTemplateByCategory(category: string, overrides: Partial<TestTemplate> = {}): TestTemplate {
    return this.createTemplate({
      category,
      tags: this.getTagsForCategory(category),
      ...overrides
    });
  }

  /**
   * Get appropriate tags for category
   */
  private static getTagsForCategory(category: string): string[] {
    const categoryTags: Record<string, string[]> = {
      'landing-page': ['conversion', 'marketing', 'responsive'],
      'email': ['newsletter', 'marketing', 'responsive'],
      'blog': ['content', 'reading', 'seo'],
      'ecommerce': ['shopping', 'product', 'conversion'],
      'portfolio': ['showcase', 'professional', 'creative']
    };

    return categoryTags[category] || ['general', 'template'];
  }

  /**
   * Create invalid template data for validation testing
   */
  static createInvalidTemplateDto(): Partial<CreateTemplateDto> {
    const invalidOptions = [
      { name: '' }, // Empty name
      { description: '' }, // Empty description
      { htmlContent: '' }, // Empty HTML
      { cssContent: '' }, // Empty CSS
      { category: '' }, // Empty category
      { tags: [] }, // Empty tags
    ];

    return faker.helpers.arrayElement(invalidOptions);
  }
}
