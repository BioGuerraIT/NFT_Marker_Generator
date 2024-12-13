import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    console.log('Processing image:', workerData);
    
    const worker = new Worker('./compile-worker.js', {
      workerData
    });

    let hasResult = false;
    let progressReported = false;

    worker.on('message', (message) => {
      if (message.type === 'progress') {
        progressReported = true;
        console.log(`Progress: ${message.progress}%`);
      } else if (message.type === 'complete') {
        hasResult = true;
        if (message.success) {
          console.log(`Success: ${message.path}`);
          resolve(message.path);
        } else {
          console.error(`Error: ${message.message}`);
          reject(new Error(message.message));
        }
      }
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
      reject(err);
    });

    worker.on('exit', (code) => {
      if (!hasResult) {
        if (!progressReported) {
          reject(new Error('Worker failed to start compilation'));
        } else {
          reject(new Error(`Worker stopped unexpectedly with code ${code}`));
        }
      }
    });

    // Set a timeout for the entire process
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Processing timeout exceeded'));
    }, 300000); // 5 minutes

    worker.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}

if (process.argv[2]) {
  console.log('Starting NFT marker generation for:', process.argv[2]);
  runWorker(process.argv[2])
    .then((result) => {
      console.log(`Success: ${result}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
