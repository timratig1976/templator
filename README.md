# Windsurf MVP

A tool that converts screen designs to HTML with Tailwind CSS, generates HubSpot modules, and provides live preview functionality.

## Features

- **Design-to-Code**: Parse HTML snippets or JSON components into responsive Tailwind HTML
- **Field Detection**: Automatic detection of editable content fields using data-field attributes or heuristics
- **HubSpot Module Generation**: Generate complete HubSpot modules with HubL templates and field definitions
- **Live Preview**: Real-time preview with responsive breakpoints (Desktop/Tablet/Mobile)
- **ZIP Export**: Download ready-to-use HubSpot modules

## Tech Stack

- **Frontend**: Next.js 14 + React + Tailwind CSS + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Architecture**: Monorepo with shared types and modular services
- **Security**: Input validation, HTML sanitization, CSP headers
- **Testing**: Jest for unit and integration tests

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd windsurf-mvp
```

2. Install dependencies:
```bash
npm install
```

3. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Project Structure

```
windsurf-mvp/
├── frontend/                 # Next.js React application
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   └── components/      # React components
│   └── package.json
├── backend/                 # Express API server
│   ├── src/
│   │   ├── services/        # Core business logic
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Express middleware
│   │   └── utils/           # Utilities
│   └── package.json
├── shared/                  # Shared TypeScript types
│   └── types.ts
└── package.json            # Root package.json
```

## API Endpoints

### POST /api/parse
Parse HTML input and detect editable fields.

**Request:**
```json
{
  "source_type": "html",
  "payload": "<section>...</section>"
}
```

**Response:**
```json
{
  "html_normalized": "<section class=\"py-12 md:py-20\">...</section>",
  "fields_detected": [
    {
      "id": "headline",
      "label": "Headline",
      "type": "text",
      "selector": "h1",
      "required": true,
      "default": "Sample Headline"
    }
  ]
}
```

### POST /api/module
Generate HubSpot module from normalized HTML.

**Request:**
```json
{
  "html_normalized": "<section>...</section>",
  "fields_config": [...]
}
```

**Response:**
```json
{
  "module_zip_url": "/api/download/windsurf_abc123",
  "module_slug": "windsurf_abc123",
  "manifest": {...}
}
```

### GET /api/download/:slug
Download generated HubSpot module as ZIP file.

## Field Mapping

### Explicit Mapping (Recommended)
Use `data-field` attributes for precise control:

```html
<h1 data-field="headline">Your Headline</h1>
<p data-field="body">Your content text</p>
<img data-field="image_main" src="..." alt="..." />
<a data-field="cta_primary" href="#">Button Text</a>
```

### Automatic Detection
The system automatically detects common patterns:

| Element | Field Type | Field ID |
|---------|------------|----------|
| `h1, .headline` | text | headline |
| `h2, h3, .subheadline` | text | subheadline |
| `p, .copy` | richtext | body |
| `img` | image | image_main |
| `a.btn, .button` | url | cta_primary |

## HubSpot Module Structure

Generated modules include:

- **module.html**: HubL template with Tailwind classes
- **fields.json**: Field definitions for HubSpot editor
- **meta.json**: Module metadata and configuration
- **module.css**: Optional custom styles
- **module.js**: Optional custom JavaScript

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend
npm run dev:backend      # Start only backend

# Building
npm run build            # Build both applications
npm run build:frontend   # Build only frontend
npm run build:backend    # Build only backend

# Testing & Quality
npm run test            # Run tests in all workspaces
npm run lint            # Run ESLint in all workspaces
npm run type-check      # Run TypeScript checks
```

### Adding New Field Types

1. Update `DetectedField` type in `shared/types.ts`
2. Add mapping rules in `DEFAULT_FIELD_MAPPING_RULES`
3. Update `FieldMapperService` detection logic
4. Update `HubSpotModuleBuilder` field generation
5. Add frontend UI support in components

### Testing

Run the test suite:

```bash
npm run test
```

Tests cover:
- HTML parsing and normalization
- Field detection and mapping
- HubSpot module generation
- ZIP file creation
- API endpoints

## Security

- Input validation using Joi schemas
- HTML sanitization (removes scripts, inline handlers)
- Content Security Policy headers
- Rate limiting (basic IP-based)
- No persistent data storage
- Temporary file cleanup

## Deployment

### Environment Variables

```bash
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### Reports Directory (REPORTS_DIR)

Templator writes test reports, coverage, build reports, and logs under a unified reports directory. Configure the base directory with `REPORTS_DIR`.

- Default (if unset): `<repo_root>/reports`
- Can be absolute or relative to the repo root
- Used by backend testing services, coverage, build reports, and `dev-start.sh` logs

Example `.env` configuration:

```ini
# Base directory for all reports and logs
REPORTS_DIR=reports
```

Directory layout:

```
reports/
  backend/
    testing/           # Jest outputs, coverage, test reports
      coverage/
    build/             # Auto-build test service outputs
  logs/                # Dev/startup logs
```

### Production Build

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the GitHub issues
2. Review the API documentation
3. Check the logs for error details
4. Contact the development team

---

**Windsurf MVP v0.1.0** - Built with ❤️ for seamless design-to-HubSpot workflows.
