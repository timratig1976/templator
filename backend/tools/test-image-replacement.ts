/**
 * Manual test script for ImageHandlingService image replacement functionality
 * 
 * This script directly tests the replaceExternalPlaceholderURLs method of the ImageHandlingService
 * to verify that all problematic image references are properly replaced with SVG data URI placeholders.
 * 
 * Run with: npx ts-node scripts/test-image-replacement.ts
 */

import ImageHandlingService from '../src/services/input/ImageHandlingService';

// Initialize the service
const imageService = ImageHandlingService.getInstance();

// Test helper function - access the private method using type assertion
const replaceUrls = (html: string): string => {
  return (imageService as any).replaceExternalPlaceholderURLs(html);
};

// Test cases
const testCases = [
  {
    name: 'Existing data URI placeholder',
    input: '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxZjI5MzciLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuMzVlbSIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiI+TE9HTzwvdGV4dD48L3N2Zz4=" alt="Logo">',
    expectedResult: 'should be preserved unchanged'
  },
  {
    name: 'Simple file reference',
    input: '<img src="logo.png" alt="Logo">',
    expectedResult: 'should be replaced with data URI'
  },
  {
    name: 'Path-based file reference',
    input: '<img src="/path/to/images/hero.jpg" alt="Hero">',
    expectedResult: 'should be replaced with data URI'
  },
  {
    name: 'Template variable',
    input: '<img src="{{ logo_url }}" alt="Logo">',
    expectedResult: 'should be replaced with data URI'
  },
  {
    name: 'Localhost URL',
    input: '<img src="http://localhost:3000/images/icon.svg" alt="Icon">',
    expectedResult: 'should be replaced with data URI'
  },
  {
    name: 'Logo context',
    input: '<img src="company_logo.png" alt="Company Logo" class="logo">',
    expectedResult: 'should be replaced with logo-specific data URI'
  },
  {
    name: 'Hero context',
    input: '<img src="hero-banner.jpg" alt="Hero Banner" class="hero">',
    expectedResult: 'should be replaced with hero-specific data URI'
  },
  {
    name: 'Multiple images in complex HTML',
    input: `
      <div class="container">
        <header>
          <img src="logo.png" alt="Logo" class="h-10">
        </header>
        <main>
          <div class="hero">
            <img src="/images/hero.jpg" alt="Hero" class="w-full">
          </div>
          <div class="features">
            <img src="{{ feature_1_img }}" alt="Feature 1">
            <img src="{{ feature_2_img }}" alt="Feature 2">
          </div>
        </main>
        <footer>
          <img src="http://localhost:3000/icon.svg" alt="Icon" class="icon">
        </footer>
      </div>
    `,
    expectedResult: 'should replace all 5 image references with data URIs'
  },
  {
    name: 'Problematic HTML with script tags',
    input: `
      <div class="product">
        <h2>Product Gallery</h2>
        <img src="product1.jpg" class="product-img">
        <script>
          const logoUrl = "/images/logo.png";
          document.write('<img src="' + logoUrl + '">');
        </script>
        <style>
          .bg { background: url('/images/bg.jpg'); }
        </style>
      </div>
    `,
    expectedResult: 'should replace <img> tag but preserve script and style content'
  }
];

// Run tests
console.log('🧪 TESTING IMAGE REPLACEMENT FUNCTIONALITY\n');

let passCount = 0;
let failCount = 0;

for (const test of testCases) {
  process.stdout.write(`Testing: ${test.name}... `);
  
  try {
    const originalHtml = test.input;
    const processedHtml = replaceUrls(originalHtml);
    
    // Basic validation
    let passed = false;
    
    if (test.name === 'Existing data URI placeholder') {
      passed = processedHtml === originalHtml;
    } else {
      passed = !processedHtml.includes('.jpg') && 
               !processedHtml.includes('.png') && 
               !processedHtml.includes('.svg') &&
               !processedHtml.includes('{{ ') &&
               processedHtml.includes('data:image/svg+xml;base64,');
    }
    
    if (passed) {
      console.log('✅ PASSED');
      passCount++;
    } else {
      console.log('❌ FAILED');
      console.log('  Original: ', originalHtml.substring(0, 50) + '...');
      console.log('  Result:   ', processedHtml.substring(0, 50) + '...');
      failCount++;
    }
    
    // Output first 100 chars of result for inspection
    console.log(`  ${test.expectedResult}`);
    console.log('  Result preview: ' + processedHtml.substring(0, 100).replace(/\n/g, '') + '...\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    failCount++;
  }
}

console.log(`\n🧮 TEST SUMMARY: ${passCount} passed, ${failCount} failed\n`);

// Test a real-world HTML section with mixed image references
console.log('🔍 TESTING REAL-WORLD HTML SECTION\n');

const realWorldHtml = `
<section class="bg-white py-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center">
      <h2 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        Our Featured Products
      </h2>
      <img src="/images/underline.png" alt="Decorative underline" class="mx-auto h-4 mt-2">
      <p class="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
        Check out our most popular items that customers love
      </p>
    </div>
    <div class="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      <div class="group relative rounded-lg overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300">
        <img src="{{ product_image_1 }}" alt="Product 1" class="w-full h-64 object-cover">
        <div class="p-6">
          <h3 class="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            {{ product_name_1 }}
          </h3>
          <p class="mt-2 text-gray-600">{{ product_description_1 }}</p>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-lg font-bold text-gray-900">{{ product_price_1 }}</span>
            <button class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
      <div class="group relative rounded-lg overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300">
        <img src="product2.jpg" alt="Product 2" class="w-full h-64 object-cover">
        <div class="p-6">
          <h3 class="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            Premium Headphones
          </h3>
          <p class="mt-2 text-gray-600">Immersive sound quality with noise cancellation.</p>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-lg font-bold text-gray-900">$249.99</span>
            <button class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
      <div class="group relative rounded-lg overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300">
        <img src="http://localhost:3000/products/watch.jpg" alt="Product 3" class="w-full h-64 object-cover">
        <div class="p-6">
          <h3 class="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            Smart Watch
          </h3>
          <p class="mt-2 text-gray-600">Track fitness, messages and more on your wrist.</p>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-lg font-bold text-gray-900">$199.99</span>
            <button class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-12 text-center">
      <a href="#" class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
        <img src="icon-catalog.svg" alt="" class="w-5 h-5 mr-2">
        View Full Catalog
      </a>
    </div>
  </div>
</section>
`;

console.log('Original HTML has these image references:');
const originalImageRefs = realWorldHtml.match(/src="[^"]+"/g);
originalImageRefs?.forEach(ref => console.log(`  ${ref}`));

const processedRealWorldHtml = replaceUrls(realWorldHtml);

console.log('\nAfter processing, replaced with data URIs:');
const processedImageRefs = processedRealWorldHtml.match(/src="[^"]+"/g);
processedImageRefs?.forEach(ref => {
  const isDataUri = ref.includes('data:image/svg+xml;base64,');
  console.log(`  ${isDataUri ? '✅' : '❌'} ${ref.substring(0, 50)}...`);
});

const allReplaced = processedImageRefs?.every(ref => ref.includes('data:image/svg+xml;base64,'));
console.log(`\nRESULT: ${allReplaced ? '✅ All images successfully replaced' : '❌ Some images were not replaced'}`);

console.log(`\n🎯 FINAL RESULT: ${allReplaced && failCount === 0 ? '✅ All tests PASSED' : '❌ Some tests FAILED'}`);
