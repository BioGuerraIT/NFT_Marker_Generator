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

    worker.on('message', (message) => {
      if (message.success) {
        console.log(`Success: ${message.path}`);
        resolve(message.path);
      } else {
        console.error(`Error: ${message.message}`);
        reject(new Error(message.message));
      }
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

if (process.argv[2]) {
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
