# HubSpot Module Examples

This document provides complete examples of valid configuration files for different types of HubSpot modules.

## 1. Content Module Example - Hero Section

### fields.json
```json
[
  {
    "id": "headline",
    "name": "Headline",
    "label": "Main Headline",
    "type": "text",
    "required": true,
    "default": "Transform Your Business Today",
    "help_text": "The main headline that will grab attention",
    "validation_regex": "^.{1,100}$"
  },
  {
    "id": "subheadline",
    "name": "Subheadline",
    "label": "Supporting Text",
    "type": "text",
    "required": false,
    "default": "Discover how our solutions can help you achieve your goals",
    "help_text": "Supporting text that provides more context"
  },
  {
    "id": "body_content",
    "name": "Body Content",
    "label": "Description",
    "type": "richtext",
    "required": false,
    "default": "<p>Add your detailed description here with rich formatting options.</p>",
    "help_text": "Detailed content with rich text formatting"
  },
  {
    "id": "hero_image",
    "name": "Hero Image",
    "label": "Background Image",
    "type": "image",
    "required": false,
    "default": {
      "src": "",
      "alt": "Hero background image",
      "width": 1200,
      "height": 600
    },
    "help_text": "High-quality background image (recommended: 1200x600px)"
  },
  {
    "id": "cta_text",
    "name": "CTA Text",
    "label": "Button Text",
    "type": "text",
    "required": false,
    "default": "Get Started",
    "help_text": "Text for the call-to-action button"
  },
  {
    "id": "cta_link",
    "name": "CTA Link",
    "label": "Button Link",
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
    "help_text": "Where the button should link to"
  },
  {
    "id": "layout_style",
    "name": "Layout Style",
    "label": "Layout",
    "type": "choice",
    "required": false,
    "default": "centered",
    "choices": [
      ["left", "Left Aligned"],
      ["centered", "Centered"],
      ["right", "Right Aligned"]
    ],
    "help_text": "Choose the text alignment for this section"
  },
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
    "help_text": "Background color for the hero section"
  },
  {
    "id": "show_section",
    "name": "Show Section",
    "label": "Display this section",
    "type": "boolean",
    "required": false,
    "default": true,
    "help_text": "Toggle to show or hide this entire section"
  }
]
```

### meta.json
```json
{
  "label": "Hero Section",
  "description": "A customizable hero section with headline, content, image, and call-to-action button",
  "icon": "modules",
  "is_available_for_new_content": true,
  "smart_type": "NOT_SMART",
  "type": "module",
  "content_types": ["SITE_PAGE", "BLOG_POST"],
  "categories": ["content", "hero"],
  "tags": ["responsive", "customizable", "hero", "landing-page"],
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "smart_objects": [],
  "wrap_field_tag": "div"
}
```

### module.html
```html
{% if module.show_section %}
<section class="hero-section hero-{{ module.layout_style }}" 
         style="background-color: {{ module.background_color.color }}; background-color: rgba({{ module.background_color.color|convert_rgb }}, {{ module.background_color.opacity / 100 }});">
  
  {% if module.hero_image.src %}
  <div class="hero-background" style="background-image: url('{{ module.hero_image.src }}');">
  {% endif %}
  
  <div class="hero-content container">
    <div class="hero-text">
      {% if module.headline %}
      <h1 class="hero-headline">{{ module.headline }}</h1>
      {% endif %}
      
      {% if module.subheadline %}
      <h2 class="hero-subheadline">{{ module.subheadline }}</h2>
      {% endif %}
      
      {% if module.body_content %}
      <div class="hero-body">
        {{ module.body_content }}
      </div>
      {% endif %}
      
      {% if module.cta_link.url.href and module.cta_text %}
      <div class="hero-cta">
        <a href="{{ module.cta_link.url.href }}" 
           class="btn btn-primary"
           {% if module.cta_link.open_in_new_tab %}target="_blank"{% endif %}
           {% if module.cta_link.no_follow %}rel="nofollow"{% endif %}>
          {{ module.cta_text }}
        </a>
      </div>
      {% endif %}
    </div>
  </div>
  
  {% if module.hero_image.src %}
  </div>
  {% endif %}
  
</section>
{% endif %}
```

## 2. Feature Module Example - Three Column Features

### fields.json
```json
[
  {
    "id": "section_title",
    "name": "Section Title",
    "label": "Main Title",
    "type": "text",
    "required": false,
    "default": "Our Features",
    "help_text": "Title for the entire features section"
  },
  {
    "id": "features",
    "name": "Features",
    "label": "Feature Items",
    "type": "group",
    "required": false,
    "default": [
      {
        "icon": "star",
        "title": "Feature One",
        "description": "Description of the first feature"
      },
      {
        "icon": "heart",
        "title": "Feature Two", 
        "description": "Description of the second feature"
      },
      {
        "icon": "check",
        "title": "Feature Three",
        "description": "Description of the third feature"
      }
    ],
    "children": [
      {
        "id": "icon",
        "name": "Icon",
        "label": "Feature Icon",
        "type": "icon",
        "required": false,
        "default": {
          "name": "star",
          "unicode": "f005",
          "type": "SOLID"
        },
        "help_text": "Icon to represent this feature"
      },
      {
        "id": "title",
        "name": "Title",
        "label": "Feature Title",
        "type": "text",
        "required": true,
        "default": "Feature Title",
        "help_text": "Title for this feature"
      },
      {
        "id": "description",
        "name": "Description",
        "label": "Feature Description",
        "type": "richtext",
        "required": false,
        "default": "<p>Describe this feature and its benefits.</p>",
        "help_text": "Detailed description of the feature"
      },
      {
        "id": "link",
        "name": "Link",
        "label": "Learn More Link",
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
        "help_text": "Optional link to learn more about this feature"
      }
    ],
    "help_text": "Add up to 6 features to showcase"
  },
  {
    "id": "columns",
    "name": "Columns",
    "label": "Number of Columns",
    "type": "choice",
    "required": false,
    "default": "3",
    "choices": [
      ["2", "2 Columns"],
      ["3", "3 Columns"],
      ["4", "4 Columns"]
    ],
    "help_text": "How many columns to display features in"
  }
]
```

### meta.json
```json
{
  "label": "Feature Grid",
  "description": "Customizable grid of features with icons, titles, and descriptions",
  "icon": "grid",
  "is_available_for_new_content": true,
  "smart_type": "NOT_SMART",
  "type": "module",
  "content_types": ["SITE_PAGE", "BLOG_POST"],
  "categories": ["content", "feature"],
  "tags": ["responsive", "features", "grid", "icons"],
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "smart_objects": [],
  "wrap_field_tag": "div"
}
```

### module.html
```html
<section class="features-section">
  <div class="container">
    
    {% if module.section_title %}
    <div class="section-header">
      <h2 class="section-title">{{ module.section_title }}</h2>
    </div>
    {% endif %}
    
    {% if module.features %}
    <div class="features-grid features-cols-{{ module.columns }}">
      {% for feature in module.features %}
      <div class="feature-item">
        
        {% if feature.icon.name %}
        <div class="feature-icon">
          <i class="fas fa-{{ feature.icon.name }}"></i>
        </div>
        {% endif %}
        
        {% if feature.title %}
        <h3 class="feature-title">
          {% if feature.link.url.href %}
          <a href="{{ feature.link.url.href }}"
             {% if feature.link.open_in_new_tab %}target="_blank"{% endif %}
             {% if feature.link.no_follow %}rel="nofollow"{% endif %}>
            {{ feature.title }}
          </a>
          {% else %}
          {{ feature.title }}
          {% endif %}
        </h3>
        {% endif %}
        
        {% if feature.description %}
        <div class="feature-description">
          {{ feature.description }}
        </div>
        {% endif %}
        
      </div>
      {% endfor %}
    </div>
    {% endif %}
    
  </div>
</section>
```

## 3. Form Module Example - Contact Form

### fields.json
```json
[
  {
    "id": "form_title",
    "name": "Form Title",
    "label": "Title",
    "type": "text",
    "required": false,
    "default": "Get In Touch",
    "help_text": "Title displayed above the form"
  },
  {
    "id": "form_description",
    "name": "Form Description",
    "label": "Description",
    "type": "richtext",
    "required": false,
    "default": "<p>Fill out the form below and we'll get back to you soon.</p>",
    "help_text": "Description text shown above the form"
  },
  {
    "id": "hubspot_form",
    "name": "HubSpot Form",
    "label": "Select Form",
    "type": "form",
    "required": true,
    "help_text": "Choose a HubSpot form to embed in this module"
  },
  {
    "id": "form_style",
    "name": "Form Style",
    "label": "Form Styling",
    "type": "choice",
    "required": false,
    "default": "standard",
    "choices": [
      ["standard", "Standard"],
      ["minimal", "Minimal"],
      ["bordered", "Bordered"],
      ["rounded", "Rounded Corners"]
    ],
    "help_text": "Choose the visual style for the form"
  },
  {
    "id": "background_color",
    "name": "Background Color",
    "label": "Background",
    "type": "color",
    "required": false,
    "default": {
      "color": "#f8f9fa",
      "opacity": 100
    },
    "help_text": "Background color for the form section"
  },
  {
    "id": "show_privacy_notice",
    "name": "Show Privacy Notice",
    "label": "Display privacy notice",
    "type": "boolean",
    "required": false,
    "default": true,
    "help_text": "Show privacy notice below the form"
  },
  {
    "id": "privacy_text",
    "name": "Privacy Text",
    "label": "Privacy Notice",
    "type": "richtext",
    "required": false,
    "default": "<p><small>We respect your privacy and will never share your information.</small></p>",
    "help_text": "Privacy notice text",
    "visibility": {
      "controlling_field": "show_privacy_notice",
      "controlling_value_regex": "true",
      "operator": "EQUAL"
    }
  }
]
```

### meta.json
```json
{
  "label": "Contact Form",
  "description": "Customizable contact form with HubSpot form integration",
  "icon": "form",
  "is_available_for_new_content": true,
  "smart_type": "NOT_SMART",
  "type": "module",
  "content_types": ["SITE_PAGE", "BLOG_POST"],
  "categories": ["form", "conversion"],
  "tags": ["form", "contact", "lead-generation", "hubspot"],
  "css_assets": [],
  "js_assets": [],
  "other_assets": [],
  "smart_objects": [],
  "wrap_field_tag": "div"
}
```

### module.html
```html
<section class="contact-form-section" 
         style="background-color: {{ module.background_color.color }}; background-color: rgba({{ module.background_color.color|convert_rgb }}, {{ module.background_color.opacity / 100 }});">
  <div class="container">
    
    {% if module.form_title or module.form_description %}
    <div class="form-header">
      {% if module.form_title %}
      <h2 class="form-title">{{ module.form_title }}</h2>
      {% endif %}
      
      {% if module.form_description %}
      <div class="form-description">
        {{ module.form_description }}
      </div>
      {% endif %}
    </div>
    {% endif %}
    
    {% if module.hubspot_form %}
    <div class="form-wrapper form-style-{{ module.form_style }}">
      {% form
        form_to_use="{{ module.hubspot_form.form_id }}",
        response_redirect_url="{{ module.hubspot_form.redirect_url }}",
        response_message="{{ module.hubspot_form.message }}"
      %}
    </div>
    {% endif %}
    
    {% if module.show_privacy_notice and module.privacy_text %}
    <div class="privacy-notice">
      {{ module.privacy_text }}
    </div>
    {% endif %}
    
  </div>
</section>
```

## 4. Navigation Module Example - Mega Menu

### fields.json
```json
[
  {
    "id": "menu_items",
    "name": "Menu Items",
    "label": "Navigation Items",
    "type": "group",
    "required": false,
    "default": [
      {
        "label": "Home",
        "url": "/",
        "has_submenu": false
      },
      {
        "label": "About",
        "url": "/about",
        "has_submenu": true,
        "submenu_items": [
          {
            "label": "Our Story",
            "url": "/about/story"
          },
          {
            "label": "Team",
            "url": "/about/team"
          }
        ]
      }
    ],
    "children": [
      {
        "id": "label",
        "name": "Label",
        "label": "Menu Label",
        "type": "text",
        "required": true,
        "default": "Menu Item",
        "help_text": "Text displayed for this menu item"
      },
      {
        "id": "url",
        "name": "URL",
        "label": "Link URL",
        "type": "url",
        "required": true,
        "default": {
          "url": {
            "href": "/",
            "type": "EXTERNAL"
          },
          "open_in_new_tab": false,
          "no_follow": false
        },
        "help_text": "Where this menu item links to"
      },
      {
        "id": "has_submenu",
        "name": "Has Submenu",
        "label": "Enable submenu",
        "type": "boolean",
        "required": false,
        "default": false,
        "help_text": "Enable dropdown submenu for this item"
      },
      {
        "id": "submenu_items",
        "name": "Submenu Items",
        "label": "Submenu",
        "type": "group",
        "required": false,
        "visibility": {
          "controlling_field": "has_submenu",
          "controlling_value_regex": "true",
          "operator": "EQUAL"
        },
        "children": [
          {
            "id": "label",
            "name": "Label",
            "label": "Submenu Label",
            "type": "text",
            "required": true,
            "default": "Submenu Item"
          },
          {
            "id": "url",
            "name": "URL",
            "label": "Submenu URL",
            "type": "url",
            "required": true,
            "default": {
              "url": {
                "href": "/",
                "type": "EXTERNAL"
              },
              "open_in_new_tab": false,
              "no_follow": false
            }
          }
        ]
      }
    ],
    "help_text": "Configure the main navigation menu items"
  },
  {
    "id": "menu_style",
    "name": "Menu Style",
    "label": "Navigation Style",
    "type": "choice",
    "required": false,
    "default": "horizontal",
    "choices": [
      ["horizontal", "Horizontal"],
      ["vertical", "Vertical"],
      ["mega", "Mega Menu"]
    ],
    "help_text": "Choose the style for the navigation menu"
  }
]
```

### meta.json
```json
{
  "label": "Navigation Menu",
  "description": "Customizable navigation menu with dropdown support",
  "icon": "menu",
  "is_available_for_new_content": true,
  "smart_type": "NOT_SMART",
  "type": "module",
  "content_types": ["SITE_PAGE"],
  "categories": ["navigation"],
  "tags": ["navigation", "menu", "dropdown", "responsive"],
  "css_assets": [],
  "js_assets": [
    {
      "type": "module",
      "src": "navigation.js"
    }
  ],
  "other_assets": [],
  "smart_objects": [],
  "wrap_field_tag": "nav"
}
```

### module.html
```html
<nav class="main-navigation nav-style-{{ module.menu_style }}" role="navigation" aria-label="Main Navigation">
  {% if module.menu_items %}
  <ul class="nav-menu">
    {% for item in module.menu_items %}
    <li class="nav-item {% if item.has_submenu %}has-submenu{% endif %}">
      <a href="{{ item.url.url.href }}" 
         class="nav-link"
         {% if item.url.open_in_new_tab %}target="_blank"{% endif %}
         {% if item.url.no_follow %}rel="nofollow"{% endif %}
         {% if item.has_submenu %}aria-haspopup="true" aria-expanded="false"{% endif %}>
        {{ item.label }}
        {% if item.has_submenu %}
        <span class="submenu-indicator" aria-hidden="true">▼</span>
        {% endif %}
      </a>
      
      {% if item.has_submenu and item.submenu_items %}
      <ul class="submenu" aria-label="Submenu for {{ item.label }}">
        {% for subitem in item.submenu_items %}
        <li class="submenu-item">
          <a href="{{ subitem.url.url.href }}" 
             class="submenu-link"
             {% if subitem.url.open_in_new_tab %}target="_blank"{% endif %}
             {% if subitem.url.no_follow %}rel="nofollow"{% endif %}>
            {{ subitem.label }}
          </a>
        </li>
        {% endfor %}
      </ul>
      {% endif %}
    </li>
    {% endfor %}
  </ul>
  {% endif %}
</nav>
```

## Validation Notes

### Common Requirements Across All Examples:
1. **Unique Field IDs**: All field IDs are unique within each module
2. **Required Fields**: Essential fields are marked as required with appropriate defaults
3. **Help Text**: All fields include helpful descriptions for content editors
4. **Conditional Visibility**: Advanced fields use visibility controls appropriately
5. **Semantic HTML**: Templates use proper HTML5 semantic elements
6. **Accessibility**: ARIA attributes and proper labeling included
7. **HubL Best Practices**: Conditional rendering and default values used throughout

### Field Type Usage:
- **Text**: Simple text inputs with validation
- **Rich Text**: Content areas that need formatting
- **Image**: Media fields with proper alt text defaults
- **URL**: Link fields with all necessary options
- **Boolean**: Toggle switches for show/hide functionality
- **Choice**: Dropdown selections with clear options
- **Color**: Color pickers with opacity support
- **Group**: Repeatable content blocks
- **Form**: HubSpot form integration
- **Icon**: Icon selection fields

These examples serve as templates for creating high-quality HubSpot modules that follow best practices and provide excellent user experience for content editors.
