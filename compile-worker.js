import { parentPort, workerData } from 'worker_threads';
import { loadImage } from "canvas";
import { OfflineCompiler } from "mind-ar/src/image-target/offline-compiler.js";
import path from 'path';
import { uploadToS3 } from './s3-config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const filePath = workerData;

new Promise(async (resolve, reject) => {
    try {
        console.log('Loading image:', filePath);
        const image = await loadImage(filePath);
        console.log('Image loaded, starting compilation');
        
        const compiler = new OfflineCompiler();
        await compiler.compileImageTargets([image], (progress) => {
            console.log(`Compilation progress: ${Math.round(progress * 100)}%`);
        });
        
        console.log('Compilation complete, exporting data');
        const buffer = compiler.exportData();

        const fileName = `target_${Date.now()}.mind`;
        console.log('Uploading to S3:', fileName);
        console.log('Using bucket:', process.env.AWS_BUCKET_NAME); // Debug log
        
        const uploadResult = await uploadToS3(buffer, fileName);
        if (!uploadResult.success) {
            throw new Error(`Failed to upload to S3: ${uploadResult.error}`);
        }
        
        resolve(uploadResult.url);
    } catch (error) {
        console.error('Error in worker:', error);
        reject(error);
    }
})
.then((url) => {
    parentPort.postMessage({
        type: 'complete',
        success: true,
        message: 'NFT marker generated successfully',
        path: url
    });
})
.catch((error) => {
    parentPort.postMessage({
        type: 'complete',
        success: false,
        message: `Worker Error: ${error.message}`
    });
});
