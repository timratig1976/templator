# Sample Project Templates

## Overview

This collection provides ready-to-use templates for common HubSpot module types. Each template includes complete field configurations, styling, and best practices to help you get started quickly.

## Template Categories

### 1. Content Modules

#### Hero Section Template
**Use Case:** Landing page headers, promotional banners
**Difficulty:** Beginner
**Estimated Time:** 10 minutes

**Fields Included:**
- Headline (text)
- Subheadline (text)
- Description (richtext)
- Background Image (image)
- Call-to-Action Button (url + text)
- Button Style (choice)

**Features:**
- Responsive design
- Multiple layout options
- Customizable button styles
- Background image with overlay

**Sample Configuration:**
```json
{
  "fields": [
    {
      "name": "headline",
      "label": "Main Headline",
      "type": "text",
      "required": true,
      "default": "Welcome to Our Platform",
      "help_text": "The main headline that grabs attention"
    },
    {
      "name": "subheadline",
      "label": "Subheadline",
      "type": "text",
      "default": "Discover amazing features",
      "help_text": "Supporting text under the main headline"
    },
    {
      "name": "description",
      "label": "Description",
      "type": "richtext",
      "default": "<p>Add your compelling description here.</p>",
      "help_text": "Detailed description with rich formatting"
    },
    {
      "name": "background_image",
      "label": "Background Image",
      "type": "image",
      "required": false,
      "help_text": "Optional background image for the hero section"
    },
    {
      "name": "cta_text",
      "label": "Button Text",
      "type": "text",
      "default": "Get Started",
      "help_text": "Text displayed on the call-to-action button"
    },
    {
      "name": "cta_url",
      "label": "Button URL",
      "type": "url",
      "required": false,
      "help_text": "Where the button should link to"
    },
    {
      "name": "button_style",
      "label": "Button Style",
      "type": "choice",
      "choices": [
        ["primary", "Primary (Blue)"],
        ["secondary", "Secondary (Gray)"],
        ["outline", "Outline"]
      ],
      "default": "primary"
    }
  ]
}
```

#### Feature Grid Template
**Use Case:** Product features, service highlights
**Difficulty:** Intermediate
**Estimated Time:** 15 minutes

**Fields Included:**
- Section Title (text)
- Features (repeater with icon, title, description)
- Grid Layout (choice: 2, 3, or 4 columns)
- Icon Style (choice)

#### Testimonial Carousel Template
**Use Case:** Customer testimonials, reviews
**Difficulty:** Intermediate
**Estimated Time:** 20 minutes

**Fields Included:**
- Section Title (text)
- Testimonials (repeater with quote, author, company, photo)
- Carousel Settings (boolean options)
- Display Style (choice)

### 2. Navigation Modules

#### Mega Menu Template
**Use Case:** Complex navigation with multiple levels
**Difficulty:** Advanced
**Estimated Time:** 30 minutes

**Fields Included:**
- Menu Items (repeater with nested structure)
- Featured Content (optional promotional areas)
- Mobile Behavior (choice)
- Styling Options (color, typography)

#### Breadcrumb Template
**Use Case:** Page navigation, user orientation
**Difficulty:** Beginner
**Estimated Time:** 5 minutes

**Fields Included:**
- Separator Style (choice)
- Show Home Link (boolean)
- Custom Styling (color, size)

### 3. Form Modules

#### Contact Form Template
**Use Case:** Lead generation, customer inquiries
**Difficulty:** Intermediate
**Estimated Time:** 25 minutes

**Fields Included:**
- Form Title (text)
- Form Fields (repeater with field types)
- Success Message (richtext)
- Redirect URL (url)
- Styling Options (layout, colors)

**Sample Field Configuration:**
```json
{
  "name": "form_fields",
  "label": "Form Fields",
  "type": "repeater",
  "child_fields": [
    {
      "name": "field_type",
      "label": "Field Type",
      "type": "choice",
      "choices": [
        ["text", "Text Input"],
        ["email", "Email"],
        ["phone", "Phone"],
        ["textarea", "Text Area"],
        ["select", "Dropdown"],
        ["checkbox", "Checkbox"],
        ["radio", "Radio Buttons"]
      ]
    },
    {
      "name": "field_label",
      "label": "Field Label",
      "type": "text",
      "required": true
    },
    {
      "name": "field_required",
      "label": "Required Field",
      "type": "boolean",
      "default": false
    },
    {
      "name": "field_placeholder",
      "label": "Placeholder Text",
      "type": "text"
    }
  ]
}
```

#### Newsletter Signup Template
**Use Case:** Email list building, subscriptions
**Difficulty:** Beginner
**Estimated Time:** 10 minutes

**Fields Included:**
- Signup Title (text)
- Description (richtext)
- Email Field Label (text)
- Submit Button Text (text)
- Privacy Notice (richtext)

### 4. Layout Modules

#### Two-Column Layout Template
**Use Case:** Content with sidebar, image-text combinations
**Difficulty:** Beginner
**Estimated Time:** 15 minutes

**Fields Included:**
- Left Column Content (richtext)
- Right Column Content (richtext)
- Column Ratio (choice: 50/50, 60/40, 70/30)
- Vertical Alignment (choice)
- Mobile Stacking (choice)

#### Card Grid Template
**Use Case:** Product showcases, team members, blog previews
**Difficulty:** Intermediate
**Estimated Time:** 20 minutes

**Fields Included:**
- Grid Title (text)
- Cards (repeater with image, title, description, link)
- Grid Columns (choice: 2, 3, 4, 6)
- Card Style (choice)
- Spacing Options (choice)

### 5. Interactive Modules

#### Accordion Template
**Use Case:** FAQs, expandable content sections
**Difficulty:** Intermediate
**Estimated Time:** 20 minutes

**Fields Included:**
- Accordion Title (text)
- Accordion Items (repeater with title, content)
- Allow Multiple Open (boolean)
- Default Open Item (number)
- Animation Style (choice)

#### Tab Container Template
**Use Case:** Organized content presentation
**Difficulty:** Intermediate
**Estimated Time:** 25 minutes

**Fields Included:**
- Tab Items (repeater with tab title, content)
- Tab Position (choice: top, left, right)
- Default Active Tab (number)
- Tab Style (choice)

## Implementation Guides

### Getting Started with Templates

1. **Choose Your Template**
   - Browse available templates by category
   - Consider your use case and skill level
   - Check estimated completion time

2. **Import Template**
   - Click "Use Template" button
   - Review included fields and settings
   - Customize as needed for your project

3. **Customize Content**
   - Update default values
   - Modify field labels and help text
   - Adjust styling options

4. **Test and Validate**
   - Use the preview function
   - Run validation checks
   - Test responsive behavior

### Customization Tips

#### Field Modifications
- **Adding Fields:** Use the field editor to add new fields
- **Removing Fields:** Delete unused fields to simplify the interface
- **Reordering:** Drag fields to change their order in the editor

#### Styling Customization
- **Colors:** Update CSS variables for brand colors
- **Typography:** Modify font families and sizes
- **Spacing:** Adjust margins and padding values
- **Responsive:** Test and adjust mobile breakpoints

#### Advanced Customization
- **Custom CSS:** Add your own CSS for unique styling
- **JavaScript:** Include interactive functionality
- **HubL Logic:** Add conditional content display

### Best Practices

#### Content Strategy
1. **Clear Labels:** Use descriptive field labels
2. **Help Text:** Provide guidance for content editors
3. **Default Values:** Include meaningful placeholder content
4. **Validation:** Set appropriate field requirements

#### Performance Optimization
1. **Image Optimization:** Use appropriate image sizes
2. **CSS Efficiency:** Avoid redundant styles
3. **JavaScript:** Minimize and optimize scripts
4. **Lazy Loading:** Implement for images and heavy content

#### Accessibility
1. **Semantic HTML:** Use proper heading structure
2. **Alt Text:** Include for all images
3. **Keyboard Navigation:** Ensure all interactive elements are accessible
4. **Color Contrast:** Meet WCAG guidelines

## Template Library

### Quick Reference

| Template | Category | Difficulty | Time | Use Case |
|----------|----------|------------|------|----------|
| Hero Section | Content | Beginner | 10 min | Landing pages, headers |
| Feature Grid | Content | Intermediate | 15 min | Product features |
| Testimonial Carousel | Content | Intermediate | 20 min | Customer reviews |
| Mega Menu | Navigation | Advanced | 30 min | Complex navigation |
| Breadcrumb | Navigation | Beginner | 5 min | Page navigation |
| Contact Form | Forms | Intermediate | 25 min | Lead generation |
| Newsletter Signup | Forms | Beginner | 10 min | Email collection |
| Two-Column Layout | Layout | Beginner | 15 min | Content + sidebar |
| Card Grid | Layout | Intermediate | 20 min | Product showcases |
| Accordion | Interactive | Intermediate | 20 min | FAQs, collapsible content |
| Tab Container | Interactive | Intermediate | 25 min | Organized content |

### Template Combinations

#### Landing Page Kit
Combine these templates for a complete landing page:
- Hero Section (header)
- Feature Grid (benefits)
- Testimonial Carousel (social proof)
- Contact Form (conversion)

#### Blog Layout Kit
Create a blog layout with:
- Two-Column Layout (content + sidebar)
- Card Grid (related posts)
- Newsletter Signup (subscription)

#### Product Page Kit
Build product pages using:
- Hero Section (product showcase)
- Accordion (specifications/FAQs)
- Tab Container (details/reviews/specs)
- Contact Form (inquiries)

## Contributing Templates

### Template Submission Guidelines

1. **Documentation Requirements**
   - Complete field documentation
   - Use case description
   - Implementation notes
   - Screenshots/examples

2. **Code Quality Standards**
   - Follow HubSpot best practices
   - Include proper validation
   - Optimize for performance
   - Ensure accessibility compliance

3. **Testing Requirements**
   - Test across browsers
   - Verify mobile responsiveness
   - Validate HubSpot compatibility
   - Check for errors and warnings

### Template Review Process

1. **Initial Review:** Check documentation and code quality
2. **Testing Phase:** Verify functionality and compatibility
3. **Community Feedback:** Gather user feedback and suggestions
4. **Final Approval:** Add to official template library

## Support and Resources

### Getting Help
- **Documentation:** Comprehensive guides and tutorials
- **Community Forum:** Connect with other developers
- **Support Team:** Direct assistance for complex issues

### Additional Resources
- **Video Tutorials:** Step-by-step template walkthroughs
- **Code Examples:** Advanced customization samples
- **Best Practices Guide:** Industry standards and recommendations
- **Update Notifications:** Stay informed about new templates

## Conclusion

These sample templates provide a solid foundation for creating professional HubSpot modules quickly and efficiently. Whether you're a beginner looking to get started or an experienced developer seeking to streamline your workflow, these templates can help you build better modules faster.

Remember to customize templates to match your brand and specific requirements, and always test thoroughly before deploying to production environments.
