// Test setup file
// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/finwise_test";

// Increase timeout for integration tests
if (typeof jest !== "undefined") {
  jest.setTimeout(30000);
}
