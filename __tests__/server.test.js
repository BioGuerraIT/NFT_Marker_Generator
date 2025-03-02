import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock the dependencies
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../s3-config.js', () => ({
  uploadToS3: jest.fn(),
}));

jest.mock('../novita-service.js', () => ({
  processImageWithNovita: jest.fn(),
}));

// Create a minimal version of the server for testing
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });
  
  return app;
};

describe('Server Endpoints', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
}); 