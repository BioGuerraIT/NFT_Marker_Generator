import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock canvas to avoid actual image processing
jest.mock('canvas', () => ({
  createCanvas: jest.fn().mockReturnValue({
    getContext: jest.fn().mockReturnValue({
      drawImage: jest.fn(),
      fillRect: jest.fn()
    }),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('canvas buffer'))
  }),
  loadImage: jest.fn().mockResolvedValue({
    width: 1024,
    height: 1024
  })
}));

// Mock node-fetch
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({
    id: 'test-task-id',
    status: 'success',
    output: [
      'https://example.com/marker.jpg',
      'https://example.com/video.mp4'
    ]
  }),
  status: 200
});

jest.mock('node-fetch', () => mockFetch);

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined)
  },
  existsSync: jest.fn().mockReturnValue(false)
}));

// Import the module under test
import { processImageWithNovita } from '../novita-service.js';

describe('Novita Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOVITA_API_KEY = 'test-api-key';
  });

  describe('processImageWithNovita', () => {
    it('should process an image and return marker and video paths', async () => {
      // Mock image buffer
      const imageBuffer = Buffer.from('test image data');
      
      // Call the function
      const result = await processImageWithNovita(imageBuffer);
      
      // Assertions
      expect(result).toHaveProperty('markerPath');
      expect(result).toHaveProperty('videoPath');
    });

    it('should handle API errors', async () => {
      // Mock fetch to return an error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ error: 'Invalid image' })
      });
      
      // Mock image buffer
      const imageBuffer = Buffer.from('test image data');
      
      // Call the function and expect it to reject
      await expect(processImageWithNovita(imageBuffer)).rejects.toThrow();
    });
  });
}); 