import express from "express";
import multer from "multer";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { uploadToS3 } from './s3-config.js';
import { processImageWithNovita } from './novita-service.js';
import dotenv from 'dotenv';
import sharp from 'sharp';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Add CORS middleware with configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

const TARGET_SIZE = 512;

app.post("/create-nft", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Preprocess image to exactly 512x512
    console.log('Preprocessing image...');
    const originalImage = await sharp(req.file.buffer);
    const metadata = await originalImage.metadata();
    console.log('Original dimensions:', metadata.width, 'x', metadata.height);

    // Resize to 512x512 maintaining aspect ratio and center crop
    const resizedImageBuffer = await sharp(req.file.buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: 'cover',    // This ensures the image covers the entire 512x512 area
        position: 'center' // This centers the crop
      })
      .toBuffer();

    // Save the file temporarily
    const tempFilePath = path.join('uploads', `${Date.now()}${path.extname(req.file.originalname)}`);
    await fs.promises.mkdir('uploads', { recursive: true });
    await fs.promises.writeFile(tempFilePath, resizedImageBuffer);
    console.log("Uploaded file path:", tempFilePath);

    // 1. First generate the NFT marker
    const markerUrl = await new Promise((resolve, reject) => {
      const nftCreator = spawn('node', ['app.js', tempFilePath]);
      let stdoutData = '';
      let stderrData = '';

      nftCreator.stdout.on('data', (data) => {
        const message = data.toString();
        stdoutData += message;
        console.log('stdout:', message);

        // Check for NFT Marker URL in the output
        if (message.includes('NFT Marker URL:')) {
          const url = message.split('NFT Marker URL:')[1].trim();
          if (url) {
            resolve(url);
          }
        }
      });

      nftCreator.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error('stderr:', data.toString());
      });

      nftCreator.on('close', async (code) => {
        // Clean up temporary file
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });

        if (code !== 0 && code !== null) {
          reject(new Error('Error generating NFT marker'));
          return;
        }

        // If we haven't resolved yet, try to find URL in stdout
        const match = stdoutData.match(/Success: (https:\/\/[^\s\n]+)/);
        if (match) {
          resolve(match[1]);
        } else {
          console.error('Could not find URL in output:', stdoutData);
          reject(new Error('Could not find generated file URL'));
        }
      });

      nftCreator.on('error', (error) => {
        console.error('Error:', error);
        reject(error);
      });
    });

    // 2. Only if NFT marker generation succeeds, proceed with video generation
    console.log('NFT marker generated successfully, starting video generation...');
    const videoUrl = await processImageWithNovita(resizedImageBuffer);

    // 3. Both processes completed successfully
    res.json({
      success: true,
      message: 'NFT marker and video generated successfully',
      markerUrl: markerUrl,
      videoUrl: videoUrl
    });

  } catch (error) {
    console.error('Error in create-nft:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error processing image' 
    });
  }
});

app.post("/create-ar-page", upload.none(), async (req, res) => {
  try {
    const { html } = req.body;
    const fileName = `ar-${uuidv4()}.html`;
    
    // Upload HTML to S3
    const uploadResult = await uploadToS3(Buffer.from(html), fileName);
    
    if (!uploadResult.success) {
      throw new Error('Failed to upload AR page');
    }
    
    res.json({ success: true, url: uploadResult.url });
  } catch (error) {
    console.error('Error creating AR page:', error);
    res.status(500).json({ success: false, error: 'Failed to create AR page' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

// Get the server URL from Railway or default to localhost
const serverUrl = process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NFT Creator is running on ${serverUrl}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
