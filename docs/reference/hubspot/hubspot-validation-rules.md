# HubSpot Module Validation Rules Specifications

This document defines formal validation rules for HubSpot module structure, error classification systems, and quality assurance standards.

## Module Structure Validation Rules

### 1. File Structure Validation

#### Required Files:
- **fields.json**: Must exist and contain valid JSON
- **meta.json**: Must exist with required metadata
- **module.html**: Must exist with valid HubL syntax

#### Optional Files:
- **module.css**: If present, must be valid CSS
- **module.js**: If present, must be valid JavaScript
- **README.md**: If present, must be valid Markdown

#### Validation Rules:
```javascript
const MODULE_STRUCTURE_RULES = {
  requiredFiles: ['fields.json', 'meta.json', 'module.html'],
  optionalFiles: ['module.css', 'module.js', 'README.md'],
  maxFileSize: {
    'fields.json': '100KB',
    'meta.json': '50KB',
    'module.html': '500KB',
    'module.css': '200KB',
    'module.js': '200KB'
  },
  encoding: 'UTF-8'
};
```

### 2. fields.json Validation Rules

#### Schema Structure:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "name", "type"],
    "properties": {
      "id": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*$",
        "minLength": 1,
        "maxLength": 50
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "type": {
        "enum": ["text", "richtext", "image", "url", "boolean", "choice", "color", "font", "number", "date", "file", "blog", "form", "menu", "page", "email", "hubdb", "tag", "icon", "border", "spacing", "background", "gradient", "alignment", "cta", "group"]
      },
      "required": {
        "type": "boolean"
      },
      "locked": {
        "type": "boolean"
      },
      "default": true,
      "help_text": {
        "type": "string",
        "maxLength": 500
      }
    }
  }
}
```

#### Field ID Validation Rules:
1. **Format**: Must match pattern `^[a-z][a-z0-9_]*$`
2. **Length**: 1-50 characters
3. **Uniqueness**: Must be unique within the module
4. **Reserved Names**: Cannot use reserved field names
5. **Naming Convention**: snake_case preferred

#### Reserved Field Names:
```javascript
const RESERVED_FIELD_NAMES = [
  // System reserved
  'id', 'name', 'type', 'class', 'style', 'data',
  
  // HubSpot reserved
  'content', 'module', 'widget', 'page', 'blog', 'site', 'domain',
  'portal', 'account', 'contact', 'company', 'deal', 'ticket',
  
  // HTML reserved
  'src', 'href', 'alt', 'title', 'value', 'placeholder',
  
  // JavaScript reserved
  'function', 'var', 'let', 'const', 'class', 'extends', 'import', 'export',
  
  // Common conflicts
  'length', 'constructor', 'prototype', 'toString', 'valueOf'
];
```

#### Field Type Specific Validation:

**Text Field Rules:**
```javascript
const TEXT_FIELD_RULES = {
  default: {
    type: 'string',
    maxLength: 1000
  },
  validation_regex: {
    type: 'string',
    format: 'regex'
  },
  placeholder: {
    type: 'string',
    maxLength: 100
  }
};
```

**Choice Field Rules:**
```javascript
const CHOICE_FIELD_RULES = {
  choices: {
    type: 'array',
    minItems: 1,
    maxItems: 50,
    items: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        { type: 'string', minLength: 1, maxLength: 50 }, // value
        { type: 'string', minLength: 1, maxLength: 100 } // label
      ]
    }
  },
  default: {
    type: 'string',
    // Must match one of the choice values
  }
};
```

**Group Field Rules:**
```javascript
const GROUP_FIELD_RULES = {
  children: {
    type: 'array',
    minItems: 1,
    maxItems: 20,
    items: {
      // Same schema as root field items
    }
  },
  max_items: {
    type: 'integer',
    minimum: 1,
    maximum: 100
  },
  default: {
    type: 'array',
    maxItems: 10
  }
};
```

### 3. meta.json Validation Rules

#### Required Properties:
```javascript
const META_REQUIRED_PROPERTIES = {
  label: {
    type: 'string',
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z0-9\\s\\-_]+$'
  },
  description: {
    type: 'string',
    minLength: 1,
    maxLength: 500
  },
  icon: {
    type: 'string',
    enum: ['modules', 'grid', 'form', 'image', 'text', 'menu', 'video', 'gallery', 'map', 'social']
  },
  is_available_for_new_content: {
    type: 'boolean'
  },
  smart_type: {
    type: 'string',
    enum: ['NOT_SMART', 'SMART_RULE', 'SMART_CONTENT']
  },
  type: {
    type: 'string',
    enum: ['module']
  },
  content_types: {
    type: 'array',
    items: {
      enum: ['ANY', 'LANDING_PAGE', 'SITE_PAGE', 'BLOG_POST', 'BLOG_LISTING', 'EMAIL', 'KNOWLEDGE_BASE', 'QUOTE_TEMPLATE', 'CUSTOMER_PORTAL', 'WEB_INTERACTIVE', 'SUBSCRIPTION', 'MEMBERSHIP']
    },
    minItems: 0  // Can be empty array [] for modules not available in any area
  }
};
```

#### Optional Properties Validation:
```javascript
const META_OPTIONAL_PROPERTIES = {
  categories: {
    type: 'array',
    items: {
      type: 'string',
      enum: ['content', 'feature', 'form', 'navigation', 'media', 'social', 'ecommerce']
    },
    maxItems: 5
  },
  tags: {
    type: 'array',
    items: {
      type: 'string',
      maxLength: 50
    },
    maxItems: 10
  },
  css_assets: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { enum: ['module', 'external'] },
        src: { type: 'string', format: 'uri' }
      }
    }
  },
  js_assets: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { enum: ['module', 'external'] },
        src: { type: 'string', format: 'uri' }
      }
    }
  }
};
```

### 4. module.html Validation Rules

#### HubL Syntax Validation:
1. **Valid HubL**: All HubL expressions must be syntactically correct
2. **Field References**: All referenced fields must exist in fields.json
3. **Conditional Logic**: Proper if/endif, for/endfor structure
4. **Filter Usage**: Valid HubL filters and functions

#### HTML Structure Validation:
```javascript
const HTML_VALIDATION_RULES = {
  doctype: false, // Modules don't need doctype
  htmlTag: false, // Modules don't need html tag
  headTag: false, // Modules don't need head tag
  bodyTag: false, // Modules don't need body tag
  semanticStructure: true, // Use semantic HTML5 elements
  accessibility: {
    altText: true, // Images must have alt text
    ariaLabels: true, // Interactive elements need ARIA
    headingHierarchy: true, // Proper heading structure
    focusManagement: true // Keyboard navigation support
  },
  performance: {
    inlineStyles: 'warn', // Prefer CSS classes
    inlineScripts: 'error', // No inline JavaScript
    largeImages: 'warn', // Optimize image sizes
    excessiveNesting: 'warn' // Avoid deep nesting
  }
};
```

#### Field Reference Validation:
```javascript
const FIELD_REFERENCE_RULES = {
  // Valid field reference patterns
  validPatterns: [
    /module\.([a-z][a-z0-9_]*)/g, // module.field_name
    /module\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)/g, // module.field.property
    /module\.([a-z][a-z0-9_]*)\[(\d+)\]/g // module.group_field[0]
  ],
  
  // Required conditional checks
  conditionalChecks: {
    text: 'if module.field_name',
    image: 'if module.field_name.src',
    url: 'if module.field_name.url.href',
    group: 'if module.field_name',
    richtext: 'if module.field_name'
  }
};
```

## Error Classification System

### Severity Levels

#### 1. Critical Errors (CRITICAL)
**Impact**: Module will not function or deploy
**Examples**:
- Invalid JSON syntax in configuration files
- Missing required files (fields.json, meta.json, module.html)
- HubL syntax errors that prevent rendering
- References to non-existent fields
- Duplicate field IDs

#### 2. High Errors (HIGH)
**Impact**: Module may not function correctly in production
**Examples**:
- Invalid field types or configurations
- Missing required field properties
- Accessibility violations (missing alt text, ARIA labels)
- Security issues (XSS vulnerabilities)
- Performance issues (large inline styles/scripts)

#### 3. Medium Warnings (MEDIUM)
**Impact**: Module functions but may have issues
**Examples**:
- Non-semantic HTML structure
- Missing help text for complex fields
- Suboptimal default values
- Inconsistent naming conventions
- Missing optional but recommended properties

#### 4. Low Warnings (LOW)
**Impact**: Best practice recommendations
**Examples**:
- Code formatting issues
- Missing documentation
- Inefficient HubL expressions
- Unused field definitions
- Overly complex field structures

### Error Categories

#### 1. Syntax Errors
```javascript
const SYNTAX_ERROR_TYPES = {
  JSON_INVALID: {
    severity: 'CRITICAL',
    message: 'Invalid JSON syntax',
    fix: 'Check for missing commas, brackets, or quotes'
  },
  HUBL_INVALID: {
    severity: 'CRITICAL',
    message: 'Invalid HubL syntax',
    fix: 'Check HubL expressions for proper syntax'
  },
  HTML_INVALID: {
    severity: 'HIGH',
    message: 'Invalid HTML structure',
    fix: 'Ensure proper tag nesting and closing'
  }
};
```

#### 2. Field Definition Errors
```javascript
const FIELD_ERROR_TYPES = {
  DUPLICATE_ID: {
    severity: 'CRITICAL',
    message: 'Duplicate field ID found',
    fix: 'Ensure all field IDs are unique'
  },
  INVALID_TYPE: {
    severity: 'CRITICAL',
    message: 'Invalid field type',
    fix: 'Use supported field types only'
  },
  MISSING_REQUIRED: {
    severity: 'HIGH',
    message: 'Missing required field property',
    fix: 'Add required properties: id, name, type'
  },
  RESERVED_NAME: {
    severity: 'HIGH',
    message: 'Field ID uses reserved name',
    fix: 'Choose a different field ID'
  }
};
```

#### 3. Template Errors
```javascript
const TEMPLATE_ERROR_TYPES = {
  UNDEFINED_FIELD: {
    severity: 'CRITICAL',
    message: 'Template references undefined field',
    fix: 'Ensure field exists in fields.json'
  },
  MISSING_CONDITIONAL: {
    severity: 'HIGH',
    message: 'Field used without conditional check',
    fix: 'Add conditional check before using field'
  },
  ACCESSIBILITY_VIOLATION: {
    severity: 'HIGH',
    message: 'Accessibility requirement not met',
    fix: 'Add required accessibility attributes'
  }
};
```

#### 4. Performance Issues
```javascript
const PERFORMANCE_ERROR_TYPES = {
  INLINE_STYLES: {
    severity: 'MEDIUM',
    message: 'Excessive inline styles detected',
    fix: 'Move styles to module.css file'
  },
  LARGE_DEFAULT: {
    severity: 'MEDIUM',
    message: 'Large default content detected',
    fix: 'Reduce default content size'
  },
  COMPLEX_LOGIC: {
    severity: 'LOW',
    message: 'Complex template logic detected',
    fix: 'Consider simplifying template structure'
  }
};
```

## Validation Checklist Template

### Pre-Generation Checklist
```markdown
## Module Validation Checklist

### File Structure
- [ ] fields.json exists and is valid JSON
- [ ] meta.json exists with required properties
- [ ] module.html exists with valid HubL
- [ ] File sizes within limits
- [ ] Proper UTF-8 encoding

### Field Definitions
- [ ] All field IDs are unique
- [ ] No reserved field names used
- [ ] All required properties present
- [ ] Field types are valid
- [ ] Default values match field types
- [ ] Help text provided for complex fields

### Template Quality
- [ ] All field references exist in fields.json
- [ ] Conditional checks for optional fields
- [ ] Semantic HTML structure
- [ ] Accessibility attributes present
- [ ] No inline scripts
- [ ] Reasonable inline styles

### Metadata
- [ ] Label and description provided
- [ ] Appropriate icon selected
- [ ] Host template types specified
- [ ] Categories and tags added
- [ ] Asset dependencies listed

### Performance
- [ ] Optimized image defaults
- [ ] Minimal inline styles
- [ ] Efficient HubL expressions
- [ ] Reasonable default content size

### Accessibility
- [ ] Alt text for images
- [ ] ARIA labels for interactive elements
- [ ] Proper heading hierarchy
- [ ] Keyboard navigation support
- [ ] Color contrast considerations
```

### Post-Generation Validation
```markdown
## Generated Module Quality Check

### Functionality
- [ ] Module renders without errors
- [ ] All fields appear in editor
- [ ] Field changes reflect in preview
- [ ] Responsive design works
- [ ] Cross-browser compatibility

### Content Editor Experience
- [ ] Field labels are clear
- [ ] Help text is helpful
- [ ] Default values are appropriate
- [ ] Field organization is logical
- [ ] Validation messages are clear

### Performance
- [ ] Module loads quickly
- [ ] No console errors
- [ ] Optimized asset loading
- [ ] Minimal DOM complexity
- [ ] Efficient CSS/JS

### SEO & Accessibility
- [ ] Semantic HTML structure
- [ ] Proper heading hierarchy
- [ ] Image alt text working
- [ ] ARIA attributes functional
- [ ] Screen reader compatible
```

## Automated Validation Implementation

### Validation Pipeline
```javascript
const VALIDATION_PIPELINE = [
  {
    name: 'File Structure Validation',
    function: 'validateFileStructure',
    critical: true
  },
  {
    name: 'JSON Schema Validation',
    function: 'validateJSONSchemas',
    critical: true
  },
  {
    name: 'Field Definition Validation',
    function: 'validateFieldDefinitions',
    critical: true
  },
  {
    name: 'Template Validation',
    function: 'validateTemplate',
    critical: true
  },
  {
    name: 'Accessibility Validation',
    function: 'validateAccessibility',
    critical: false
  },
  {
    name: 'Performance Validation',
    function: 'validatePerformance',
    critical: false
  },
  {
    name: 'Best Practices Validation',
    function: 'validateBestPractices',
    critical: false
  }
];
```

### Validation Response Format
```javascript
const VALIDATION_RESPONSE = {
  valid: boolean,
  score: number, // 0-100
  errors: [
    {
      type: 'CRITICAL|HIGH|MEDIUM|LOW',
      category: 'SYNTAX|FIELD|TEMPLATE|PERFORMANCE',
      code: 'ERROR_CODE',
      message: 'Human readable message',
      file: 'filename.json',
      line: number,
      column: number,
      fix: 'Suggested fix',
      documentation: 'Link to docs'
    }
  ],
  warnings: [],
  suggestions: [],
  metrics: {
    complexity_score: number,
    accessibility_score: number,
    performance_score: number,
    maintainability_score: number
  }
};
```

This validation system ensures high-quality HubSpot modules that meet all technical requirements, accessibility standards, and performance benchmarks while providing clear guidance for improvement.
