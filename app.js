import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(filePath) {
  const worker = new Worker(path.join(__dirname, "compile-worker.js"), {
    workerData: filePath,
  });

  return new Promise((resolve, reject) => {
    worker.on("message", (message) => {
      if (message.type === 'progress') {
        // Log progress to stderr instead of stdout
        console.error(`Processing: ${message.progress}%`);
      } else {
        // This is our final result
        resolve(message);
      }
    });
    
    worker.on("error", (error) => reject(error));
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

const filePath = process.argv[2];

(async () => {
  try {
    const result = await run(filePath);
    // Only output the final result to stdout
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
