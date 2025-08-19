#!/usr/bin/env node

/**
 * Fix Import Paths Script
 * Systematically fixes import paths after phase-based service reorganization
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define the import path mappings
const importMappings = [
  // Utils and middleware (go up two levels from services)
  { from: "import { createLogger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger'" },
  { from: "import { logger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger';\n\nconst logger = createLogger();" },
  { from: "import { createError } from '../middleware/errorHandler'", to: "import { createError } from '../../middleware/errorHandler'" },
  { from: "import { logToFrontend } from '../routes/logs'", to: "import { logToFrontend } from '../../routes/logs'" },
  
  // Cross-service imports (between different phases)
  { from: "import OpenAIService from './openaiService'", to: "import OpenAIService from '../ai/openaiService'" },
  { from: "import openaiService from './openaiService'", to: "import openaiService from '../ai/openaiService'" },
  { from: "import { HubSpotValidationService", to: "import { HubSpotValidationService" },
  { from: "} from './HubSpotValidationService'", to: "} from '../quality/HubSpotValidationService'" },
  { from: "import { HubSpotAPIService } from './HubSpotAPIService'", to: "import { HubSpotAPIService } from '../deployment/HubSpotAPIService'" },
  { from: "import { ModuleFiles } from './ModulePackagingService'", to: "import { ModuleFiles } from '../module/ModulePackagingService'" },
  { from: "import { GeneratedModule } from './HubSpotPromptService'", to: "import { GeneratedModule } from '../deployment/HubSpotPromptService'" },
];

// Additional specific mappings for complex cases
const specificMappings = {
  // AI services
  'services/ai/PromptOptimizationService.ts': [
    { from: "import { createLogger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger'" },
    { from: "import { logToFrontend } from '../routes/logs'", to: "import { logToFrontend } from '../../routes/logs'" },
    { from: "import { createError } from '../middleware/errorHandler'", to: "import { createError } from '../../middleware/errorHandler'" },
  ],
  
  // Analysis services
  'services/analysis/IterativeRefinementService.ts': [
    { from: "import { createLogger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger'" },
    { from: "import OpenAIService from './openaiService'", to: "import OpenAIService from '../ai/openaiService'" },
  ],
  
  // Module services
  'services/module/HubSpotModuleBuilder.ts': [
    { from: "import { createLogger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger'" },
    { from: "import { logToFrontend } from '../routes/logs'", to: "import { logToFrontend } from '../../routes/logs'" },
  ],
  
  // Input services
  'services/input/ImageHandlingService.ts': [
    { from: "import { createLogger } from '../utils/logger'", to: "import { createLogger } from '../../utils/logger'" },
    { from: "import openaiService from './openaiService'", to: "import openaiService from '../ai/openaiService'" },
  ],
};

function fixImportPaths() {
  console.log('🔧 Starting import path fixes...\n');
  
  // Find all TypeScript files in services directory
  const servicesDir = path.join(__dirname, '../src/services');
  const tsFiles = glob.sync('**/*.ts', { cwd: servicesDir });
  
  let totalFiles = 0;
  let totalReplacements = 0;
  
  tsFiles.forEach(file => {
    const filePath = path.join(servicesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacements = 0;
    let modified = false;
    
    // Apply specific mappings first
    if (specificMappings[file]) {
      specificMappings[file].forEach(mapping => {
        if (content.includes(mapping.from)) {
          content = content.replace(new RegExp(escapeRegExp(mapping.from), 'g'), mapping.to);
          fileReplacements++;
          modified = true;
        }
      });
    }
    
    // Apply general mappings
    importMappings.forEach(mapping => {
      if (content.includes(mapping.from)) {
        content = content.replace(new RegExp(escapeRegExp(mapping.from), 'g'), mapping.to);
        fileReplacements++;
        modified = true;
      }
    });
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${fileReplacements} imports in ${file}`);
      totalFiles++;
      totalReplacements += fileReplacements;
    }
  });
  
  console.log(`\n🎉 Import path fixes completed!`);
  console.log(`📊 Files modified: ${totalFiles}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Run the script
if (require.main === module) {
  try {
    fixImportPaths();
  } catch (error) {
    console.error('❌ Error fixing import paths:', error);
    process.exit(1);
  }
}

module.exports = { fixImportPaths };
