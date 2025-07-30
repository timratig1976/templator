# HubSpot Module Structure Documentation

## Overview
This document provides comprehensive documentation of HubSpot module structure requirements, schemas, and best practices for creating high-quality modules.

## Module File Structure

A complete HubSpot module consists of the following files:

```
module-name/
├── fields.json          # Field definitions for the module editor
├── meta.json           # Module metadata and configuration
├── module.html         # HubL template with module markup
├── module.css          # Optional: Custom CSS styles
├── module.js           # Optional: Custom JavaScript
└── README.md           # Optional: Module documentation
```

## Core Configuration Files

### 1. fields.json - Field Definitions

The `fields.json` file defines all editable fields that appear in the HubSpot module editor.

#### Basic Structure:
```json
[
  {
    "id": "field_name",
    "name": "Display Name",
    "label": "Field Label",
    "required": false,
    "locked": false,
    "type": "text|richtext|image|url|boolean|choice|color|font|number|date|file|blog|form|menu|page|email|hubdb|tag|icon|border|spacing|background|gradient|alignment|cta",
    "default": "default_value",
    "help_text": "Helpful description for content editors",
    "inline_help_text": "Brief inline help",
    "validation_regex": "^[a-zA-Z0-9]+$",
    "placeholder": "Enter text here...",
    "display": "block|inline",
    "visibility": {
      "controlling_field": "other_field_id",
      "controlling_value_regex": "value_pattern",
      "operator": "EQUAL|NOT_EQUAL|EMPTY|NOT_EMPTY|IN|NOT_IN"
    }
  }
]
```

#### Field Type Specifications:

**Text Field:**
```json
{
  "id": "headline",
  "name": "Headline",
  "label": "Main Headline",
  "type": "text",
  "required": true,
  "default": "Your Headline Here",
  "help_text": "The main headline for this section",
  "validation_regex": "^.{1,100}$"
}
```

**Rich Text Field:**
```json
{
  "id": "body_content",
  "name": "Body Content",
  "label": "Content",
  "type": "richtext",
  "required": false,
  "default": "<p>Your content here...</p>",
  "help_text": "Main content area with rich text formatting"
}
```

**Image Field:**
```json
{
  "id": "hero_image",
  "name": "Hero Image",
  "label": "Background Image",
  "type": "image",
  "required": false,
  "default": {
    "src": "",
    "alt": "",
    "width": 1200,
    "height": 600
  },
  "help_text": "Upload a high-quality image (recommended: 1200x600px)"
}
```

**URL/Link Field:**
```json
{
  "id": "cta_link",
  "name": "CTA Link",
  "label": "Call-to-Action Link",
  "type": "url",
  "required": false,
  "default": {
    "url": {
      "href": "",
      "type": "EXTERNAL"
    },
    "open_in_new_tab": false,
    "no_follow": false
  },
  "help_text": "Link for the call-to-action button"
}
```

**Boolean Field:**
```json
{
  "id": "show_section",
  "name": "Show Section",
  "label": "Display this section",
  "type": "boolean",
  "required": false,
  "default": true,
  "help_text": "Toggle to show or hide this section"
}
```

**Choice Field:**
```json
{
  "id": "layout_style",
  "name": "Layout Style",
  "label": "Choose Layout",
  "type": "choice",
  "required": false,
  "default": "standard",
  "choices": [
    ["standard", "Standard Layout"],
    ["centered", "Centered Layout"],
    ["full_width", "Full Width Layout"]
  ],
  "help_text": "Select the layout style for this module"
}
```

**Color Field:**
```json
{
  "id": "background_color",
  "name": "Background Color",
  "label": "Background",
  "type": "color",
  "required": false,
  "default": {
    "color": "#ffffff",
    "opacity": 100
  },
  "help_text": "Choose background color for this section"
}
```

### 2. meta.json - Module Metadata

The `meta.json` file contains module metadata and configuration settings.

#### Basic Structure:
```json
{
  "label": "Module Display Name",
  "description": "Brief description of what this module does",
  "icon": "modules",
  "is_available_for_new_content": true,
  "module_id": 12345678,
  "smart_type": "NOT_SMART",
  "type": "module",
  "content_types": ["SITE_PAGE", "BLOG_POST", "EMAIL"],
  "categories": ["content", "feature"],
  "tags": ["responsive", "customizable"],
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "smart_objects": [],
  "wrap_field_tag": "div"
}
```

#### Field Descriptions:

- **label**: Display name in the module library
- **description**: Brief description shown in module picker
- **icon**: Icon identifier from HubSpot's icon library
- **is_available_for_new_content**: Whether module appears in new content creation
- **smart_type**: "NOT_SMART", "SMART_RULE", or "SMART_CONTENT"
- **content_types**: Content types where the module can be used (replaces deprecated host_template_types)
  - Valid values: "ANY", "LANDING_PAGE", "SITE_PAGE", "BLOG_POST", "BLOG_LISTING", "EMAIL", "KNOWLEDGE_BASE", "QUOTE_TEMPLATE", "CUSTOMER_PORTAL", "WEB_INTERACTIVE", "SUBSCRIPTION", "MEMBERSHIP"
  - Use empty array [] if module should not be available in any area
- **categories**: Categorization for module library
- **css_assets**: External CSS dependencies
- **js_assets**: External JavaScript dependencies

### 3. module.html - HubL Template

The `module.html` file contains the HubL template with the module's HTML structure.

#### Basic Structure:
```html
{% if module.show_section %}
<section class="custom-module {{ module.layout_style }}" 
         style="background-color: {{ module.background_color.color }};">
  
  {% if module.hero_image.src %}
  <div class="hero-image">
    <img src="{{ module.hero_image.src }}" 
         alt="{{ module.hero_image.alt }}" 
         width="{{ module.hero_image.width }}" 
         height="{{ module.hero_image.height }}">
  </div>
  {% endif %}
  
  <div class="content-wrapper">
    {% if module.headline %}
    <h2 class="headline">{{ module.headline }}</h2>
    {% endif %}
    
    {% if module.body_content %}
    <div class="body-content">
      {{ module.body_content }}
    </div>
    {% endif %}
    
    {% if module.cta_link.url.href %}
    <div class="cta-wrapper">
      <a href="{{ module.cta_link.url.href }}" 
         class="cta-button"
         {% if module.cta_link.open_in_new_tab %}target="_blank"{% endif %}
         {% if module.cta_link.no_follow %}rel="nofollow"{% endif %}>
        {{ module.cta_text|default:"Learn More" }}
      </a>
    </div>
    {% endif %}
  </div>
  
</section>
{% endif %}
```

#### HubL Best Practices:

1. **Conditional Rendering**: Always check if fields have values before rendering
2. **Default Values**: Use `|default` filter for fallback content
3. **Semantic HTML**: Use appropriate HTML5 semantic elements
4. **Accessibility**: Include proper ARIA attributes and alt text
5. **Responsive Design**: Use CSS classes that work across devices

## Required vs Optional Fields

### Required Configuration:
- `fields.json` - Must exist (can be empty array)
- `meta.json` - Must exist with minimum required fields
- `module.html` - Must exist with valid HubL syntax

### Optional Files:
- `module.css` - Custom styles (alternative to inline styles)
- `module.js` - Custom JavaScript functionality
- `README.md` - Documentation for developers

## Validation Requirements

### Field Validation:
1. **Unique IDs**: All field IDs must be unique within the module
2. **Reserved Names**: Avoid HubSpot reserved field names
3. **Type Consistency**: Field types must match their usage in HubL
4. **Required Fields**: Must have appropriate defaults or validation

### Template Validation:
1. **Valid HubL**: All HubL syntax must be correct
2. **Field References**: All referenced fields must exist in fields.json
3. **HTML Validity**: Generated HTML should be valid and semantic
4. **Performance**: Avoid heavy computations in templates

## Common Validation Errors

### Field Definition Errors:
- Duplicate field IDs
- Invalid field types
- Missing required properties
- Invalid choice arrays
- Malformed default values

### Template Errors:
- Undefined field references
- Invalid HubL syntax
- Missing conditional checks
- Improper HTML structure
- Accessibility violations

## Module Categories and Best Practices

### Content Modules:
- Focus on text, images, and basic media
- Emphasize readability and accessibility
- Provide rich text editing capabilities

### Feature Modules:
- Interactive elements and advanced functionality
- Custom JavaScript integration
- Complex layout options

### Navigation Modules:
- Menu structures and navigation elements
- Dynamic content based on site structure
- Responsive navigation patterns

### Form Modules:
- Integration with HubSpot forms
- Custom form styling and validation
- Lead capture and conversion optimization

## Next Steps

This documentation serves as the foundation for:
1. Field type inventory and constraints
2. Validation rule specifications
3. OpenAI prompt engineering
4. Automated module generation

## References

- [HubSpot Developer Documentation](https://developers.hubspot.com/docs/cms/building-blocks/modules)
- [HubL Language Reference](https://developers.hubspot.com/docs/cms/hubl)
- [Module Field Types](https://developers.hubspot.com/docs/cms/building-blocks/module-theme-fields)
