import { parentPort, workerData } from "worker_threads";
import { loadImage } from "canvas";
import { OfflineCompiler } from "mind-ar/src/image-target/offline-compiler.js";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = workerData;

async function initTensorFlow() {
  try {
    // Configure TensorFlow.js
    await tf.setBackend('tensorflow');
    await tf.enableProdMode(); // Disable debug mode
    await tf.ready();

    // Configure memory management
    tf.engine().startScope();

    // Pre-warm the backend
    tf.tidy(() => {
      const warmupTensor = tf.zeros([1, 1]);
      warmupTensor.dispose();
    });

    // Register custom ops if needed
    const customBackend = tf.findBackend('tensorflow');
    if (customBackend && !customBackend.kernelRegistry.has('BinomialFilter')) {
      customBackend.kernelRegistry.set('BinomialFilter', {
        kernelName: 'BinomialFilter',
        backendName: 'tensorflow',
        kernelFunc: (args) => {
          const { x } = args.inputs;
          return tf.tidy(() => {
            // Simple Gaussian-like filter approximation
            const kernel = tf.tensor2d([[1, 2, 1], [2, 4, 2], [1, 2, 1]]).div(16);
            return tf.conv2d(x.expandDims(0), kernel.expandDims(-1).expandDims(-1), 1, 'same').squeeze(0);
          });
        },
      });
    }
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
      tfBackend: 'tensorflow',
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
