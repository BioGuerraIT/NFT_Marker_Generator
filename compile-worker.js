import { parentPort, workerData } from 'worker_threads';
import { loadImage, createCanvas } from "canvas";
import { OfflineCompiler } from "mind-ar/src/image-target/offline-compiler.js";
import path from 'path';
import { uploadToS3 } from './s3-config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const filePath = workerData;

// Send progress updates to parent
function sendProgress(progress) {
    parentPort.postMessage({
        type: 'progress',
        progress: Math.round(progress * 100)
    });
}

// Send error to parent
function sendError(error) {
    console.error('Error:', error);
    parentPort.postMessage({
        type: 'complete',
        success: false,
        message: `Worker Error: ${error.message}`
    });
}

// Validate and preprocess image
async function preprocessImage(image) {
    const MIN_SIZE = 200;
    const MAX_SIZE = 1000;
    const TARGET_SIZE = 800;

    // Check minimum dimensions
    if (image.width < MIN_SIZE || image.height < MIN_SIZE) {
        throw new Error('Image is too small. Minimum size is 200x200 pixels.');
    }

    // Create canvas for processing
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Calculate new dimensions while maintaining aspect ratio
    let targetWidth = image.width;
    let targetHeight = image.height;
    
    if (image.width > MAX_SIZE || image.height > MAX_SIZE) {
        const ratio = Math.min(TARGET_SIZE / image.width, TARGET_SIZE / image.height);
        targetWidth = Math.floor(image.width * ratio);
        targetHeight = Math.floor(image.height * ratio);
    }

    // Resize canvas to target dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Apply image processing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw and enhance the image
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    
    // Enhance contrast slightly
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Convert back to image
    const processedImage = await loadImage(canvas.toBuffer());

    // Clean up
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);

    return processedImage;
}

async function processImage() {
    try {
        console.log('Loading image:', filePath);
        const originalImage = await loadImage(filePath);
        console.log('Original dimensions:', originalImage.width, 'x', originalImage.height);
        
        console.log('Preprocessing image...');
        const processedImage = await preprocessImage(originalImage);
        console.log('Processed dimensions:', processedImage.width, 'x', processedImage.height);
        
        console.log('Starting compilation');
        const compiler = new OfflineCompiler({
            maxTrack: 1,
            warmupTolerance: 5,
            missTolerance: 5,
            filterMinCF: 0.1,
            filterBeta: 10
        });
        
        // Track if compilation has started
        let compilationStarted = false;
        
        await compiler.compileImageTargets([processedImage], (progress) => {
            compilationStarted = true;
            const percentage = Math.round(progress * 100);
            console.log(`Compilation progress: ${percentage}%`);
            sendProgress(progress);
        });
        
        if (!compilationStarted) {
            throw new Error('Compilation did not start properly');
        }
        
        console.log('Compilation complete, exporting data');
        const buffer = compiler.exportData();
        if (!buffer || buffer.length === 0) {
            throw new Error('Failed to export marker data');
        }

        const fileName = `target_${Date.now()}.mind`;
        console.log('Uploading to S3:', fileName);
        
        const uploadResult = await uploadToS3(buffer, fileName);
        if (!uploadResult.success) {
            throw new Error(`Failed to upload to S3: ${uploadResult.error}`);
        }
        
        console.log('Success! URL:', uploadResult.url);
        return uploadResult.url;
    } catch (error) {
        console.error('Error in processImage:', error);
        throw error;
    }
}

// Set a timeout for the entire process
const timeout = setTimeout(() => {
    sendError(new Error('Processing timeout exceeded'));
    process.exit(1);
}, 300000); // 5 minutes timeout

processImage()
    .then((url) => {
        clearTimeout(timeout);
        parentPort.postMessage({
            type: 'complete',
            success: true,
            message: 'NFT marker generated successfully',
            path: url
        });
        process.exit(0);
    })
    .catch((error) => {
        clearTimeout(timeout);
        sendError(error);
        process.exit(1);
    });
