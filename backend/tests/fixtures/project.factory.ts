/**
 * Project Test Data Factory
 * Generates consistent test data for project-related tests
 */

import { faker } from '@faker-js/faker';

export interface TestProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  templateId?: string;
  status: 'active' | 'completed' | 'archived' | 'draft';
  settings: {
    isPublic: boolean;
    allowComments: boolean;
    enableAnalytics: boolean;
    customDomain?: string;
  };
  content: {
    htmlContent: string;
    cssContent: string;
    jsContent?: string;
    images: string[];
    assets: string[];
  };
  metadata: {
    lastModified: Date;
    version: string;
    deploymentUrl?: string;
    previewUrl?: string;
    buildStatus: 'pending' | 'building' | 'success' | 'failed';
  };
  collaborators: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDto {
  name: string;
  description: string;
  templateId?: string;
  isPublic: boolean;
  tags: string[];
}

export class ProjectFactory {
  /**
   * Create a valid project DTO for creation
   */
  static createProjectDto(overrides: Partial<CreateProjectDto> = {}): CreateProjectDto {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      templateId: faker.string.uuid(),
      isPublic: faker.datatype.boolean(),
      tags: faker.helpers.arrayElements(['web', 'mobile', 'responsive', 'modern', 'business'], { min: 1, max: 3 }),
      ...overrides
    };
  }

  /**
   * Create a complete project entity
   */
  static createProject(overrides: Partial<TestProject> = {}): TestProject {
    const projectDto = this.createProjectDto();
    const createdAt = faker.date.recent({ days: 30 });
    
    return {
      id: faker.string.uuid(),
      name: projectDto.name,
      description: projectDto.description,
      ownerId: faker.string.uuid(),
      templateId: projectDto.templateId,
      status: faker.helpers.arrayElement(['active', 'completed', 'archived', 'draft']),
      settings: {
        isPublic: projectDto.isPublic,
        allowComments: faker.datatype.boolean(),
        enableAnalytics: faker.datatype.boolean(),
        customDomain: faker.datatype.boolean() ? faker.internet.domainName() : undefined
      },
      content: {
        htmlContent: this.generateProjectHTML(projectDto.name),
        cssContent: this.generateProjectCSS(),
        jsContent: this.generateProjectJS(),
        images: this.generateImagePaths(),
        assets: this.generateAssetPaths()
      },
      metadata: {
        lastModified: faker.date.recent({ days: 7 }),
        version: faker.system.semver(),
        deploymentUrl: faker.datatype.boolean() ? faker.internet.url() : undefined,
        previewUrl: faker.internet.url(),
        buildStatus: faker.helpers.arrayElement(['pending', 'building', 'success', 'failed'])
      },
      collaborators: faker.helpers.arrayElements(
        Array.from({ length: 5 }, () => faker.string.uuid()),
        { min: 0, max: 3 }
      ),
      tags: projectDto.tags,
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
      ...overrides
    };
  }

  /**
   * Create multiple projects
   */
  static createMany(count: number, overrides: Partial<TestProject> = {}): TestProject[] {
    return Array.from({ length: count }, () => this.createProject(overrides));
  }

  /**
   * Create an active project
   */
  static createActiveProject(overrides: Partial<TestProject> = {}): TestProject {
    return this.createProject({
      status: 'active',
      metadata: {
        lastModified: faker.date.recent({ days: 1 }),
        version: faker.system.semver(),
        buildStatus: 'success',
        deploymentUrl: faker.internet.url(),
        previewUrl: faker.internet.url()
      },
      ...overrides
    });
  }

  /**
   * Create a draft project
   */
  static createDraftProject(overrides: Partial<TestProject> = {}): TestProject {
    return this.createProject({
      status: 'draft',
      settings: {
        isPublic: false,
        allowComments: false,
        enableAnalytics: false
      },
      metadata: {
        lastModified: faker.date.recent({ days: 1 }),
        version: '0.1.0',
        buildStatus: 'pending'
      },
      ...overrides
    });
  }

  /**
   * Create a completed project
   */
  static createCompletedProject(overrides: Partial<TestProject> = {}): TestProject {
    return this.createProject({
      status: 'completed',
      settings: {
        isPublic: true,
        allowComments: true,
        enableAnalytics: true,
        customDomain: faker.internet.domainName()
      },
      metadata: {
        lastModified: faker.date.past({ years: 1 }),
        version: '1.0.0',
        buildStatus: 'success',
        deploymentUrl: faker.internet.url(),
        previewUrl: faker.internet.url()
      },
      ...overrides
    });
  }

  /**
   * Create project with specific owner
   */
  static createProjectForOwner(ownerId: string, overrides: Partial<TestProject> = {}): TestProject {
    return this.createProject({
      ownerId,
      ...overrides
    });
  }

  /**
   * Create project with collaborators
   */
  static createCollaborativeProject(collaboratorIds: string[], overrides: Partial<TestProject> = {}): TestProject {
    return this.createProject({
      collaborators: collaboratorIds,
      settings: {
        isPublic: false,
        allowComments: true,
        enableAnalytics: true
      },
      ...overrides
    });
  }

  /**
   * Generate sample project HTML
   */
  private static generateProjectHTML(projectName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header class="project-header">
            <h1>${projectName}</h1>
            <p class="project-tagline">${faker.company.catchPhrase()}</p>
        </header>
        
        <main class="project-content">
            <section class="intro">
                <h2>Welcome to ${projectName}</h2>
                <p>${faker.lorem.paragraphs(2)}</p>
            </section>
            
            <section class="features">
                <h2>Key Features</h2>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>${faker.lorem.words(2)}</h3>
                        <p>${faker.lorem.sentence()}</p>
                    </div>
                    <div class="feature-card">
                        <h3>${faker.lorem.words(2)}</h3>
                        <p>${faker.lorem.sentence()}</p>
                    </div>
                    <div class="feature-card">
                        <h3>${faker.lorem.words(2)}</h3>
                        <p>${faker.lorem.sentence()}</p>
                    </div>
                </div>
            </section>
            
            <section class="cta">
                <h2>Get Started Today</h2>
                <button class="cta-button">Start Now</button>
            </section>
        </main>
        
        <footer class="project-footer">
            <p>&copy; 2024 ${projectName}. Built with Templator.</p>
        </footer>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;
  }

  /**
   * Generate sample project CSS
   */
  private static generateProjectCSS(): string {
    return `/* Project Styles */
:root {
    --primary-color: #3498db;
    --secondary-color: #2c3e50;
    --accent-color: #e74c3c;
    --text-color: #333;
    --bg-color: #f8f9fa;
    --border-color: #dee2e6;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--bg-color);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.project-header {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    margin-bottom: 3rem;
}

.project-header h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
    font-weight: 700;
}

.project-tagline {
    font-size: 1.2rem;
    opacity: 0.9;
}

/* Main Content */
.project-content {
    padding: 0 2rem;
}

.intro {
    text-align: center;
    margin-bottom: 4rem;
}

.intro h2 {
    font-size: 2.5rem;
    margin-bottom: 1.5rem;
    color: var(--secondary-color);
}

.intro p {
    font-size: 1.1rem;
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.8;
}

/* Features */
.features {
    margin-bottom: 4rem;
}

.features h2 {
    text-align: center;
    font-size: 2.2rem;
    margin-bottom: 3rem;
    color: var(--secondary-color);
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.feature-card h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
}

/* CTA Section */
.cta {
    text-align: center;
    padding: 4rem 0;
    background: white;
    border-radius: 15px;
    margin-bottom: 4rem;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.cta h2 {
    font-size: 2.2rem;
    margin-bottom: 2rem;
    color: var(--secondary-color);
}

.cta-button {
    background: var(--accent-color);
    color: white;
    padding: 1rem 3rem;
    border: none;
    border-radius: 50px;
    font-size: 1.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.cta-button:hover {
    background: #c0392b;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(231, 76, 60, 0.4);
}

/* Footer */
.project-footer {
    text-align: center;
    padding: 2rem 0;
    border-top: 1px solid var(--border-color);
    color: #6c757d;
}

/* Responsive Design */
@media (max-width: 768px) {
    .project-header h1 {
        font-size: 2rem;
    }
    
    .intro h2 {
        font-size: 2rem;
    }
    
    .feature-grid {
        grid-template-columns: 1fr;
    }
    
    .project-content {
        padding: 0 1rem;
    }
}`;
  }

  /**
   * Generate sample project JavaScript
   */
  private static generateProjectJS(): string {
    return `// Project JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize project functionality
    initializeProject();
    
    // Add smooth scrolling
    addSmoothScrolling();
    
    // Add interactive elements
    addInteractivity();
    
    // Add analytics tracking
    addAnalytics();
});

function initializeProject() {
    console.log('Project initialized successfully');
    
    // Add loading animation
    const elements = document.querySelectorAll('.feature-card');
    elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * 200);
    });
}

function addSmoothScrolling() {
    // Smooth scroll for anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function addInteractivity() {
    // CTA button interaction
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function() {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
            
            // Handle CTA action
            handleCTAClick();
        });
    }
    
    // Feature card hover effects
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function handleCTAClick() {
    // Simulate CTA action
    const messages = [
        'Welcome! Let\\'s get started.',
        'Great choice! Redirecting...',
        'Thank you for your interest!',
        'Loading your experience...'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // Show notification
    showNotification(randomMessage, 'success');
    
    // Simulate redirect or action
    setTimeout(() => {
        console.log('CTA action completed');
    }, 2000);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = \`notification notification-\${type}\`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 2rem',
        borderRadius: '5px',
        color: 'white',
        fontWeight: '600',
        zIndex: '1000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease'
    });
    
    // Set background color based on type
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function addAnalytics() {
    // Simple analytics tracking
    const analyticsData = {
        pageViews: 0,
        interactions: 0,
        timeOnPage: Date.now()
    };
    
    // Track page view
    analyticsData.pageViews++;
    
    // Track interactions
    document.addEventListener('click', function() {
        analyticsData.interactions++;
    });
    
    // Track time on page
    window.addEventListener('beforeunload', function() {
        const timeSpent = Date.now() - analyticsData.timeOnPage;
        console.log('Analytics:', {
            ...analyticsData,
            timeSpent: Math.round(timeSpent / 1000) + ' seconds'
        });
    });
}`;
  }

  /**
   * Generate sample image paths
   */
  private static generateImagePaths(): string[] {
    const imageTypes = ['hero', 'feature', 'gallery', 'avatar', 'logo'];
    return faker.helpers.arrayElements(imageTypes, { min: 2, max: 5 }).map(type => 
      `/images/${type}-${faker.string.alphanumeric(8)}.jpg`
    );
  }

  /**
   * Generate sample asset paths
   */
  private static generateAssetPaths(): string[] {
    const assetTypes = ['fonts', 'icons', 'videos', 'documents'];
    return faker.helpers.arrayElements(assetTypes, { min: 1, max: 3 }).map(type => 
      `/assets/${type}/${faker.string.alphanumeric(8)}.${this.getAssetExtension(type)}`
    );
  }

  /**
   * Get appropriate file extension for asset type
   */
  private static getAssetExtension(assetType: string): string {
    const extensions: Record<string, string> = {
      fonts: 'woff2',
      icons: 'svg',
      videos: 'mp4',
      documents: 'pdf'
    };
    return extensions[assetType] || 'file';
  }

  /**
   * Create invalid project data for validation testing
   */
  static createInvalidProjectDto(): Partial<CreateProjectDto> {
    const invalidOptions = [
      { name: '' }, // Empty name
      { description: '' }, // Empty description
      { tags: [] }, // Empty tags
      { name: 'a' }, // Too short name
    ];

    return faker.helpers.arrayElement(invalidOptions);
  }
}
