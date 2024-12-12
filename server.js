import express from "express";
import multer from "multer";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer to store files with their original extensions
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Add CORS middleware
app.use(cors());

app.post("/create-nft", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const uploadedFilePath = req.file.path;
  console.log("Uploaded file path:", uploadedFilePath);

  try {
    const command = `node app.js "${uploadedFilePath}"`;
    exec(command, { maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
      console.log("stdout:", stdout);
      console.log("stderr:", stderr);
      
      if (error) {
        console.error("Error running nft_creator:", error);
        return res.status(500).json({ error: "Error generating NFT marker" });
      }

      try {
        const workerResult = JSON.parse(stdout.trim());
        console.log("Parsed worker result:", workerResult);
        
        if (!workerResult.success) {
          return res.status(500).json({ error: workerResult.message });
        }

        // Clean up the uploaded file
        fs.unlink(uploadedFilePath, (err) => {
          if (err) console.error('Error deleting uploaded file:', err);
        });

        // Generate download URL
        const mindFileName = path.basename(workerResult.path);
        const downloadUrl = `${req.protocol}://${req.get('host')}/outputs/${mindFileName}`;

        res.json({
          success: true,
          message: workerResult.message,
          downloadUrl,
          fileName: mindFileName
        });

      } catch (parseError) {
        console.error("Error parsing JSON output:", parseError, "Raw stdout:", stdout);
        return res.status(500).json({ error: "Invalid response from nft_creator" });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/create-ar-page", upload.none(), async (req, res) => {
  try {
    const { html } = req.body;
    const fileName = `ar-${uuidv4()}.html`;
    const filePath = path.join(__dirname, 'outputs', fileName);
    
    await writeFile(filePath, html);
    
    const pageUrl = `${req.protocol}://${req.get('host')}/outputs/${fileName}`;
    res.json({ success: true, url: pageUrl });
  } catch (error) {
    console.error('Error creating AR page:', error);
    res.status(500).json({ success: false, error: 'Failed to create AR page' });
  }
});

// Serve static files from the outputs directory
app.use("/outputs", express.static(path.join(__dirname, "outputs")));

// Add an endpoint to download the file directly
app.get("/outputs/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'outputs', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Backend service running on http://localhost:${PORT}`);
});
