// Ensure backend test env variables are loaded before any test code runs
const path = require('path');
const dotenv = require('dotenv');

// Resolve to backend/.env.test regardless of where Jest is invoked
const envPath = path.join(__dirname, '../../../backend/.env.test');
dotenv.config({ path: envPath });

// Provide safe defaults if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'dummy-test-key';
