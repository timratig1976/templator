# Enhanced AI Logging - Complete Examples

## 🤖 **What Gets Logged - Detailed Breakdown**

### **1. Standard AI Generation Log**
```typescript
const aiEntry: AIInteractionEntry = {
  id: "ai_1706789123456_abc123",
  timestamp: "2025-01-31T10:30:00.000Z",
  pipelineId: "pipe_user_upload_789",
  phase: "ai_generation",
  
  // Input tracking
  input: {
    type: "image",
    size: 2048576, // 2MB
    contentHash: "sha256_image_abc123def456",
    metadata: {
      fileName: "landing_page_design.png",
      imageResolution: "1920x1080",
      uploadedBy: "user_123"
    }
  },

  // EXACT PROMPT CONTENT - This is what you requested!
  ai: {
    model: "gpt-4o",
    promptVersion: "v2.1.0",
    
    prompt: {
      systemPrompt: `You are an expert web developer specializing in HubSpot module creation. 
      Analyze the provided design image and generate semantic HTML5 with Tailwind CSS that:
      - Is fully responsive and accessible
      - Uses HubSpot-compatible field syntax
      - Follows modern web standards
      - Includes proper ARIA labels
      - Uses semantic HTML elements`,
      
      userPrompt: `Please analyze this landing page design and create a HubSpot module. 
      Focus on:
      1. Hero section with editable headline and CTA
      2. Feature cards section
      3. Contact form integration
      4. Mobile-first responsive design
      
      Make sure all text content is editable through HubSpot fields.`,
      
      ragContext: `HubSpot Field Types Available:
      - text: {{ module.headline }}
      - rich_text: {{ module.description|safe }}
      - image: {{ module.hero_image.src }}
      - url: {{ module.cta_link.href }}
      - color: {{ module.brand_color }}
      
      Best Practices:
      - Use semantic HTML5 elements
      - Include proper alt attributes
      - Ensure keyboard navigation
      - Test with screen readers`,
      
      imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...", // Truncated for logging
      modifiedByUser: false,
      userModifications: null,
      regenerationReason: null
    },
    
    promptTokens: 1450,
    completionTokens: 2850,
    totalTokens: 4300,
    processingTime: 18500, // 18.5 seconds
    temperature: 0.1,
    maxTokens: 4000
  },

  // User interaction tracking
  userInteraction: {
    isManualRegeneration: false,
    regenerationCount: 0,
    userPromptChanges: null,
    userRating: null // Will be filled when user rates
  },

  // Output with quality assessment
  output: {
    type: "html",
    size: 15420, // 15KB HTML
    contentHash: "sha256_html_def789ghi012",
    content: `<section class="hero bg-gradient-to-r from-blue-600 to-purple-700">
      <div class="container mx-auto px-4 py-16">
        <h1 class="text-4xl font-bold text-white mb-6">
          {{ module.hero_headline }}
        </h1>
        <!-- ... rest of HTML ... -->
      </div>
    </section>`, // Truncated for logging
    
    quality: {
      score: 87, // Automated quality score
      confidence: 0.92,
      issues: [
        "Missing alt attribute on decorative image",
        "Consider adding skip navigation link"
      ],
      improvements: [
        "Add schema.org markup for better SEO",
        "Include focus indicators for better accessibility"
      ],
      
      metrics: {
        htmlValidity: 95,
        hubspotCompatibility: 90,
        accessibility: 82,
        responsiveness: 88,
        codeQuality: 85
      }
    },
    
    userQuality: null // Will be filled when user provides feedback
  },

  // Performance tracking
  performance: {
    responseTime: 18750,
    retryCount: 0,
    errorCount: 0,
    cacheHit: false
  },

  // Cost tracking
  cost: {
    inputCost: 0.0145, // $0.0145 for input tokens
    outputCost: 0.0285, // $0.0285 for output tokens
    totalCost: 0.043   // $0.043 total
  }
};
```

### **2. Manual Regeneration Log**
```typescript
// User clicks "Regenerate" and modifies the prompt
const regenerationEntry: AIInteractionEntry = {
  id: "ai_1706789234567_regen_001",
  timestamp: "2025-01-31T10:35:00.000Z",
  pipelineId: "pipe_user_upload_789",
  phase: "ai_generation",
  
  input: {
    type: "image",
    size: 2048576,
    contentHash: "sha256_image_abc123def456", // Same image
    metadata: {
      fileName: "landing_page_design.png",
      regenerationAttempt: 1,
      previousInteractionId: "ai_1706789123456_abc123"
    }
  },

  ai: {
    model: "gpt-4o",
    promptVersion: "user_modified", // Indicates user modification
    
    prompt: {
      systemPrompt: `You are an expert web developer specializing in HubSpot module creation...`, // Same system prompt
      
      userPrompt: `Please analyze this landing page design and create a HubSpot module. 
      Focus on:
      1. Hero section with editable headline and CTA
      2. Feature cards section - MAKE THESE CARDS MORE INTERACTIVE WITH HOVER EFFECTS
      3. Contact form integration - ADD FORM VALIDATION
      4. Mobile-first responsive design
      5. ADD A TESTIMONIALS SECTION BELOW THE FEATURES
      
      Make sure all text content is editable through HubSpot fields.
      IMPORTANT: Use more modern animations and micro-interactions.`,
      
      ragContext: `...`, // Same RAG context
      imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
      
      // USER MODIFICATION TRACKING - This is what you wanted!
      modifiedByUser: true,
      userModifications: `User added requirements for:
      - Interactive hover effects on feature cards
      - Form validation for contact form  
      - New testimonials section
      - Modern animations and micro-interactions`,
      regenerationReason: "Original output was too basic, needed more interactive elements and testimonials section"
    },
    
    promptTokens: 1680, // More tokens due to additional requirements
    completionTokens: 3200,
    totalTokens: 4880,
    processingTime: 22000, // Longer processing time
    temperature: 0.1,
    maxTokens: 4000
  },

  // USER INTERACTION TRACKING - Key for your requirements!
  userInteraction: {
    isManualRegeneration: true, // This is a manual regeneration
    regenerationCount: 1,       // First regeneration attempt
    userPromptChanges: `Added requirements for interactive hover effects, form validation, testimonials section, and modern animations`,
    userRating: null // Will be filled when user rates this version
  },

  output: {
    type: "html",
    size: 23500, // Larger due to additional features
    contentHash: "sha256_html_new_version_123",
    
    quality: {
      score: 93, // Higher score due to user improvements
      confidence: 0.95,
      issues: ["Consider optimizing animation performance"],
      improvements: ["Add loading states for interactive elements"],
      
      metrics: {
        htmlValidity: 96,
        hubspotCompatibility: 92,
        accessibility: 88,
        responsiveness: 91,
        codeQuality: 90
      }
    }
  },

  performance: {
    responseTime: 22300,
    retryCount: 0,
    errorCount: 0,
    cacheHit: false
  },

  cost: {
    inputCost: 0.0168,
    outputCost: 0.032,
    totalCost: 0.0488 // Higher cost due to more tokens
  }
};
```

### **3. User Rating Log Update**
```typescript
// User rates the regenerated output
await aiLogger.logUserRating({
  interactionId: "ai_1706789234567_regen_001",
  userScore: 9, // User gives 9/10 rating
  userFeedback: "Much better! Love the hover effects and testimonials. The animations are smooth and the form validation works perfectly.",
  acceptedOutput: true,
  requestedChanges: [
    "Maybe add a subtle parallax effect to the hero section",
    "Consider adding social proof badges"
  ],
  ratingCriteria: ["visual_appeal", "functionality", "responsiveness", "hubspot_compatibility"]
});

// This updates the original entry with:
userInteraction: {
  isManualRegeneration: true,
  regenerationCount: 1,
  userPromptChanges: "...",
  userRating: {
    score: 9,
    feedback: "Much better! Love the hover effects and testimonials...",
    ratingTimestamp: "2025-01-31T10:40:00.000Z",
    ratingCriteria: ["visual_appeal", "functionality", "responsiveness", "hubspot_compatibility"]
  }
},

output: {
  // ... existing output data ...
  userQuality: {
    userScore: 9,
    userFeedback: "Much better! Love the hover effects and testimonials...",
    acceptedOutput: true,
    requestedChanges: [
      "Maybe add a subtle parallax effect to the hero section",
      "Consider adding social proof badges"
    ]
  }
}
```

## 📊 **Analytics Generated from This Data**

### **Prompt Performance Analytics**
```typescript
const analytics = await aiLogger.getPromptPerformanceAnalytics('7d');

// Results:
{
  promptVersions: {
    "v2.1.0": {
      count: 15,
      averageQuality: 85.2,
      averageUserRating: 7.3,
      averageCost: 0.041,
      regenerationRate: 0.33 // 33% of v2.1.0 prompts get regenerated
    },
    "user_modified": {
      count: 5,
      averageQuality: 91.8,
      averageUserRating: 8.6,
      averageCost: 0.052,
      regenerationRate: 0.0 // User-modified prompts rarely need regeneration
    }
  },
  
  userModifications: {
    totalModifications: 5,
    commonReasons: {
      "needed_more_interactive_elements": 2,
      "missing_testimonials_section": 2,
      "basic_styling_insufficient": 1
    },
    improvementRate: 0.8 // 80% of user modifications improve quality
  },
  
  ratingAnalysis: {
    totalRatings: 12,
    averageRating: 8.1,
    acceptanceRate: 0.75, // 75% of outputs are accepted
    commonFeedback: [
      "Love the hover effects",
      "Great responsive design", 
      "Perfect HubSpot integration",
      "Animations are smooth"
    ]
  }
}
```

## 🎯 **Key Benefits of This Logging**

### **1. Prompt Optimization**
- **Track which prompts perform best**: v2.1.0 vs user_modified
- **Identify common user modifications**: Need for interactivity, testimonials
- **Measure improvement rates**: 80% of user changes improve quality

### **2. Cost Management**
- **Monitor spending patterns**: User modifications cost 27% more but have higher satisfaction
- **Identify expensive operations**: Regenerations with large images
- **Optimize token usage**: Track prompt efficiency

### **3. Quality Improvement**
- **User satisfaction tracking**: Average rating 8.1/10
- **Acceptance rate monitoring**: 75% acceptance rate
- **Issue pattern detection**: Common problems across generations

### **4. User Behavior Insights**
- **Regeneration patterns**: 33% of standard prompts need regeneration
- **Common modification requests**: Interactivity, testimonials, animations
- **Success indicators**: User-modified prompts have 0% regeneration rate

## 🔄 **Integration Points**

### **Frontend Integration**
```typescript
// When user clicks regenerate
const regenerationId = await aiLogger.logManualRegeneration({
  pipelineId: currentPipelineId,
  originalInteractionId: lastAIInteractionId,
  userPromptChanges: userModifications,
  regenerationReason: regenerationReason,
  systemPrompt: currentSystemPrompt,
  userPrompt: modifiedUserPrompt,
  ragContext: currentRAGContext
});

// When user rates output
await aiLogger.logUserRating({
  interactionId: currentAIInteractionId,
  userScore: userRating,
  userFeedback: userFeedbackText,
  acceptedOutput: userAcceptedOutput,
  requestedChanges: userRequestedChanges,
  ratingCriteria: selectedCriteria
});
```

### **Backend Integration**
```typescript
// In OpenAI service
const aiInteractionId = await aiLogger.logAIInteraction({
  // ... all the detailed prompt and response data
  ai: {
    prompt: {
      systemPrompt: fullSystemPrompt,
      userPrompt: fullUserPrompt,
      ragContext: ragContextData,
      imageData: truncatedImageData,
      modifiedByUser: isUserModified,
      userModifications: userChanges,
      regenerationReason: reason
    }
    // ... rest of AI metrics
  }
});
```

This comprehensive logging captures **every detail** you requested: exact prompts, user modifications, regeneration events, and user ratings with full context for optimization and analysis! 🚀
