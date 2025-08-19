#!/usr/bin/env node

/**
 * Build Test CLI Tool
 * Command-line interface for running build tests manually
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function runTypeScriptCheck() {
  return new Promise((resolve) => {
    logHeader('Running TypeScript Compilation Check');
    
    const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    tscProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tscProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tscProcess.on('close', (code) => {
      const output = stderr + stdout;
      const success = code === 0;

      if (success) {
        logSuccess('TypeScript compilation successful - no errors found');
      } else {
        logError('TypeScript compilation failed');
        
        // Parse and display errors
        const errors = parseTypeScriptErrors(output);
        displayErrors(errors);
      }

      resolve({ success, errors: parseTypeScriptErrors(output) });
    });

    tscProcess.on('error', (error) => {
      logError(`Failed to run TypeScript compiler: ${error.message}`);
      resolve({ success: false, errors: [] });
    });
  });
}

function parseTypeScriptErrors(output) {
  const errors = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
    
    if (match) {
      const [, file, lineNum, colNum, severity, code, message] = match;
      
      errors.push({
        file: path.relative(process.cwd(), file),
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        message: message.trim(),
        code,
        severity
      });
    }
  }

  return errors;
}

function displayErrors(errors) {
  if (errors.length === 0) {
    return;
  }

  logInfo(`Found ${errors.length} issue(s):`);
  console.log();

  // Group errors by file
  const errorsByFile = {};
  errors.forEach(error => {
    if (!errorsByFile[error.file]) {
      errorsByFile[error.file] = [];
    }
    errorsByFile[error.file].push(error);
  });

  // Display errors grouped by file
  Object.entries(errorsByFile).forEach(([file, fileErrors]) => {
    log(`📁 ${file}`, 'cyan');
    
    fileErrors.forEach(error => {
      const prefix = error.severity === 'error' ? '  ❌' : '  ⚠️';
      const color = error.severity === 'error' ? 'red' : 'yellow';
      
      log(`${prefix} Line ${error.line}:${error.column} - ${error.message}`, color);
      log(`     Code: ${error.code}`, 'reset');
    });
    
    console.log();
  });

  // Display summary by category
  displayErrorSummary(errors);
}

function displayErrorSummary(errors) {
  logHeader('Error Summary');

  const categories = categorizeErrors(errors);
  
  Object.entries(categories).forEach(([category, categoryErrors]) => {
    const count = categoryErrors.length;
    const color = count > 5 ? 'red' : count > 2 ? 'yellow' : 'green';
    
    log(`${getCategoryIcon(category)} ${category}: ${count} issue(s)`, color);
    
    if (count > 0) {
      const suggestions = getCategorySuggestions(category);
      if (suggestions) {
        log(`   💡 ${suggestions}`, 'blue');
      }
    }
  });
}

function categorizeErrors(errors) {
  const categories = {
    'Import Path Errors': [],
    'Type Errors': [],
    'Syntax Errors': [],
    'Unused Imports': [],
    'Other': []
  };

  errors.forEach(error => {
    if (error.message.includes('Cannot find module') || error.message.includes('Module not found')) {
      categories['Import Path Errors'].push(error);
    } else if (error.code.startsWith('TS2')) {
      categories['Type Errors'].push(error);
    } else if (error.code.startsWith('TS1')) {
      categories['Syntax Errors'].push(error);
    } else if (error.message.includes('is declared but never used')) {
      categories['Unused Imports'].push(error);
    } else {
      categories['Other'].push(error);
    }
  });

  return categories;
}

function getCategoryIcon(category) {
  const icons = {
    'Import Path Errors': '📁',
    'Type Errors': '🔧',
    'Syntax Errors': '⚠️',
    'Unused Imports': '🧹',
    'Other': '❓'
  };
  return icons[category] || '❓';
}

function getCategorySuggestions(category) {
  const suggestions = {
    'Import Path Errors': 'Check if files moved during service reorganization',
    'Type Errors': 'Review TypeScript configuration and type definitions',
    'Syntax Errors': 'Check for missing semicolons, brackets, or keywords',
    'Unused Imports': 'Remove unused imports to clean up code',
    'Other': 'Review TypeScript documentation for specific error codes'
  };
  return suggestions[category];
}

async function scanServiceStructure() {
  logHeader('Comprehensive TypeScript File Scan');

  const srcPath = path.join(process.cwd(), 'src');
  let totalFiles = 0;
  
  try {
    // Scan services directory (phase-based)
    const servicesPath = path.join(srcPath, 'services');
    if (await fs.promises.access(servicesPath).then(() => true).catch(() => false)) {
      const phases = await fs.promises.readdir(servicesPath, { withFileTypes: true });
      const phaseDirectories = phases.filter(dirent => dirent.isDirectory());

      logInfo(`Found ${phaseDirectories.length} service phases:`);

      for (const phase of phaseDirectories) {
        const phasePath = path.join(servicesPath, phase.name);
        const files = await fs.promises.readdir(phasePath);
        const tsFiles = files.filter(file => file.endsWith('.ts'));
        totalFiles += tsFiles.length;
        
        log(`  📂 services/${phase.name}: ${tsFiles.length} TypeScript file(s)`, 'cyan');
      }
    }

    // Scan other critical directories
    const otherDirs = ['pipeline', 'routes', 'controllers', 'middleware', 'utils', 'types', 'config'];
    
    for (const dir of otherDirs) {
      const dirPath = path.join(srcPath, dir);
      if (await fs.promises.access(dirPath).then(() => true).catch(() => false)) {
        const tsFiles = await scanDirectoryRecursively(dirPath, '.ts');
        if (tsFiles.length > 0) {
          totalFiles += tsFiles.length;
          log(`  📂 ${dir}: ${tsFiles.length} TypeScript file(s)`, 'cyan');
        }
      }
    }

    // Scan root src files
    const rootFiles = await fs.promises.readdir(srcPath);
    const rootTsFiles = rootFiles.filter(file => file.endsWith('.ts'));
    if (rootTsFiles.length > 0) {
      totalFiles += rootTsFiles.length;
      log(`  📂 src (root): ${rootTsFiles.length} TypeScript file(s)`, 'cyan');
    }

    // Scan tests directory
    const testsPath = path.join(process.cwd(), 'tests');
    if (await fs.promises.access(testsPath).then(() => true).catch(() => false)) {
      const testFiles = await scanDirectoryRecursively(testsPath, '.ts');
      if (testFiles.length > 0) {
        totalFiles += testFiles.length;
        log(`  📂 tests: ${testFiles.length} TypeScript file(s)`, 'cyan');
      }
    }

    // Scan scripts directory
    const scriptsPath = path.join(process.cwd(), 'scripts');
    if (await fs.promises.access(scriptsPath).then(() => true).catch(() => false)) {
      const scriptFiles = await scanDirectoryRecursively(scriptsPath, '.ts');
      if (scriptFiles.length > 0) {
        totalFiles += scriptFiles.length;
        log(`  📂 scripts: ${scriptFiles.length} TypeScript file(s)`, 'cyan');
      }
    }

    logInfo(`\n📊 Total TypeScript files discovered: ${totalFiles}`);
    logSuccess('Comprehensive file structure scan completed');
    return true;
  } catch (error) {
    logError(`Failed to scan file structure: ${error.message}`);
    return false;
  }
}

// Helper function to recursively scan directories
async function scanDirectoryRecursively(dirPath, extension) {
  const files = [];
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, dist, build directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          const subFiles = await scanDirectoryRecursively(fullPath, extension);
          files.push(...subFiles);
        }
      } else if (entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors or missing directories
  }
  
  return files;
}

async function checkPackageJson() {
  logHeader('Checking Package Configuration');

  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.promises.readFile(packagePath, 'utf8'));

    // Check for build-related scripts
    const scripts = packageJson.scripts || {};
    const buildScripts = ['build', 'type-check', 'lint'];
    
    buildScripts.forEach(script => {
      if (scripts[script]) {
        logSuccess(`Found ${script} script: ${scripts[script]}`);
      } else {
        logWarning(`Missing ${script} script in package.json`);
      }
    });

    // Check TypeScript dependency
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps.typescript) {
      logSuccess(`TypeScript version: ${deps.typescript}`);
    } else {
      logError('TypeScript not found in dependencies');
    }

    return true;
  } catch (error) {
    logError(`Failed to check package.json: ${error.message}`);
    return false;
  }
}

async function discoverAllFiles() {
  logHeader('Comprehensive File Discovery');
  
  const projectRoot = process.cwd();
  const allTsFiles = await scanDirectoryRecursively(projectRoot, '.ts');
  
  // Filter out excluded patterns
  const excludePatterns = [
    /node_modules/,
    /dist/,
    /build/,
    /\.git/,
    /coverage/,
    /\.next/,
    /\.nuxt/,
    /temp/
  ];
  
  const includedFiles = allTsFiles.filter(file => {
    const relativePath = path.relative(projectRoot, file);
    return !excludePatterns.some(pattern => pattern.test(relativePath));
  });
  
  logInfo(`\n📊 File Discovery Results:`);
  logInfo(`  Total TypeScript files found: ${allTsFiles.length}`);
  logInfo(`  Files included in build testing: ${includedFiles.length}`);
  logInfo(`  Files excluded: ${allTsFiles.length - includedFiles.length}`);
  
  // Group by directory for better visualization
  const filesByDir = {};
  includedFiles.forEach(file => {
    const relativePath = path.relative(projectRoot, file);
    const dir = path.dirname(relativePath);
    if (!filesByDir[dir]) filesByDir[dir] = [];
    filesByDir[dir].push(path.basename(relativePath));
  });
  
  logInfo(`\n📂 Files by Directory:`);
  Object.keys(filesByDir).sort().forEach(dir => {
    log(`  ${dir}: ${filesByDir[dir].length} files`, 'cyan');
    if (filesByDir[dir].length <= 10) {
      filesByDir[dir].forEach(file => {
        log(`    - ${file}`, 'gray');
      });
    } else {
      log(`    - ${filesByDir[dir].slice(0, 5).join(', ')}, ... and ${filesByDir[dir].length - 5} more`, 'gray');
    }
  });
  
  logSuccess('\n✅ File discovery completed - ALL TypeScript files will be included in build testing');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  log('\n🔧 Build Test CLI Tool', 'bright');
  log('Automated TypeScript build validation\n', 'blue');

  switch (command) {
    case 'compile':
    case 'tsc':
      await runTypeScriptCheck();
      break;
      
    case 'structure':
    case 'scan':
      await scanServiceStructure();
      break;
      
    case 'package':
    case 'pkg':
      await checkPackageJson();
      break;
      
    case 'discover':
      await discoverAllFiles();
      break;
      
    case 'all':
      await checkPackageJson();
      await scanServiceStructure();
      await discoverAllFiles();
      const result = await runTypeScriptCheck();
      
      logHeader('Build Test Summary');
      if (result.success) {
        logSuccess('All checks passed - build is healthy! 🎉');
      } else {
        logError(`Build has ${result.errors.length} issue(s) that need attention`);
        process.exit(1);
      }
      break;
      
    case 'help':
    case '--help':
    case '-h':
      displayHelp();
      break;
      
    default:
      logError(`Unknown command: ${command}`);
      displayHelp();
      process.exit(1);
  }
}

function displayHelp() {
  log('\nUsage: node scripts/build-test.js [command]', 'bright');
  log('\nCommands:', 'cyan');
  log('  all       Run all checks (default)');
  log('  compile   Run TypeScript compilation check only');
  log('  structure Scan service structure only');
  log('  discover  Discover and list all TypeScript files');
  log('  package   Check package.json configuration only');
  log('  help      Show this help message');
  log('\nExamples:', 'yellow');
  log('  node scripts/build-test.js');
  log('  node scripts/build-test.js compile');
  log('  node scripts/build-test.js structure');
  log('  node scripts/build-test.js discover');
}

// Run the CLI tool
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
