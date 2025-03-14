import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';
import { uploadToS3 } from './s3-config.js';

const NOVITA_API_KEY = process.env.NOVITA_API_KEY;

async function resizeImage(imageBuffer) {
    const img = await loadImage(imageBuffer);
    console.log('Original dimensions:', img.width, 'x', img.height);
    
    // Target dimensions for Novita.ai
    const TARGET_SIZE = 512;
    
    // Create canvas for final output
    const canvas = createCanvas(TARGET_SIZE, TARGET_SIZE);
    const ctx = canvas.getContext('2d');
    
    // Calculate crop dimensions
    let cropSize = Math.min(img.width, img.height);
    let sourceX = Math.floor((img.width - cropSize) / 2);
    let sourceY = Math.floor((img.height - cropSize) / 2);
    
    // Ensure we don't have negative coordinates
    sourceX = Math.max(0, sourceX);
    sourceY = Math.max(0, sourceY);
    
    // Fill background with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
    
    // Draw the image cropped and scaled to 512x512
    ctx.drawImage(
        img,
        sourceX, sourceY,         // Start at center of the source image
        cropSize, cropSize,       // Take a square crop
        0, 0,                     // Place at top-left of canvas
        TARGET_SIZE, TARGET_SIZE  // Scale to target size
    );
    
    console.log(`Cropped and resized to ${TARGET_SIZE}x${TARGET_SIZE} for Novita.ai`);
    
    // Convert to base64
    const base64Data = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    
    // Clean up
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    
    return base64Data;
}

async function downloadVideo(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }
    return response.buffer();
}

export async function processImageWithNovita(imageBuffer) {
    try {
        // Resize image
        console.log('Resizing image for Novita.ai...');
        const resizedImageBase64 = await resizeImage(imageBuffer);
        
        // Initial request to start processing
        console.log('Starting video generation...');
        const taskResponse = await fetch('https://api.novita.ai/v3/async/img2video', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOVITA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_name: "SVD-XT",
                image_file: resizedImageBase64,
                frames_num: 25,
                frames_per_second: 6,
                image_file_resize_mode: "CROP_TO_ASPECT_RATIO",
                steps: 20,
                seed: Math.floor(Date.now() / 1000),
                enable_frame_interpolation: true,
                extra: {
                    response_video_type: "mp4"
                }
            })
        });

        if (!taskResponse.ok) {
            const errorData = await taskResponse.text();
            throw new Error(`Failed to start video generation: ${errorData}`);
        }

        const taskData = await taskResponse.json();
        const taskId = taskData.task_id;
        console.log('Video generation started with task ID:', taskId);

        // Poll for the result
        let status = '';
        let videoUrl = '';
        let attempts = 0;
        const maxAttempts = 90; // Maximum polling attempts (6 minutes with 4-second intervals)
        const pollInterval = 4000; // 4 seconds between checks

        while (status !== 'TASK_STATUS_SUCCEED' && attempts < maxAttempts) {
            attempts++;
            console.log(`Checking status attempt ${attempts}/${maxAttempts} (${Math.round(attempts/maxAttempts * 100)}%)`);
            
            const statusResponse = await fetch(
                `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${NOVITA_API_KEY}`,
                    },
                }
            );

            if (!statusResponse.ok) {
                throw new Error('Failed to check video status');
            }

            const statusData = await statusResponse.json();
            status = statusData.task?.status;
            console.log('Video generation status:', status);

            if (status === 'TASK_STATUS_SUCCEED') {
                if (statusData.videos && statusData.videos.length > 0) {
                    videoUrl = statusData.videos[0].video_url;
                    console.log('Video generation completed, downloading video...');
                    
                    // Download the video
                    const videoBuffer = await downloadVideo(videoUrl);
                    
                    // Upload to S3
                    console.log('Uploading video to S3...');
                    const fileName = `video_${Date.now()}.mp4`;
                    const uploadResult = await uploadToS3(videoBuffer, fileName);
                    
                    if (!uploadResult.success) {
                        throw new Error('Failed to upload video to S3');
                    }
                    
                    return uploadResult.url;
                } else {
                    throw new Error('No video URL in successful response');
                }
            }

            if (status === 'TASK_STATUS_FAILED') {
                throw new Error(`Video generation failed: ${statusData.task?.reason || 'Unknown error'}`);
            }

            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        if (attempts >= maxAttempts) {
            throw new Error(`Video generation timed out after ${Math.round(maxAttempts * pollInterval / 1000)} seconds`);
        }

    } catch (error) {
        console.error('Novita API error:', error);
        throw error;
    }
} 