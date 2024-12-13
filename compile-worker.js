import { parentPort, workerData } from 'worker_threads';
import { loadImage } from "canvas";
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

async function processImage() {
    try {
        console.log('Loading image:', filePath);
        const image = await loadImage(filePath);
        console.log('Image loaded, starting compilation');
        
        const compiler = new OfflineCompiler();
        
        // Track if compilation has started
        let compilationStarted = false;
        
        await compiler.compileImageTargets([image], (progress) => {
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
