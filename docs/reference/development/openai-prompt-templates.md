# OpenAI Prompt Templates Library

This document contains structured prompt templates for generating high-quality HubSpot modules using OpenAI's GPT models.

## Base System Prompt

### Core System Message
```
You are a HubSpot module generation expert. Your task is to create high-quality, production-ready HubSpot modules from design inputs or specifications.

CRITICAL REQUIREMENTS:
1. Generate valid JSON for fields.json with proper HubSpot field types
2. Create semantic, accessible HTML templates with proper HubL syntax
3. Include comprehensive meta.json with appropriate categorization
4. Follow HubSpot best practices and accessibility standards
5. Ensure all field references in templates exist in field definitions
6. Use conditional rendering for all optional fields
7. Provide meaningful default values and help text

FIELD TYPE CONSTRAINTS:
- Text fields: Use "text" type, include validation_regex when appropriate
- Rich content: Use "richtext" type with proper default HTML
- Images: Use "image" type with src, alt, width, height properties
- Links: Use "url" type with href, type, open_in_new_tab, no_follow properties
- Toggles: Use "boolean" type for show/hide functionality
- Selections: Use "choice" type with proper choices array format
- Colors: Use "color" type with color and opacity properties
- Repeatable content: Use "group" type with children array

TEMPLATE REQUIREMENTS:
- Always check if fields have values before rendering
- Use semantic HTML5 elements (section, article, header, etc.)
- Include proper ARIA attributes for accessibility
- Use conditional logic: {% if module.field_name %}...{% endif %}
- Handle image fields: {% if module.image.src %}
- Handle URL fields: {% if module.link.url.href %}
- Handle group fields: {% for item in module.group_field %}

OUTPUT FORMAT:
Provide three separate code blocks:
1. fields.json - Field definitions
2. meta.json - Module metadata
3. module.html - HubL template
```

## Content Module Prompts

### Hero Section Prompt
```
Create a HubSpot hero section module with the following specifications:

DESIGN REQUIREMENTS:
- Large headline with optional subheadline
- Rich text content area
- Background image support
- Call-to-action button
- Layout alignment options (left, center, right)
- Background color customization
- Show/hide toggle for entire section

FIELD REQUIREMENTS:
- headline: Required text field with 100 character limit
- subheadline: Optional text field for supporting text
- body_content: Optional rich text for detailed content
- hero_image: Optional image field with alt text
- cta_text: Optional text for button label
- cta_link: Optional URL field with all link options
- layout_style: Choice field for alignment (left/center/right)
- background_color: Color field with opacity support
- show_section: Boolean toggle for visibility

TEMPLATE REQUIREMENTS:
- Responsive design with proper breakpoints
- Semantic HTML structure using <section>
- Proper conditional rendering for all optional fields
- Background image as CSS background-image
- Accessible button with proper ARIA attributes
- Support for overlay text on background images

Generate the complete module following HubSpot best practices.
```

### Feature Grid Prompt
```
Create a HubSpot feature grid module with the following specifications:

DESIGN REQUIREMENTS:
- Section title
- Repeatable feature items with icons, titles, and descriptions
- Configurable column layout (2, 3, or 4 columns)
- Optional links for each feature
- Responsive grid system

FIELD REQUIREMENTS:
- section_title: Optional text field for main heading
- features: Group field with repeatable items containing:
  - icon: Icon field for feature representation
  - title: Required text field for feature name
  - description: Rich text field for feature details
  - link: Optional URL field for "learn more" links
- columns: Choice field for column count (2/3/4)

TEMPLATE REQUIREMENTS:
- CSS Grid or Flexbox layout
- Responsive design that stacks on mobile
- Icon integration with proper sizing
- Semantic HTML with proper heading hierarchy
- Accessible links with descriptive text

Generate the complete module with proper field validation and template structure.
```

## Form Module Prompts

### Contact Form Prompt
```
Create a HubSpot contact form module with the following specifications:

DESIGN REQUIREMENTS:
- Form title and description
- HubSpot form integration
- Customizable form styling options
- Privacy notice with toggle
- Background color customization

FIELD REQUIREMENTS:
- form_title: Optional text field for form heading
- form_description: Optional rich text for instructions
- hubspot_form: Required form field for HubSpot form selection
- form_style: Choice field for styling (standard/minimal/bordered/rounded)
- background_color: Color field for section background
- show_privacy_notice: Boolean toggle for privacy text
- privacy_text: Rich text field for privacy notice (conditional)

TEMPLATE REQUIREMENTS:
- Proper HubSpot form embedding syntax
- Conditional privacy notice display
- Form styling classes
- Accessible form labels and structure
- Responsive design

Generate the complete module with form integration best practices.
```

## Navigation Module Prompts

### Mega Menu Prompt
```
Create a HubSpot navigation menu module with the following specifications:

DESIGN REQUIREMENTS:
- Multi-level navigation support
- Dropdown/submenu functionality
- Responsive mobile menu
- Configurable menu styles

FIELD REQUIREMENTS:
- menu_items: Group field with repeatable navigation items:
  - label: Required text for menu item
  - url: Required URL field for navigation
  - has_submenu: Boolean for dropdown functionality
  - submenu_items: Nested group for submenu items (conditional)
- menu_style: Choice field for navigation style (horizontal/vertical/mega)

TEMPLATE REQUIREMENTS:
- Semantic <nav> element with proper ARIA
- Keyboard navigation support
- Mobile-responsive menu structure
- Proper link accessibility
- JavaScript hooks for menu functionality

Generate the complete module with accessibility and responsive design.
```

## Advanced Module Prompts

### Blog Post Grid Prompt
```
Create a HubSpot blog post grid module with the following specifications:

DESIGN REQUIREMENTS:
- Display recent blog posts in grid layout
- Featured post option
- Post excerpts and metadata
- Read more links
- Pagination or load more functionality

FIELD REQUIREMENTS:
- section_title: Optional text for grid heading
- post_count: Number field for posts to display (1-12)
- featured_post: Optional blog field for highlighted post
- show_excerpts: Boolean toggle for post excerpts
- show_dates: Boolean toggle for publish dates
- show_authors: Boolean toggle for author names
- grid_columns: Choice field for column layout
- read_more_text: Text field for link text

TEMPLATE REQUIREMENTS:
- Blog post loop with proper HubL syntax
- Responsive grid layout
- Proper date formatting
- Author information display
- SEO-friendly post links
- Accessible card structure

Generate the complete module with blog integration best practices.
```

## Specialized Prompts

### E-commerce Product Showcase
```
Create a HubSpot product showcase module for e-commerce sites:

DESIGN REQUIREMENTS:
- Product grid with images and details
- Price display with currency formatting
- Add to cart functionality hooks
- Product filtering options
- Sale/discount badges

FIELD REQUIREMENTS:
- products: Group field for product items:
  - name: Required text for product name
  - image: Required image for product photo
  - price: Number field for product price
  - sale_price: Optional number for discounted price
  - description: Rich text for product details
  - product_url: URL field for product page
  - in_stock: Boolean for availability
- currency_symbol: Text field for currency display
- show_sale_badges: Boolean for discount indicators
- products_per_row: Choice field for grid layout

Generate complete module with e-commerce best practices.
```

### Testimonial Carousel
```
Create a HubSpot testimonial carousel module:

DESIGN REQUIREMENTS:
- Rotating testimonial display
- Customer photos and details
- Star ratings
- Navigation controls
- Auto-play options

FIELD REQUIREMENTS:
- testimonials: Group field for testimonial items:
  - quote: Required rich text for testimonial
  - customer_name: Required text for customer name
  - customer_title: Optional text for job title
  - customer_company: Optional text for company
  - customer_photo: Optional image for headshot
  - rating: Number field for star rating (1-5)
- auto_play: Boolean for automatic rotation
- show_navigation: Boolean for nav arrows
- show_indicators: Boolean for dot indicators
- rotation_speed: Number field for timing

Generate complete module with carousel functionality.
```

## Prompt Modifiers

### Accessibility Enhancement Modifier
```
ACCESSIBILITY ENHANCEMENT:
Ensure the generated module meets WCAG 2.1 AA standards:
- All images have descriptive alt text
- Interactive elements have proper ARIA labels
- Color contrast ratios are sufficient
- Keyboard navigation is fully supported
- Screen reader compatibility is maintained
- Focus indicators are visible
- Semantic HTML structure is used throughout
```

### Performance Optimization Modifier
```
PERFORMANCE OPTIMIZATION:
Optimize the generated module for performance:
- Minimize inline styles (prefer CSS classes)
- Optimize default image sizes and formats
- Use efficient HubL expressions
- Minimize DOM complexity
- Implement lazy loading for images
- Reduce HTTP requests where possible
- Use semantic HTML to reduce markup
```

### Mobile-First Modifier
```
MOBILE-FIRST DESIGN:
Generate the module with mobile-first responsive design:
- Start with mobile layout and scale up
- Use flexible grid systems
- Implement touch-friendly interactions
- Optimize for small screens first
- Use appropriate breakpoints
- Consider mobile performance constraints
- Test across various device sizes
```

## Quality Assurance Prompts

### Validation Prompt
```
Review the generated HubSpot module for quality and compliance:

VALIDATION CHECKLIST:
1. Field Definitions:
   - All field IDs are unique and follow naming conventions
   - Required fields have appropriate defaults
   - Field types match their usage in templates
   - Help text is provided for complex fields

2. Template Quality:
   - All field references exist in fields.json
   - Conditional rendering is used for optional fields
   - HTML is semantic and accessible
   - HubL syntax is correct

3. Metadata:
   - Label and description are clear and descriptive
   - Appropriate categories and tags are assigned
   - Host template types are correctly specified

4. Best Practices:
   - Follows HubSpot coding standards
   - Implements accessibility requirements
   - Uses performance optimization techniques
   - Maintains consistent code style

Provide a detailed quality assessment and suggest improvements.
```

### Error Correction Prompt
```
The following HubSpot module has validation errors. Please fix all issues:

ERRORS FOUND:
[List specific errors here]

REQUIREMENTS:
- Fix all critical and high-priority errors
- Maintain existing functionality while correcting issues
- Ensure all field references are valid
- Verify HubL syntax is correct
- Confirm accessibility standards are met

Provide the corrected module files with explanations of changes made.
```

## Refinement Prompts

### Style Enhancement Prompt
```
Enhance the visual design of this HubSpot module:

ENHANCEMENT GOALS:
- Improve visual hierarchy and typography
- Add modern design elements and spacing
- Enhance color scheme and contrast
- Improve responsive design
- Add subtle animations or transitions
- Modernize overall aesthetic

CONSTRAINTS:
- Maintain all existing functionality
- Keep field structure intact
- Ensure accessibility is not compromised
- Follow HubSpot best practices
- Optimize for performance

Provide enhanced module with improved styling.
```

### Feature Addition Prompt
```
Add the following features to the existing HubSpot module:

NEW FEATURES:
[Specify features to add]

REQUIREMENTS:
- Integrate seamlessly with existing functionality
- Add necessary field definitions
- Update template with new features
- Maintain backward compatibility
- Follow established patterns and conventions
- Include proper validation and error handling

Provide updated module with new features implemented.
```

## Usage Guidelines

### Prompt Selection Strategy
1. **Start with Base System Prompt** for all generations
2. **Choose specific module prompt** based on requirements
3. **Add modifiers** for special requirements (accessibility, performance, mobile)
4. **Use refinement prompts** for iterative improvements
5. **Apply validation prompts** for quality assurance

### Best Practices
- Always include the base system prompt
- Be specific about design requirements
- Specify all required fields clearly
- Include accessibility and performance considerations
- Use validation prompts for quality control
- Iterate with refinement prompts for improvements

### Common Patterns
- Start with simple modules and add complexity
- Use group fields for repeatable content
- Always include show/hide toggles for sections
- Provide meaningful defaults and help text
- Follow semantic HTML structure
- Implement proper conditional rendering

This prompt library ensures consistent, high-quality HubSpot module generation that meets all technical requirements and best practices.
