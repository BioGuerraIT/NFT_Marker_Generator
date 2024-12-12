import { parentPort, workerData } from 'worker_threads';
import { createCanvas, loadImage } from "canvas";
import { OfflineCompiler } from "mind-ar/src/image-target/offline-compiler.js";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from "url";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = workerData;

// Function to optimize image before processing
async function optimizeImage(image) {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  
  // Scale down large images to prevent memory issues
  let targetWidth = image.width;
  let targetHeight = image.height;
  const MAX_SIZE = 1024;
  
  if (image.width > MAX_SIZE || image.height > MAX_SIZE) {
    const ratio = Math.min(MAX_SIZE / image.width, MAX_SIZE / image.height);
    targetWidth = Math.floor(image.width * ratio);
    targetHeight = Math.floor(image.height * ratio);
  }
  
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  // Draw image with smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  
  const optimized = await loadImage(canvas.toBuffer());
  
  // Clean up
  canvas.width = 1;
  canvas.height = 1;
  ctx.clearRect(0, 0, 1, 1);
  
  return optimized;
}

async function compileTarget() {
  let canvas = null;
  try {
    // Load and optimize the image
    const originalImage = await loadImage(filePath);
    const optimizedImage = await optimizeImage(originalImage);
    
    // Initialize compiler with optimized settings
    const compiler = new OfflineCompiler({
      maxWorkers: 1,
      warmupTolerance: 1,
      maxTrack: 1,
      filterMinCF: 0.1,
      filterBeta: 10,
      debugMode: false
    });
    
    // Normalize progress reporting
    let lastProgress = 0;
    await compiler.compileImageTargets([optimizedImage], (progress) => {
      // Ensure progress is between 0 and 100
      const normalizedProgress = Math.min(Math.max(progress * 100, lastProgress), 100);
      lastProgress = normalizedProgress;
      
      parentPort.postMessage({
        type: 'progress',
        progress: normalizedProgress
      });
    });
    
    // Export and save the compiled data
    const buffer = compiler.exportData();
    const outputDir = path.resolve(__dirname, "outputs");
    const fileName = `target_${Date.now()}.mind`;
    const targetMindPath = path.join(outputDir, fileName);
    
    await mkdir(outputDir, { recursive: true });
    await writeFile(targetMindPath, buffer);
    
    return targetMindPath;
  } catch (error) {
    throw error;
  } finally {
    // Clean up any remaining canvas instances
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
      canvas = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

// Execute the compilation
compileTarget()
  .then((targetPath) => {
    parentPort.postMessage({
      type: 'complete',
      success: true,
      message: "NFT marker generated successfully",
      path: targetPath
    });
  })
  .catch((error) => {
    console.error('Compilation error:', error);
    parentPort.postMessage({
      type: 'complete',
      success: false,
      message: `Worker Error: ${error.message}`
    });
  });
