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

function createBinomialFilter() {
  // Create a binomial filter kernel (approximating Gaussian)
  const filterWeights = [
    [1/16, 2/16, 1/16],
    [2/16, 4/16, 2/16],
    [1/16, 2/16, 1/16]
  ];
  return tf.tensor4d(filterWeights, [3, 3, 1, 1]);
}

async function registerCustomOps() {
  try {
    // Register BinomialFilter as a custom operation
    tf.customGrad((x) => {
      const forward = () => {
        // Ensure input is properly shaped
        const reshapedInput = x.reshape([1, x.shape[0], x.shape[1], 1]);
        const kernel = createBinomialFilter();
        
        // Apply convolution and reshape back
        const output = tf.conv2d(reshapedInput, kernel, 1, 'same');
        return output.reshape(x.shape);
      };
      
      // Define gradient for backpropagation (identity gradient for now)
      const backward = (dy) => dy;
      
      return { value: forward(), gradFunc: backward };
    }, 'BinomialFilter');
    
  } catch (error) {
    console.error('Error registering custom ops:', error);
    throw error;
  }
}

async function initTensorFlow() {
  try {
    // Configure TensorFlow.js
    await tf.ready();
    tf.engine().startScope();
    
    // Register custom operations
    await registerCustomOps();
    
    // Pre-warm the backend
    tf.tidy(() => {
      // Create and dispose a small test tensor
      const testTensor = tf.tensor2d([[1, 2], [3, 4]]);
      const warmupResult = tf.customOp(testTensor, 'BinomialFilter');
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
