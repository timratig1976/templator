# HubSpot Field Types Inventory and Constraints

This document provides a comprehensive inventory of all supported HubSpot field types, their constraints, validation patterns, and usage guidelines.

## Core Field Types

### 1. Text Field
**Type:** `text`
**Purpose:** Single-line text input

#### Properties:
```json
{
  "id": "field_name",
  "type": "text",
  "name": "Display Name",
  "label": "Field Label",
  "required": false,
  "locked": false,
  "default": "default text",
  "help_text": "Helper text",
  "inline_help_text": "Inline help",
  "placeholder": "Enter text...",
  "validation_regex": "^[a-zA-Z0-9\\s]{1,100}$",
  "display": "block"
}
```

#### Constraints:
- **Max Length**: 255 characters for display, unlimited for storage
- **Validation**: Supports regex patterns
- **HTML**: Text is automatically escaped in output
- **Required**: Can be marked as required with validation

#### Common Validation Patterns:
- **Alphanumeric**: `^[a-zA-Z0-9\\s]+$`
- **Length Limit**: `^.{1,100}$`
- **No Special Chars**: `^[a-zA-Z0-9\\s\\-_]+$`
- **Email Format**: `^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$`

#### Reserved Field Names to Avoid:
- `id`, `name`, `type`, `class`, `style`
- `content`, `module`, `widget`
- `page`, `blog`, `site`, `domain`

### 2. Rich Text Field
**Type:** `richtext`
**Purpose:** Multi-line text with HTML formatting

#### Properties:
```json
{
  "id": "content_field",
  "type": "richtext",
  "name": "Content",
  "label": "Rich Content",
  "required": false,
  "default": "<p>Default content</p>",
  "help_text": "Rich text with formatting options",
  "enabled_features": ["bold", "italic", "link", "lists", "alignment"]
}
```

#### Constraints:
- **HTML Tags**: Supports safe HTML subset
- **Allowed Tags**: `p`, `br`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `h1-h6`
- **Forbidden Tags**: `script`, `style`, `iframe`, `object`, `embed`
- **Max Size**: 64KB recommended for performance
- **Images**: Embedded images supported via HubSpot file manager

#### Enabled Features Options:
- `bold`, `italic`, `underline`, `strikethrough`
- `link`, `unlink`
- `lists` (ul/ol), `indent`, `outdent`
- `alignment` (left/center/right/justify)
- `headers` (h1-h6)
- `blockquote`, `code`
- `table`, `image`, `video`

### 3. Image Field
**Type:** `image`
**Purpose:** Image upload and management

#### Properties:
```json
{
  "id": "hero_image",
  "type": "image",
  "name": "Hero Image",
  "label": "Upload Image",
  "required": false,
  "default": {
    "src": "",
    "alt": "Default alt text",
    "width": 1200,
    "height": 600,
    "loading": "lazy",
    "size_type": "auto"
  },
  "help_text": "Upload high-quality image",
  "resizable": true,
  "show_loading": true
}
```

#### Constraints:
- **File Types**: JPG, PNG, GIF, WebP, SVG
- **Max Size**: 20MB per image
- **Dimensions**: No hard limits, but performance considerations apply
- **Alt Text**: Required for accessibility
- **Responsive**: Automatic responsive image generation

#### Image Properties:
- **src**: Image URL (required)
- **alt**: Alt text for accessibility (required)
- **width/height**: Dimensions in pixels
- **loading**: `lazy`, `eager`, or `auto`
- **size_type**: `auto`, `auto_custom_max`, `exact`

#### Size Type Options:
- `auto`: HubSpot chooses optimal size
- `auto_custom_max`: Auto with custom max dimensions
- `exact`: Exact dimensions specified

### 4. URL/Link Field
**Type:** `url`
**Purpose:** Link management with advanced options

#### Properties:
```json
{
  "id": "cta_link",
  "type": "url",
  "name": "CTA Link",
  "label": "Call-to-Action Link",
  "required": false,
  "default": {
    "url": {
      "href": "",
      "type": "EXTERNAL"
    },
    "open_in_new_tab": false,
    "no_follow": false
  },
  "help_text": "Configure link destination and behavior",
  "supported_types": ["EXTERNAL", "CONTENT", "FILE", "EMAIL", "BLOG"]
}
```

#### Constraints:
- **URL Types**: External, Content, File, Email, Blog, Phone
- **Validation**: Automatic URL format validation
- **Protocol**: HTTP/HTTPS enforced for external links
- **Security**: Automatic nofollow option available

#### URL Type Details:
- **EXTERNAL**: Any external URL (http/https)
- **CONTENT**: HubSpot pages and landing pages
- **FILE**: Files uploaded to HubSpot file manager
- **EMAIL**: Mailto links with email validation
- **BLOG**: Blog posts and blog listing pages
- **PHONE**: Tel links for phone numbers

#### Link Properties:
- **href**: The actual URL or path
- **type**: Link type (see above)
- **open_in_new_tab**: Boolean for target="_blank"
- **no_follow**: Boolean for rel="nofollow"
- **rel**: Custom rel attributes

### 5. Boolean Field
**Type:** `boolean`
**Purpose:** True/false toggle switches

#### Properties:
```json
{
  "id": "show_section",
  "type": "boolean",
  "name": "Show Section",
  "label": "Display this section",
  "required": false,
  "default": true,
  "help_text": "Toggle to show or hide content",
  "display": "toggle"
}
```

#### Constraints:
- **Values**: `true` or `false` only
- **Default**: Must be boolean value
- **Display**: Toggle switch or checkbox
- **Conditional Logic**: Often used for visibility controls

#### Display Options:
- `toggle`: Modern toggle switch (recommended)
- `checkbox`: Traditional checkbox

### 6. Choice Field
**Type:** `choice`
**Purpose:** Dropdown or radio button selections

#### Properties:
```json
{
  "id": "layout_style",
  "type": "choice",
  "name": "Layout Style",
  "label": "Choose Layout",
  "required": false,
  "default": "standard",
  "choices": [
    ["value1", "Display Label 1"],
    ["value2", "Display Label 2"],
    ["value3", "Display Label 3"]
  ],
  "help_text": "Select layout option",
  "display": "select",
  "multiple": false
}
```

#### Constraints:
- **Choices Format**: Array of [value, label] pairs
- **Values**: Must be unique within field
- **Labels**: Should be user-friendly
- **Default**: Must match one of the choice values
- **Multiple**: Boolean for multi-select capability

#### Display Options:
- `select`: Dropdown menu (default)
- `radio`: Radio buttons
- `checkbox`: Checkboxes (for multiple selection)

#### Choice Array Format:
```json
"choices": [
  ["internal_value", "User-Friendly Label"],
  ["left", "Left Aligned"],
  ["center", "Centered"],
  ["right", "Right Aligned"]
]
```

### 7. Color Field
**Type:** `color`
**Purpose:** Color picker with opacity support

#### Properties:
```json
{
  "id": "background_color",
  "type": "color",
  "name": "Background Color",
  "label": "Background",
  "required": false,
  "default": {
    "color": "#ffffff",
    "opacity": 100
  },
  "help_text": "Choose background color",
  "show_opacity": true
}
```

#### Constraints:
- **Format**: Hex color codes (#ffffff)
- **Opacity**: 0-100 percentage
- **Validation**: Automatic hex format validation
- **Alpha**: Opacity creates rgba() values

#### Color Properties:
- **color**: Hex color code (required)
- **opacity**: Opacity percentage 0-100
- **r, g, b**: RGB values (auto-calculated)
- **h, s, l**: HSL values (auto-calculated)

#### Usage in Templates:
```html
<!-- Solid color -->
<div style="background-color: {{ module.bg_color.color }};">

<!-- With opacity -->
<div style="background-color: rgba({{ module.bg_color.color|convert_rgb }}, {{ module.bg_color.opacity / 100 }});">
```

### 8. Number Field
**Type:** `number`
**Purpose:** Numeric input with validation

#### Properties:
```json
{
  "id": "column_count",
  "type": "number",
  "name": "Column Count",
  "label": "Number of Columns",
  "required": false,
  "default": 3,
  "min": 1,
  "max": 6,
  "step": 1,
  "help_text": "Choose number of columns (1-6)",
  "display": "text",
  "suffix": "columns"
}
```

#### Constraints:
- **Min/Max**: Numeric range validation
- **Step**: Increment/decrement step size
- **Decimal**: Supports decimal values
- **Integer**: Can be restricted to integers only

#### Display Options:
- `text`: Text input with number validation
- `slider`: Range slider interface
- `stepper`: Input with +/- buttons

#### Validation:
- **Range**: Automatic min/max validation
- **Format**: Numeric format validation
- **Required**: Can be marked as required

### 9. Font Field
**Type:** `font`
**Purpose:** Typography selection and customization

#### Properties:
```json
{
  "id": "heading_font",
  "type": "font",
  "name": "Heading Font",
  "label": "Typography",
  "required": false,
  "default": {
    "font": "Arial, sans-serif",
    "font_set": "GOOGLE",
    "size": 24,
    "size_unit": "px",
    "color": "#333333",
    "styles": {
      "font-weight": "bold",
      "font-style": "normal",
      "text-decoration": "none"
    }
  },
  "help_text": "Configure heading typography"
}
```

#### Constraints:
- **Font Sets**: GOOGLE, SYSTEM, CUSTOM
- **Size Units**: px, em, rem, %
- **Size Range**: 8-72px typical range
- **Web Fonts**: Google Fonts integration

#### Font Properties:
- **font**: Font family name
- **font_set**: Font source (GOOGLE/SYSTEM/CUSTOM)
- **size**: Font size value
- **size_unit**: Size unit (px, em, rem, %)
- **color**: Text color (hex format)
- **styles**: Object with CSS properties

#### Supported Styles:
- `font-weight`: normal, bold, 100-900
- `font-style`: normal, italic, oblique
- `text-decoration`: none, underline, line-through
- `text-transform`: none, uppercase, lowercase, capitalize
- `letter-spacing`: CSS letter-spacing value
- `line-height`: CSS line-height value

### 10. Group Field
**Type:** `group`
**Purpose:** Repeatable content blocks

#### Properties:
```json
{
  "id": "team_members",
  "type": "group",
  "name": "Team Members",
  "label": "Team",
  "required": false,
  "default": [
    {
      "name": "John Doe",
      "title": "CEO",
      "bio": "Company founder"
    }
  ],
  "children": [
    {
      "id": "name",
      "type": "text",
      "name": "Name",
      "required": true,
      "default": "Team Member"
    },
    {
      "id": "title",
      "type": "text",
      "name": "Title",
      "required": false,
      "default": "Position"
    },
    {
      "id": "bio",
      "type": "richtext",
      "name": "Biography",
      "required": false,
      "default": "<p>Bio content</p>"
    }
  ],
  "help_text": "Add team members",
  "max_items": 10
}
```

#### Constraints:
- **Max Items**: Configurable limit (default: unlimited)
- **Min Items**: Minimum required items
- **Children**: Must define child field structure
- **Nesting**: Limited nesting depth (2-3 levels recommended)

#### Child Field Types:
- All basic field types supported
- Nested groups possible but not recommended
- Complex fields (like forms) may have limitations

### 11. Icon Field
**Type:** `icon`
**Purpose:** Icon selection from icon libraries

#### Properties:
```json
{
  "id": "feature_icon",
  "type": "icon",
  "name": "Feature Icon",
  "label": "Icon",
  "required": false,
  "default": {
    "name": "star",
    "unicode": "f005",
    "type": "SOLID",
    "icon_set": "fontawesome-5.14.0"
  },
  "help_text": "Choose an icon",
  "icon_set": "fontawesome-5.14.0"
}
```

#### Constraints:
- **Icon Sets**: FontAwesome, Custom icon sets
- **Types**: SOLID, REGULAR, LIGHT, BRANDS
- **Unicode**: Unicode character reference
- **Custom Icons**: SVG upload support

#### Icon Properties:
- **name**: Icon name/identifier
- **unicode**: Unicode character code
- **type**: Icon style (SOLID, REGULAR, etc.)
- **icon_set**: Icon library version

### 12. Form Field
**Type:** `form`
**Purpose:** HubSpot form integration

#### Properties:
```json
{
  "id": "contact_form",
  "type": "form",
  "name": "Contact Form",
  "label": "Select Form",
  "required": false,
  "default": {
    "form_id": "",
    "portal_id": "",
    "form_type": "HUBSPOT",
    "message": "Thank you for your submission!",
    "redirect_url": "",
    "gotowebinar_webinar_key": ""
  },
  "help_text": "Choose a HubSpot form"
}
```

#### Constraints:
- **Form Types**: HUBSPOT, EXTERNAL
- **Portal ID**: Must match account portal
- **Form ID**: Must be valid HubSpot form
- **Redirect**: Optional redirect after submission

## Advanced Field Types

### 13. Date Field
**Type:** `date`
**Purpose:** Date selection and formatting

#### Properties:
```json
{
  "id": "event_date",
  "type": "date",
  "name": "Event Date",
  "label": "Date",
  "required": false,
  "default": "",
  "help_text": "Select event date",
  "format": "MM/dd/yyyy"
}
```

### 14. File Field
**Type:** `file`
**Purpose:** File upload and management

#### Properties:
```json
{
  "id": "download_file",
  "type": "file",
  "name": "Download File",
  "label": "File",
  "required": false,
  "default": {
    "url": "",
    "type": "FILE"
  },
  "help_text": "Upload file for download"
}
```

### 15. Blog Field
**Type:** `blog`
**Purpose:** Blog post selection

#### Properties:
```json
{
  "id": "featured_post",
  "type": "blog",
  "name": "Featured Post",
  "label": "Blog Post",
  "required": false,
  "help_text": "Select featured blog post"
}
```

## Field Validation Rules

### Required Field Validation:
1. **ID Uniqueness**: All field IDs must be unique within module
2. **Type Consistency**: Field type must match usage in template
3. **Default Values**: Must match field type constraints
4. **Required Fields**: Must have appropriate defaults or validation

### Common Validation Errors:
1. **Duplicate IDs**: Multiple fields with same ID
2. **Invalid Types**: Unsupported field type
3. **Malformed Defaults**: Default value doesn't match type
4. **Missing Properties**: Required properties not defined
5. **Invalid Choices**: Choice arrays malformed
6. **Regex Errors**: Invalid validation regex patterns

### Reserved Field Names:
- System reserved: `id`, `name`, `type`, `class`, `style`
- HubSpot reserved: `content`, `module`, `widget`, `page`
- HTML reserved: `src`, `href`, `alt`, `title`
- JavaScript reserved: `function`, `var`, `let`, `const`

## Best Practices

### Field Naming:
- Use descriptive, clear names
- Follow snake_case convention
- Avoid abbreviations when possible
- Include context in field names

### Default Values:
- Always provide meaningful defaults
- Use realistic sample content
- Consider accessibility in defaults
- Test defaults in various contexts

### Help Text:
- Write clear, concise instructions
- Include format requirements
- Mention character limits
- Provide examples when helpful

### Validation:
- Use appropriate regex patterns
- Set reasonable min/max values
- Consider user experience in validation
- Provide clear error messages

This inventory serves as the foundation for automated field detection, validation, and module generation in the templator system.
