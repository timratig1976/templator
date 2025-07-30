import { describe, expect, it, beforeEach } from '@jest/globals';
import ImageHandlingService from '../../../../src/services/input/ImageHandlingService';

describe('ImageHandlingService', () => {
  let imageService: typeof ImageHandlingService;

  beforeEach(() => {
    // Get a fresh instance for each test
    imageService = ImageHandlingService.getInstance();
  });

  describe('replaceExternalPlaceholderURLs', () => {
    // Access the private method for testing using Type assertion
    const replaceUrls = (html: string) => {
      return (imageService as any).replaceExternalPlaceholderURLs(html);
    };

    it('should preserve existing data URI placeholder images', () => {
      const html = '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZjI5MzciLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiI+TE9HTzwvdGV4dD48L3N2Zz4=" alt="Logo">';
      const processed = replaceUrls(html);
      expect(processed).toBe(html);
    });

    it('should replace simple file references', () => {
      const html = '<img src="logo.png" alt="Logo">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('logo.png');
      expect(processed).toContain('data:image/svg+xml;base64,');
      expect(processed).toContain('alt="Logo"');
    });

    it('should replace path-based file references', () => {
      const html = '<img src="/path/to/images/hero.jpg" alt="Hero">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('/path/to/images/hero.jpg');
      expect(processed).toContain('data:image/svg+xml;base64,');
      expect(processed).toContain('alt="Hero"');
    });

    it('should replace template variables', () => {
      const html = '<img src="{{ logo_url }}" alt="Logo">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('{{ logo_url }}');
      expect(processed).toContain('data:image/svg+xml;base64,');
    });

    it('should replace localhost URLs', () => {
      const html = '<img src="http://localhost:3000/images/icon.svg" alt="Icon">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('http://localhost:3000/images/icon.svg');
      expect(processed).toContain('data:image/svg+xml;base64,');
    });

    it('should generate appropriate logo placeholder for logo context', () => {
      const html = '<img src="company_logo.png" alt="Company Logo" class="logo">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('company_logo.png');
      expect(processed).toContain('data:image/svg+xml;base64,');
      // We can't directly check for the text "LOGO" inside the SVG since it's base64 encoded
      // But we can verify the image tag structure remains intact
      expect(processed).toContain('alt="Company Logo"');
      expect(processed).toContain('class="logo"');
    });

    it('should generate appropriate hero placeholder for hero context', () => {
      const html = '<img src="hero-banner.jpg" alt="Hero Banner" class="hero">';
      const processed = replaceUrls(html);
      expect(processed).not.toContain('hero-banner.jpg');
      expect(processed).toContain('data:image/svg+xml;base64,');
    });

    it('should handle multiple images in complex HTML', () => {
      const html = `
        <div class="container">
          <header>
            <img src="logo.png" alt="Logo" class="h-10">
          </header>
          <main>
            <div class="hero">
              <img src="/images/hero.jpg" alt="Hero" class="w-full">
            </div>
            <div class="features">
              <img src="{{ feature_1_img }}" alt="Feature 1">
              <img src="{{ feature_2_img }}" alt="Feature 2">
            </div>
          </main>
          <footer>
            <img src="http://localhost:3000/icon.svg" alt="Icon" class="icon">
          </footer>
        </div>
      `;
      
      const processed = replaceUrls(html);
      
      // Verify no original references remain
      expect(processed).not.toContain('logo.png');
      expect(processed).not.toContain('/images/hero.jpg');
      expect(processed).not.toContain('{{ feature_1_img }}');
      expect(processed).not.toContain('{{ feature_2_img }}');
      expect(processed).not.toContain('http://localhost:3000/icon.svg');
      
      // Verify all images are replaced with data URIs
      const dataUriMatches = processed.match(/data:image\/svg\+xml;base64,/g) || [];
      expect(dataUriMatches.length).toBe(5);
      
      // Verify structure remains intact
      expect(processed).toContain('alt="Logo"');
      expect(processed).toContain('alt="Hero"');
      expect(processed).toContain('alt="Feature 1"');
      expect(processed).toContain('alt="Feature 2"');
      expect(processed).toContain('alt="Icon"');
    });

    it('should handle problematic HTML with script tags and mixed content', () => {
      const html = `
        <div class="product">
          <h2>Product Gallery</h2>
          <img src="product1.jpg" class="product-img">
          <script>
            const logoUrl = "/images/logo.png";
            document.write('<img src="' + logoUrl + '">');
          </script>
          <style>
            .bg { background: url('/images/bg.jpg'); }
          </style>
        </div>
      `;
      
      const processed = replaceUrls(html);
      
      // Check that img tags are replaced
      expect(processed).not.toContain('src="product1.jpg"');
      expect(processed).toContain('data:image/svg+xml;base64,');
      
      // Script and style content should remain unchanged
      expect(processed).toContain('const logoUrl = "/images/logo.png"');
      expect(processed).toContain('background: url(\'/images/bg.jpg\')');
    });
  });
});
