import { parentPort, workerData } from "worker_threads";
import { loadImage } from "canvas";
import { OfflineCompiler } from "mind-ar/src/image-target/offline-compiler.js";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as tf from '@tensorflow/tfjs-node';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = workerData;

// Create a binomial filter kernel (approximating Gaussian)
const filterWeights = [
  [[[1/16]], [[2/16]], [[1/16]]],
  [[[2/16]], [[4/16]], [[2/16]]],
  [[[1/16]], [[2/16]], [[1/16]]]
];

// Create the kernel once and reuse it
const kernel = tf.tensor4d(filterWeights);

function binomialFilter(input) {
  if (!tf.util.isValidTensorShape(input.shape) || input.shape.length < 2) {
    console.error('Invalid input tensor shape:', input.shape);
    return input;
  }

  return tf.tidy(() => {
    try {
      // Convert input to tensor if it's not already
      const inputTensor = tf.tensor(input.arraySync());
      
      // Ensure input is properly shaped [batch, height, width, channels]
      const reshapedInput = tf.expandDims(tf.expandDims(inputTensor, 0), -1);
      
      // Apply convolution with proper padding
      const output = tf.conv2d(reshapedInput, kernel, 1, 'same');
      
      // Remove the extra dimensions
      return tf.squeeze(output);
    } catch (error) {
      console.error('Error in binomialFilter:', error);
      return input;
    }
  });
}

// Patch the mind-ar library to use our binomial filter
const originalDetector = OfflineCompiler.prototype.detect;
OfflineCompiler.prototype.detect = function(input) {
  if (!input || !input.shape) {
    console.error('Invalid input to detect:', input);
    return null;
  }
  
  const filtered = binomialFilter(input);
  return originalDetector.call(this, filtered);
};

async function initTensorFlow() {
  try {
    // Configure TensorFlow.js
    await tf.ready();
    tf.engine().startScope();
    
    // Pre-warm the backend with a small test
    tf.tidy(() => {
      const testTensor = tf.tensor2d([[1, 2], [3, 4]]);
      const warmupResult = binomialFilter(testTensor);
      warmupResult.dispose();
      testTensor.dispose();
    });
  } catch (error) {
    console.error('TensorFlow initialization error:', error);
    throw error;
  }
}

async function compile() {
  try {
    await initTensorFlow();
    
    const image = await loadImage(filePath);
    const compiler = new OfflineCompiler({
      maxWorkers: 1,
      warmupTolerance: 1,
      maxTrack: 1,
      filterMinCF: 0.1,
      filterBeta: 10,
      debugMode: false
    });
    
    // Send progress updates
    await compiler.compileImageTargets([image], (progress) => {
      parentPort.postMessage({
        type: 'progress',
        progress: progress * 100
      });
    });
    
    const buffer = compiler.exportData();
    
    const outputDir = path.resolve(__dirname, "outputs");
    const fileName = `target_${Date.now()}.mind`;
    const targetMindPath = path.join(outputDir, fileName);
    
    await mkdir(outputDir, { recursive: true });
    await writeFile(targetMindPath, buffer);
    
    parentPort.postMessage({
      type: 'complete',
      success: true,
      message: "NFT marker generated successfully",
      path: targetMindPath
    });
    
  } catch (error) {
    console.error('Compilation error:', error);
    parentPort.postMessage({
      type: 'complete',
      success: false,
      message: `Worker Error: ${error.message}`
    });
  } finally {
    // Clean up TensorFlow memory
    tf.engine().endScope();
    tf.disposeVariables();
    kernel.dispose();
  }
}

// Start compilation
compile().catch(error => {
  console.error('Compilation error:', error);
  process.exit(1);
});
