# Templator Project - Comprehensive Overview

## 🏗️ Project Architecture

The Templator is a comprehensive AI-powered HubSpot module generation system that converts design layouts into functional HubSpot modules. The project follows a microservices architecture with clear separation between frontend, backend, and shared components.

```
templator/
├── frontend/          # React-based user interface
├── backend/           # Node.js/Express API server
├── shared/            # Shared TypeScript types
├── docs/              # Documentation
└── scripts/           # Deployment and utility scripts
```

## 🔄 Core Process Flow

### 1. **Input Processing Flow**
```
User Upload → Layout Analysis → Section Splitting → AI Processing → Module Generation → Validation → Export
```

### 2. **Detailed Process Pipeline**

1. **Upload & Analysis**
   - User uploads design file (HTML, image, or JSON)
   - `ParserService` analyzes and normalizes input
   - `LayoutSectionSplittingService` splits complex layouts into manageable sections

2. **AI-Powered Generation**
   - `OpenAIService` processes each section with GPT-4
   - `SequentialSectionProcessingService` handles sections individually for quality
   - `HubSpotPromptService` optimizes prompts for better results

3. **Quality Assurance**
   - `HubSpotValidationService` validates generated modules
   - `SchemaUpdateService` ensures compliance with latest HubSpot standards
   - `APIBasedTestingService` tests against actual HubSpot API

4. **Enhancement & Refinement**
   - `IterativeRefinementService` improves module quality
   - `AutoErrorCorrectionService` fixes common issues automatically
   - `ComponentAssemblyEngine` combines components intelligently

5. **Export & Deployment**
   - `ModulePackagingService` packages modules for HubSpot
   - `HubSpotDeploymentService` handles deployment to HubSpot
   - `ExpertReviewDashboard` provides quality metrics

## 📦 Backend Services Architecture

### Core Processing Services

#### **1. Input Processing Layer**
- **`ParserService`** - Normalizes various input formats (HTML, JSON, images)
- **`FieldMapperService`** - Maps design elements to HubSpot field types
- **`LayoutSectionSplittingService`** - Intelligently splits large layouts into sections

#### **2. AI Processing Layer**
- **`OpenAIService`** - Core AI integration with GPT-4 for module generation
- **`HubSpotPromptService`** - Specialized prompts for HubSpot module creation
- **`SequentialSectionProcessingService`** - Processes layout sections sequentially for quality
- **`PromptImprovementEngine`** - Continuously improves AI prompts based on results

#### **3. Quality Assurance Layer**
- **`HubSpotValidationService`** - Comprehensive module validation
- **`SchemaUpdateService`** - Automatic schema updates from HubSpot API
- **`SchemaDiffDetector`** - Detects schema changes and migration requirements
- **`APIBasedTestingService`** - Tests modules against actual HubSpot API
- **`PackageValidationService`** - Validates final module packages

#### **4. Enhancement Layer**
- **`IterativeRefinementService`** - Iteratively improves module quality
- **`AutoErrorCorrectionService`** - Automatically fixes common validation errors
- **`ComponentAssemblyEngine`** - Assembles components into cohesive modules
- **`TemplateCustomizationService`** - Customizes templates based on requirements

#### **5. Repository & Management Layer**
- **`ModuleComponentRepository`** - Manages reusable component library
- **`TemplateLibraryService`** - Manages template collections
- **`ModuleVersioningService`** - Handles module versioning and updates
- **`PromptVersioningService`** - Manages prompt versions and A/B testing

#### **6. Deployment & Integration Layer**
- **`HubSpotAPIService`** - Core HubSpot API integration
- **`HubSpotDeploymentService`** - Handles module deployment to HubSpot
- **`HubSpotModuleBuilder`** - Builds HubSpot-compatible module structures
- **`ModulePackagingService`** - Packages modules for distribution

#### **7. Analytics & Review Layer**
- **`ExpertReviewDashboard`** - Provides expert review interface and analytics
- **`ComprehensiveTestSuite`** - Comprehensive testing framework
- **`PreviewService`** - Generates module previews

## 🌐 API Endpoints

### Core API Routes (`/api`)
- **Module Generation**: `POST /api/generate` - Generate HubSpot modules from designs
- **Field Detection**: `POST /api/parse` - Parse and detect fields from input
- **Module Export**: `POST /api/export` - Export generated modules
- **Preview**: `POST /api/preview` - Generate module previews

### Layout Processing (`/api/layout`)
- **Split Layout**: `POST /api/layout/split` - Split complex layouts into sections
- **Process Sections**: `POST /api/layout/process` - Process layout sections sequentially
- **Merge Sections**: `POST /api/layout/merge` - Merge processed sections

### Validation System (`/api/validation`)
- **Validate Module**: `POST /api/validation/validate` - Validate single module
- **Batch Validation**: `POST /api/validation/validate-batch` - Validate multiple modules
- **Schema Info**: `GET /api/validation/schema` - Get current schema information
- **Validation Status**: `GET /api/validation/status/:id` - Get validation status

### Export System (`/api/export`)
- **Export Module**: `POST /api/export/module` - Export individual module
- **Batch Export**: `POST /api/export/batch` - Export multiple modules
- **Download**: `GET /api/export/download/:id` - Download exported modules

## 🎨 Frontend Architecture

### Component Structure
```
frontend/src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── forms/           # Form components
│   ├── layout/          # Layout components
│   └── modules/         # Module-specific components
├── services/            # Frontend API services
├── app/                 # Next.js app router
└── config/              # Configuration files
```

### Key Frontend Services
- **API Client** - Handles backend communication
- **File Upload** - Manages file uploads and processing
- **Module Preview** - Real-time module preview
- **Export Manager** - Handles module exports and downloads

## 🔧 Shared Components

### TypeScript Types (`/shared/types.ts`)
- **`DetectedField`** - Field detection results
- **`ModuleManifest`** - Module metadata structure
- **`ValidationResult`** - Validation response format
- **`ErrorResponse`** - Standardized error responses

## 📊 Data Flow Diagrams

### 1. **Main Processing Flow**
```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ File Upload │ -> │ Parse & Analyze │ -> │ Section Splitting │
└─────────────┘    └──────────────┘    └─────────────────┘
                                                  │
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Final Export│ <- │ Module Package │ <- │ AI Processing   │
└─────────────┘    └──────────────┘    └─────────────────┘
                                                  │
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Quality Review │ <- │ Validation   │ <- │ Component Assembly │
└─────────────┘    └──────────────┘    └─────────────────┘
```

### 2. **Validation Pipeline**
```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Module Input│ -> │ Schema Check │ -> │ Structure Validation │
└─────────────┘    └──────────────┘    └─────────────────┘
                                                  │
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Final Score │ <- │ Quality Metrics │ <- │ API Testing     │
└─────────────┘    └──────────────┘    └─────────────────┘
```

## 🚀 Key Features

### **1. Intelligent Layout Processing**
- Automatic section detection and splitting
- Context-aware field mapping
- Responsive design optimization

### **2. AI-Powered Generation**
- GPT-4 integration for high-quality output
- Iterative refinement for better results
- Prompt optimization and versioning

### **3. Comprehensive Validation**
- Real-time schema compliance checking
- API-based testing against HubSpot
- Automated error correction

### **4. Quality Assurance**
- Expert review dashboard
- Performance metrics tracking
- Comprehensive test suites

### **5. Component Management**
- Reusable component library
- Version control and updates
- Template customization

## 🔄 Service Interactions

### **Critical Service Dependencies**
1. **OpenAIService** ← Used by all AI processing services
2. **HubSpotAPIService** ← Used by validation, deployment, and testing services
3. **HubSpotValidationService** ← Used by quality assurance pipeline
4. **SchemaUpdateService** ← Keeps all validation services up-to-date

### **Processing Pipeline Services**
```
ParserService -> LayoutSectionSplittingService -> SequentialSectionProcessingService
     ↓                        ↓                              ↓
FieldMapperService -> ComponentAssemblyEngine -> ModulePackagingService
     ↓                        ↓                              ↓
HubSpotValidationService -> APIBasedTestingService -> HubSpotDeploymentService
```

## 📈 Performance & Scalability

### **Optimization Features**
- **Batch Processing** - Handle multiple modules simultaneously
- **Parallel Execution** - Process sections in parallel when possible
- **Caching** - Cache AI responses and validation results
- **Queue Management** - Handle high-volume processing efficiently

### **Monitoring & Analytics**
- Real-time processing metrics
- Quality score tracking
- Performance benchmarking
- Error pattern analysis

## 🛡️ Security & Compliance

### **Security Measures**
- Input validation and sanitization
- Secure API key management
- Rate limiting and throttling
- Error handling without data exposure

### **HubSpot Compliance**
- Automatic schema updates
- API compatibility testing
- Module validation against HubSpot standards
- Deployment verification

## 🔧 Configuration & Environment

### **Environment Variables**
- `OPENAI_API_KEY` - OpenAI API access
- `HUBSPOT_API_KEY` - HubSpot API access
- `NODE_ENV` - Environment configuration
- `LOG_LEVEL` - Logging configuration

### **Deployment Scripts**
- `dev-start.sh` - Development environment setup
- `start-backend.sh` - Backend server startup
- `start-frontend.sh` - Frontend development server
- `start-production.sh` - Production deployment

## 📚 Documentation Structure

### **Available Documentation**
- `README.md` - Project overview and setup
- `PROJECT_OVERVIEW.md` - This comprehensive guide
- `/docs/` - Detailed technical documentation
- Inline code documentation throughout services

This architecture provides a robust, scalable, and maintainable system for converting design layouts into high-quality HubSpot modules with comprehensive validation and quality assurance.
