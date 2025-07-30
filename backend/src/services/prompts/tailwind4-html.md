
# Tailwind 4 HTML Generation Guide

## Output Requirements

Create production-quality HTML with Tailwind CSS v4 that meets these requirements:

### 1. Semantic Structure
- Use proper HTML5 semantic elements (header, nav, main, section, article, footer)
- Create logical document hierarchy with proper heading levels (h1-h6)
- Include meaningful container elements with appropriate ARIA roles
- Add descriptive section/div IDs and data attributes where helpful

### 2. Tailwind 4 Features
- Leverage the latest Tailwind 4 features:
  - New color opacity syntax (bg-blue/75 instead of bg-blue bg-opacity-75)
  - Container queries (@container) for component-based responsive design
  - Subgrid layout support (grid-cols-subgrid) for complex nested grids
  - Dynamic viewport units (dvh, svh, lvh) for mobile-friendly layouts
  - Animation utilities (animate-*) for subtle UI enhancements
  - Multi-column layout utilities for text-heavy content

### 3. Accessibility
- Include proper alt text for ALL images (descriptive and contextual)
- Ensure proper contrast ratios with appropriate text/background combinations
- Add ARIA attributes and roles to complex interactive elements
- Ensure keyboard navigability with proper focus states
- Include form labels and appropriate aria-describedby attributes

### 4. Responsive Design
- Implement true mobile-first approach (base styles for mobile, then scale up)
- Use responsive breakpoints consistently (sm, md, lg, xl, 2xl)
- Apply proper container constraints and padding for different viewports
- Ensure text remains readable at all screen sizes
- Use flexible layouts that adapt gracefully to different devices

### 5. Advanced Layout Techniques
- Combine CSS Grid and Flexbox appropriately:
  - Grid for 2D layouts and complex page structures
  - Flexbox for 1D flows and alignment
- Use grid-template-areas for complex layout regions
- Implement responsive column layouts with auto-fit/auto-fill
- Use aspect-ratio utilities for responsive media
- Apply position: sticky with appropriate z-index management

### 6. Performance and Maintainability
- Avoid unnecessary wrapper divs
- Use Tailwind's composition patterns over custom CSS
- Group related utility classes logically
- Apply appropriate CSS variables for theme consistency
- Use proper HTML element hierarchy

## Always Include
- Viewport meta tag
- At least one appropriate image with alt text
- Responsive navigation pattern
- Interactive elements with proper states (hover, focus, active)
- HTML comments for complex sections

## For Complex Layouts
- Implement grid areas with named template areas
- Use gap utilities instead of margins for spacing grid items
- Consider subgrid for alignment across nested grids
- Implement appropriate container queries for component-based layouts
