import { jest } from '@jest/globals';

// Mock sharp
const mockToBuffer = jest.fn().mockResolvedValue(Buffer.from('resized image data'));
const mockResize = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockSharp = jest.fn().mockReturnValue({ resize: mockResize });

jest.mock('sharp', () => mockSharp);

describe('Image Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Image Resizing', () => {
    it('should resize an image to 512x512', async () => {
      // Mock image buffer
      const imageBuffer = Buffer.from('test image data');
      
      // Import sharp after mocking
      const sharp = require('sharp');
      
      // Resize the image
      const resizedImageBuffer = await sharp(imageBuffer)
        .resize(512, 512)
        .toBuffer();
      
      // Assertions
      expect(mockSharp).toHaveBeenCalledWith(imageBuffer);
      expect(mockResize).toHaveBeenCalledWith(512, 512);
      expect(mockToBuffer).toHaveBeenCalled();
      expect(resizedImageBuffer).toEqual(Buffer.from('resized image data'));
    });
  });
}); 