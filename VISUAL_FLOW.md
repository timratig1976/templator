# Templator Project - Visual Flow Diagrams

## 🎯 Main Process Flow

```mermaid
flowchart TD
    A[User Upload] --> B{Input Type}
    B -->|HTML| C[Parse HTML]
    B -->|Image| D[Image Analysis]
    B -->|JSON| E[Parse JSON]
    
    C --> F[Layout Analysis]
    D --> F
    E --> F
    
    F --> G[Section Detection]
    G --> H{Complex Layout?}
    
    H -->|Yes| I[Layout Splitting Service]
    H -->|No| J[Direct Processing]
    
    I --> K[Sequential Section Processing]
    J --> K
    
    K --> L[AI Generation with GPT-4]
    L --> M[Component Assembly]
    M --> N[Validation Pipeline]
    
    N --> O{Validation Pass?}
    O -->|No| P[Auto Error Correction]
    P --> Q[Iterative Refinement]
    Q --> N
    
    O -->|Yes| R[Module Packaging]
    R --> S[Quality Review]
    S --> T[Export/Deploy]
    
    style A fill:#e1f5fe
    style T fill:#e8f5e8
    style N fill:#fff3e0
    style L fill:#f3e5f5
```

## 🏗️ System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI Components]
        API_CLIENT[API Client Service]
        UPLOAD[File Upload Manager]
        PREVIEW[Preview Component]
    end
    
    subgraph "API Gateway"
        ROUTES[Express Routes]
        AUTH[Authentication]
        RATE[Rate Limiting]
    end
    
    subgraph "Core Processing Services"
        PARSER[Parser Service]
        LAYOUT[Layout Splitting Service]
        SEQUENTIAL[Sequential Processing]
        OPENAI[OpenAI Service]
    end
    
    subgraph "Quality Assurance"
        VALIDATION[HubSpot Validation]
        SCHEMA[Schema Update Service]
        API_TEST[API Testing Service]
        DIFF[Schema Diff Detector]
    end
    
    subgraph "Enhancement Layer"
        REFINEMENT[Iterative Refinement]
        ERROR_CORRECTION[Auto Error Correction]
        ASSEMBLY[Component Assembly]
        CUSTOMIZATION[Template Customization]
    end
    
    subgraph "Repository Layer"
        COMPONENTS[Component Repository]
        TEMPLATES[Template Library]
        VERSIONING[Module Versioning]
    end
    
    subgraph "Deployment Layer"
        PACKAGING[Module Packaging]
        HUBSPOT_API[HubSpot API Service]
        DEPLOYMENT[Deployment Service]
    end
    
    subgraph "External Services"
        OPENAI_API[OpenAI API]
        HUBSPOT_EXT[HubSpot Platform]
    end
    
    UI --> API_CLIENT
    API_CLIENT --> ROUTES
    ROUTES --> PARSER
    PARSER --> LAYOUT
    LAYOUT --> SEQUENTIAL
    SEQUENTIAL --> OPENAI
    OPENAI --> OPENAI_API
    
    SEQUENTIAL --> VALIDATION
    VALIDATION --> SCHEMA
    SCHEMA --> DIFF
    
    VALIDATION --> REFINEMENT
    REFINEMENT --> ERROR_CORRECTION
    ERROR_CORRECTION --> ASSEMBLY
    
    ASSEMBLY --> COMPONENTS
    ASSEMBLY --> TEMPLATES
    
    ASSEMBLY --> PACKAGING
    PACKAGING --> HUBSPOT_API
    HUBSPOT_API --> HUBSPOT_EXT
    
    style UI fill:#e3f2fd
    style OPENAI fill:#f3e5f5
    style VALIDATION fill:#fff3e0
    style HUBSPOT_EXT fill:#e8f5e8
```

## 🔄 Detailed Processing Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Parser
    participant LayoutSplitter
    participant AI
    participant Validator
    participant Packager
    participant HubSpot
    
    User->>Frontend: Upload Design File
    Frontend->>API: POST /api/parse
    API->>Parser: Analyze Input
    Parser->>Parser: Normalize Format
    Parser-->>API: Parsed Data
    
    API->>LayoutSplitter: Split Complex Layout
    LayoutSplitter->>LayoutSplitter: Detect Sections
    LayoutSplitter->>LayoutSplitter: Analyze Complexity
    LayoutSplitter-->>API: Section Data
    
    loop For Each Section
        API->>AI: Generate Module
        AI->>AI: Process with GPT-4
        AI-->>API: Generated Module
        
        API->>Validator: Validate Module
        Validator->>Validator: Check Schema
        Validator->>Validator: Run Tests
        
        alt Validation Failed
            Validator-->>API: Errors Found
            API->>AI: Refine Module
        else Validation Passed
            Validator-->>API: Valid Module
        end
    end
    
    API->>Packager: Package Modules
    Packager->>Packager: Combine Sections
    Packager->>Packager: Create ZIP
    Packager-->>API: Package Ready
    
    API->>HubSpot: Deploy (Optional)
    HubSpot-->>API: Deployment Status
    
    API-->>Frontend: Final Result
    Frontend-->>User: Download/Preview
```

## 🧩 Service Interaction Map

```mermaid
graph LR
    subgraph "Input Processing"
        A[Parser Service] --> B[Field Mapper]
        B --> C[Layout Splitter]
    end
    
    subgraph "AI Processing"
        C --> D[Sequential Processor]
        D --> E[OpenAI Service]
        E --> F[Prompt Service]
        F --> G[Component Assembly]
    end
    
    subgraph "Quality Control"
        G --> H[HubSpot Validator]
        H --> I[Schema Updater]
        I --> J[API Tester]
        J --> K[Error Corrector]
        K --> L[Refinement Service]
    end
    
    subgraph "Output Generation"
        L --> M[Module Builder]
        M --> N[Packager]
        N --> O[Deployment Service]
    end
    
    subgraph "Support Services"
        P[Component Repo] -.-> G
        Q[Template Library] -.-> D
        R[Version Manager] -.-> N
        S[Expert Dashboard] -.-> H
    end
    
    style A fill:#e1f5fe
    style E fill:#f3e5f5
    style H fill:#fff3e0
    style O fill:#e8f5e8
```

## 📊 Data Flow Architecture

```mermaid
flowchart TD
    subgraph "Data Input"
        A[HTML Files]
        B[Design Images]
        C[JSON Components]
    end
    
    subgraph "Processing Pipeline"
        D[Normalized Data]
        E[Section Data]
        F[AI Generated Modules]
        G[Validated Modules]
        H[Packaged Modules]
    end
    
    subgraph "Quality Gates"
        I{Schema Valid?}
        J{API Test Pass?}
        K{Quality Score > 80?}
    end
    
    subgraph "Output Formats"
        L[HubSpot Module ZIP]
        M[Preview HTML]
        N[Module Manifest]
        O[Deployment Package]
    end
    
    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> F
    F --> I
    
    I -->|Yes| J
    I -->|No| P[Error Correction]
    P --> F
    
    J -->|Yes| K
    J -->|No| Q[Refinement]
    Q --> F
    
    K -->|Yes| G
    K -->|No| R[Enhancement]
    R --> F
    
    G --> H
    H --> L
    H --> M
    H --> N
    H --> O
    
    style I fill:#ffeb3b
    style J fill:#ffeb3b
    style K fill:#ffeb3b
```

## 🔧 Validation Pipeline

```mermaid
flowchart TD
    A[Module Input] --> B[Schema Validation]
    B --> C{Schema Compatible?}
    
    C -->|No| D[Schema Update Check]
    D --> E[Apply Schema Updates]
    E --> B
    
    C -->|Yes| F[Structure Validation]
    F --> G[Field Validation]
    G --> H[Template Validation]
    
    H --> I[API Testing]
    I --> J{API Tests Pass?}
    
    J -->|No| K[Error Analysis]
    K --> L[Auto Correction]
    L --> M{Correctable?}
    
    M -->|Yes| N[Apply Fixes]
    N --> F
    
    M -->|No| O[Manual Review Required]
    
    J -->|Yes| P[Performance Testing]
    P --> Q[Accessibility Check]
    Q --> R[Quality Scoring]
    
    R --> S{Score > Threshold?}
    S -->|No| T[Refinement Suggestions]
    S -->|Yes| U[Validation Complete]
    
    style C fill:#ffeb3b
    style J fill:#ffeb3b
    style S fill:#ffeb3b
    style U fill:#4caf50
    style O fill:#f44336
```

## 🚀 Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant System as Templator System
    participant Validator as Validation Service
    participant HubSpot as HubSpot API
    participant Monitor as Monitoring
    
    Dev->>System: Upload Module
    System->>Validator: Pre-deployment Check
    
    alt Validation Fails
        Validator-->>System: Validation Errors
        System-->>Dev: Fix Required
    else Validation Passes
        Validator-->>System: Approved for Deployment
        
        System->>HubSpot: Deploy Module
        HubSpot-->>System: Deployment Status
        
        System->>Monitor: Log Deployment
        Monitor->>HubSpot: Health Check
        
        alt Deployment Success
            HubSpot-->>Monitor: Module Active
            Monitor-->>System: Success Confirmed
            System-->>Dev: Deployment Complete
        else Deployment Failed
            HubSpot-->>Monitor: Error Detected
            Monitor-->>System: Rollback Required
            System->>HubSpot: Rollback Module
            System-->>Dev: Deployment Failed
        end
    end
```

## 🎛️ Component Interaction Matrix

```mermaid
graph TD
    subgraph "Frontend Components"
        UI[UI Components]
        FORMS[Form Components]
        LAYOUT[Layout Components]
    end
    
    subgraph "API Layer"
        REST[REST Endpoints]
        WS[WebSocket Events]
        SSE[Server-Sent Events]
    end
    
    subgraph "Business Logic"
        CORE[Core Services]
        AI[AI Services]
        VALID[Validation Services]
    end
    
    subgraph "Data Layer"
        CACHE[Redis Cache]
        FILES[File Storage]
        LOGS[Logging System]
    end
    
    subgraph "External APIs"
        OPENAI_EXT[OpenAI API]
        HUBSPOT_EXT[HubSpot API]
    end
    
    UI --> REST
    FORMS --> REST
    LAYOUT --> WS
    
    REST --> CORE
    WS --> SSE
    SSE --> LOGS
    
    CORE --> AI
    CORE --> VALID
    
    AI --> OPENAI_EXT
    VALID --> HUBSPOT_EXT
    
    CORE --> CACHE
    CORE --> FILES
    
    style UI fill:#e3f2fd
    style AI fill:#f3e5f5
    style VALID fill:#fff3e0
    style OPENAI_EXT fill:#ffebee
    style HUBSPOT_EXT fill:#e8f5e8
```

## 📈 Performance Monitoring Flow

```mermaid
flowchart LR
    A[Request Start] --> B[Processing Time]
    B --> C[AI Response Time]
    C --> D[Validation Time]
    D --> E[Package Time]
    E --> F[Total Duration]
    
    B --> G[Memory Usage]
    C --> H[API Calls Count]
    D --> I[Error Rate]
    E --> J[Success Rate]
    
    F --> K[Performance Dashboard]
    G --> K
    H --> K
    I --> K
    J --> K
    
    K --> L{Performance Issues?}
    L -->|Yes| M[Alert System]
    L -->|No| N[Continue Monitoring]
    
    M --> O[Auto Scaling]
    M --> P[Error Investigation]
    
    style K fill:#e1f5fe
    style L fill:#ffeb3b
    style M fill:#ffcdd2
```

These visual flow diagrams provide a comprehensive view of the Templator system's architecture, data flow, and process interactions. Each diagram focuses on different aspects of the system to help understand the complete workflow from user input to final module deployment.
