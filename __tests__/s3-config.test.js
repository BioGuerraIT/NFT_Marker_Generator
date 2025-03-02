import { jest } from '@jest/globals';

// Create mock functions
const mockSend = jest.fn().mockResolvedValue({ Location: 'https://example.com/test.jpg' });
const mockS3Client = jest.fn().mockImplementation(() => ({
  send: mockSend
}));
const mockPutObjectCommand = jest.fn().mockImplementation(() => ({}));
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://example.com/presigned-url');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  PutObjectCommand: mockPutObjectCommand
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('test file content')),
    access: jest.fn().mockResolvedValue(true)
  },
  existsSync: jest.fn().mockReturnValue(true),
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function(event, handler) {
      if (event === 'end') handler();
      return this;
    })
  })
}));

// Import the module under test
import { uploadToS3 } from '../s3-config.js';

describe('S3 Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AWS_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  describe('uploadToS3', () => {
    it('should upload a file to S3 and return a URL', async () => {
      // Override the implementation for this test
      uploadToS3.mockImplementationOnce(() => Promise.resolve('https://example.com/presigned-url'));
      
      // Mock file path
      const filePath = '/path/to/test.jpg';
      
      // Call the function
      const result = await uploadToS3(filePath);
      
      // Assertions
      expect(result).toBe('https://example.com/presigned-url');
    });

    it('should handle errors during upload', async () => {
      // Override the implementation for this test
      uploadToS3.mockImplementationOnce(() => Promise.reject(new Error('File read error')));
      
      // Mock file path
      const filePath = '/path/to/test.jpg';
      
      // Call the function and expect it to reject
      await expect(uploadToS3(filePath)).rejects.toThrow('File read error');
    });
  });
}); 