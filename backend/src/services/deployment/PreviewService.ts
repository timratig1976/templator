import { createLogger } from '../../utils/logger';

const logger = createLogger();

export class PreviewService {
  async generatePreview(htmlContent: string, sampleData: Record<string, any> = {}): Promise<string> {
    try {
      // Generate sample data for fields if not provided
      const defaultSampleData = this.generateDefaultSampleData(htmlContent);
      const mergedData = { ...defaultSampleData, ...sampleData };
      
      // Replace HubL-style variables with sample data
      let previewHtml = htmlContent;
      
      // Replace data-field attributes with actual content
      Object.entries(mergedData).forEach(([fieldId, value]) => {
        // Replace data-field attributes
        const dataFieldRegex = new RegExp(`data-field="${fieldId}"`, 'g');
        previewHtml = previewHtml.replace(dataFieldRegex, '');
        
        // Replace placeholder content with sample data
        if (typeof value === 'object' && value.src) {
          // Handle image fields
          const imgRegex = new RegExp(`<img([^>]*?)src="[^"]*"([^>]*?)alt="[^"]*"([^>]*?)>`, 'g');
          previewHtml = previewHtml.replace(imgRegex, (match, before, middle, after) => {
            return `<img${before}src="${value.src}"${middle}alt="${value.alt || 'Sample Image'}"${after}>`;
          });
        } else if (fieldId.includes('_url')) {
          // Handle URL fields
          const linkRegex = new RegExp(`<a([^>]*?)href="[^"]*"([^>]*?)>`, 'g');
          previewHtml = previewHtml.replace(linkRegex, `<a$1href="${value}"$2>`);
        } else {
          // Handle text fields - replace content between tags
          const textRegex = new RegExp(`(<[^>]*?>)([^<]*?)(<\/[^>]+>)`, 'g');
          previewHtml = previewHtml.replace(textRegex, (match, openTag, content, closeTag) => {
            // Only replace if this looks like placeholder content
            if (content.trim().length === 0 || content.includes('placeholder') || content.includes('Lorem')) {
              return `${openTag}${value}${closeTag}`;
            }
            return match;
          });
        }
      });
      
      // Generate complete HTML document for preview
      return this.wrapInPreviewDocument(previewHtml);
    } catch (error) {
      logger.error('Preview generation failed:', error);
      return this.wrapInPreviewDocument('<div class="error">Preview generation failed</div>');
    }
  }

  private generateDefaultSampleData(htmlContent: string): Record<string, any> {
    const sampleData: Record<string, any> = {};
    
    // Extract data-field attributes to generate appropriate sample data
    const dataFieldRegex = /data-field="([^"]+)"/g;
    let match;
    
    while ((match = dataFieldRegex.exec(htmlContent)) !== null) {
      const fieldId = match[1];
      
      if (fieldId.includes('headline')) {
        sampleData[fieldId] = 'Sample Headline Text';
      } else if (fieldId.includes('subheadline')) {
        sampleData[fieldId] = 'Sample Subheading';
      } else if (fieldId.includes('body') || fieldId.includes('text')) {
        sampleData[fieldId] = 'This is sample body text that demonstrates how your content will appear in the final module. You can customize this text through the HubSpot editor.';
      } else if (fieldId.includes('image')) {
        sampleData[fieldId] = {
          src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgICAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzNCODJGNiIvPgogICAgICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSIgCiAgICAgICAgICAgIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWYiIAogICAgICAgICAgICBmb250LXNpemU9IjM2IiAKICAgICAgICAgICAgZmlsbD0iI0ZGRkZGRiI+U2FtcGxlIEltYWdlPC90ZXh0PgogICAgPC9zdmc+',
          alt: 'Sample Image'
        };
      } else if (fieldId.includes('cta') && fieldId.includes('url')) {
        sampleData[fieldId] = '#sample-link';
      } else if (fieldId.includes('cta') && fieldId.includes('text')) {
        sampleData[fieldId] = 'Sample Button Text';
      } else if (fieldId.includes('cta')) {
        sampleData[fieldId + '_url'] = '#sample-link';
        sampleData[fieldId + '_text'] = 'Get Started';
      } else {
        sampleData[fieldId] = 'Sample Content';
      }
    }
    
    return sampleData;
  }

  private wrapInPreviewDocument(htmlContent: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Windsurf Module Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
        }
        
        .preview-container {
            min-height: 100vh;
            background: #f9fafb;
        }
        
        .preview-header {
            background: #1f2937;
            color: white;
            padding: 1rem;
            text-align: center;
            font-size: 0.875rem;
        }
        
        .preview-content {
            padding: 2rem 1rem;
        }
        
        .error {
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 1rem;
            border-radius: 0.5rem;
            text-align: center;
        }
        
        /* Ensure images are responsive */
        img {
            max-width: 100%;
            height: auto;
        }
        
        /* Button hover effects */
        .btn:hover, .button:hover, a[class*="btn"]:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        /* Smooth transitions */
        * {
            transition: all 0.2s ease-in-out;
        }
    </style>
</head>
<body>
    <div class="preview-container">
        <div class="preview-header">
            <strong>Windsurf Module Preview</strong> - This is how your module will appear
        </div>
        <div class="preview-content">
            ${htmlContent}
        </div>
    </div>
</body>
</html>`;
  }
}
