// Quick test script for AI splitting endpoint
const fs = require('fs');
const path = require('path');

// Create a simple base64 test image (1x1 pixel PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA4nEKtAAAAABJRU5ErkJggg==';

const testPayload = {
  image: testImageBase64,
  fileName: 'test-design.png',
  requestId: 'test-' + Date.now(),
  analysisType: 'lightweight'
};

console.log('Testing AI splitting endpoint...');
console.log('Payload:', JSON.stringify(testPayload, null, 2));

// Test the endpoint
fetch('http://localhost:3009/api/ai-enhancement/detect-sections', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload)
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response data:', JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error:', error);
});
