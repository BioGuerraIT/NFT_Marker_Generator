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

function binomialFilter(input) {
  return tf.tidy(() => {
    // Create a binomial filter kernel (approximating Gaussian)
    const filterWeights = [
      [[[1/16]], [[2/16]], [[1/16]]],
      [[[2/16]], [[4/16]], [[2/16]]],
      [[[1/16]], [[2/16]], [[1/16]]]
    ];
    
    // Create the kernel with proper shape [height, width, in_channels, out_channels]
    const kernel = tf.tensor4d(filterWeights);
    
    // Ensure input is properly shaped [batch, height, width, channels]
    const reshapedInput = tf.expandDims(tf.expandDims(input, 0), -1);
    
    // Apply convolution with proper padding
    const output = tf.conv2d(reshapedInput, kernel, 1, 'same');
    
    // Remove the extra dimensions
    return tf.squeeze(output);
  });
}

// Register the binomial filter operation
tf.registerKernel({
  kernelName: 'BinomialFilter',
  backendName: 'tensorflow',
  kernelFunc: ({ inputs }) => {
    const { x } = inputs;
    return binomialFilter(x);
  }
});

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
  }
}

// Start compilation
compile().catch(error => {
  console.error('Compilation error:', error);
  process.exit(1);
});
