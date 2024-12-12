import { parentPort, workerData } from 'worker_threads';
import { createCanvas, loadImage, Canvas } from "canvas";
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
  
  // Draw image with smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, image.width, image.height);
  
  return await loadImage(canvas.toBuffer());
}

async function compileTarget() {
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
    
    // Compile with progress updates
    await compiler.compileImageTargets([optimizedImage], (progress) => {
      parentPort.postMessage({
        type: 'progress',
        progress: progress * 100
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
