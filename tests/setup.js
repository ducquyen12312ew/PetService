// tests/setup.js - File setup chung cho tất cả tests
const mongoose = require('mongoose');

// Increase timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Disable mongoose warnings in test environment
  mongoose.set('strictQuery', false);
});

// Global test teardown
afterAll(async () => {
  // Close any remaining connections
  await mongoose.disconnect();
});

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  // Uncomment lines below to disable console output in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};