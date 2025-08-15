// Test script to check available Prisma models
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('Available Prisma models:');
console.log(Object.keys(prisma).filter(key => 
  !key.startsWith('_') && 
  !key.startsWith('$') && 
  typeof prisma[key] === 'object' &&
  prisma[key].findMany
).sort());

// Test specific AI model names
const testModels = [
  'aiProcess',
  'aIProcess', 
  'AIProcess',
  'aiPrompt',
  'aIPrompt',
  'AIPrompt',
  'aiPromptTestResult',
  'aIPromptTestResult',
  'AIPromptTestResult'
];

console.log('\nTesting AI model names:');
testModels.forEach(modelName => {
  const exists = prisma[modelName] && typeof prisma[modelName].findMany === 'function';
  console.log(`${modelName}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
});

prisma.$disconnect();
