import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(path.join(__dirname, "compile-worker.js"), {
        workerData: filePath,
      });

      worker.on("message", (message) => {
        if (message.type === 'progress') {
          console.error(`Processing: ${message.progress}%`);
        } else {
          resolve(message);
        }
      });
      
      worker.on("error", (error) => {
        console.error("Worker error:", error);
        reject(error);
      });
      
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    } catch (error) {
      console.error("Error creating worker:", error);
      reject(error);
    }
  });
}

const filePath = process.argv[2];

(async () => {
  try {
    const result = await run(filePath);
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ 
      success: false, 
      message: error.message 
    }));
    process.exit(1);
  }
})();
