import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    // Set resource limits for the worker
    const workerOptions = {
      resourceLimits: {
        maxOldGenerationSizeMb: 2048,
        maxYoungGenerationSizeMb: 512,
        codeRangeSizeMb: 64
      }
    };
    
    const worker = new Worker('./compile-worker.js', {
      ...workerOptions,
      workerData
    });

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        process.stdout.write(`Processing: ${Math.round(message.progress)}%\r`);
      } else if (message.type === 'complete') {
        if (message.success) {
          resolve(message.path);
        } else {
          reject(new Error(message.message));
        }
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    // Set a timeout to prevent infinite processing
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Processing timeout exceeded'));
    }, 300000); // 5 minutes timeout

    // Clean up timeout on completion
    worker.on('exit', () => clearTimeout(timeout));
  });
}

if (process.argv[2]) {
  runWorker(process.argv[2])
    .then((result) => {
      console.log('Success:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
