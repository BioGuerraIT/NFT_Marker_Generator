# Testing Documentation

This document describes the testing setup for the NFT Marker Generator API.

## Test Framework

We use Jest as our testing framework. The tests are written in JavaScript and use ES modules.

## Test Files

The tests are located in the `__tests__` directory:

- `basic.test.js`: Basic tests to verify that Jest is working correctly
- `server.test.js`: Tests for the server health endpoint
- `api.test.js`: Tests for the API endpoints (in progress)
- `novita-service.test.js`: Tests for the Novita service (in progress)
- `s3-config.test.js`: Tests for the S3 configuration (in progress)
- `image-processing.test.js`: Tests for the image processing functionality (in progress)

## Running Tests

### Run all tests

```bash
npm test
```

### Run specific tests

```bash
# Run basic tests
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/basic.test.js

# Run server health check test
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/server.test.js
```

## CI/CD Integration

We use GitHub Actions to run tests automatically on every push to the main branch. The workflow configuration is in `.github/workflows/test.yml`.

The workflow:

1. Checks out the code
2. Sets up Node.js
3. Installs dependencies
4. Runs the basic tests
5. Runs the server health check test
6. Verifies that the server can start

## Test Coverage

We track test coverage using Jest's built-in coverage reporter. The coverage reports are generated in the `coverage` directory.

## Future Improvements

- Complete the implementation of all test files
- Add more comprehensive tests for the API endpoints
- Add integration tests for the entire application
- Add end-to-end tests with real image processing
- Set up a staging environment for testing with real AWS services 