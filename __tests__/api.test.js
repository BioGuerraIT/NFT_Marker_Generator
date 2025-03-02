import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized image data'))
  }));
});

jest.mock('../novita-service.js', () => ({
  processImageWithNovita: jest.fn().mockResolvedValue({
    markerPath: '/path/to/marker.jpg',
    videoPath: '/path/to/video.mp4'
  })
}));

jest.mock('../s3-config.js', () => ({
  uploadToS3: jest.fn()
    .mockResolvedValueOnce('https://example.com/marker.jpg')
    .mockResolvedValueOnce('https://example.com/video.mp4')
}));

// Import the mocked modules
import { processImageWithNovita } from '../novita-service.js';
import { uploadToS3 } from '../s3-config.js';

// Create a minimal version of the API for testing
const createTestApp = () => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  
  app.use(express.json());
  
  app.post('/create-nft', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
      }
      
      // Process the image
      const { markerPath, videoPath } = await processImageWithNovita(req.file.buffer);
      
      // Upload files to S3
      const markerUrl = await uploadToS3(markerPath);
      const videoUrl = await uploadToS3(videoPath);
      
      res.json({
        success: true,
        markerUrl,
        videoUrl
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process image'
      });
    }
  });
  
  return app;
};

describe('API Endpoints', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });
  
  describe('POST /create-nft', () => {
    it('should process an image and return URLs', async () => {
      // Create a mock image file
      const buffer = Buffer.from('test image data');
      
      // Make the request
      const response = await request(app)
        .post('/create-nft')
        .attach('image', buffer, 'test.jpg');
      
      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('markerUrl', 'https://example.com/marker.jpg');
      expect(response.body).toHaveProperty('videoUrl', 'https://example.com/video.mp4');
    });
    
    it('should return 400 if no image is provided', async () => {
      // Make the request without attaching an image
      const response = await request(app)
        .post('/create-nft');
      
      // Assertions
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'No image file provided');
    });
    
    it('should handle errors during processing', async () => {
      // Mock processImageWithNovita to throw an error
      processImageWithNovita.mockRejectedValueOnce(new Error('Processing failed'));
      
      // Create a mock image file
      const buffer = Buffer.from('test image data');
      
      // Make the request
      const response = await request(app)
        .post('/create-nft')
        .attach('image', buffer, 'test.jpg');
      
      // Assertions
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Processing failed');
    });
  });
}); 