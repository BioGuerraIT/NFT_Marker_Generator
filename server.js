import express from "express";
import multer from "multer";
import path from "path";
import { spawn } from "child_process";
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
app.use(express.json());

app.post("/create-nft", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const uploadedFilePath = req.file.path;
  console.log("Uploaded file path:", uploadedFilePath);

  const nftCreator = spawn('node', ['app.js', uploadedFilePath]);
  let stdoutData = '';
  let stderrData = '';
  let mindFilePath = null;

  nftCreator.stdout.on('data', (data) => {
    stdoutData += data.toString();
    // Check for success message in the output
    const match = stdoutData.match(/Success: (.+\.mind)/);
    if (match) {
      mindFilePath = match[1];
    }
  });

  nftCreator.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  nftCreator.on('close', (code) => {
    console.log('stdout:', stdoutData);
    console.log('stderr:', stderrData);

    if (code !== 0) {
      return res.status(500).json({ error: 'Error generating NFT marker' });
    }

    if (mindFilePath) {
      // Get just the filename from the path
      const fileName = path.basename(mindFilePath);
      // Construct the URL path
      const mindFileUrl = `${req.protocol}://${req.get('host')}/outputs/${fileName}`;
      res.json({ 
        success: true,
        message: 'NFT marker generated successfully',
        path: mindFileUrl
      });
    } else {
      res.status(500).json({ error: 'Could not find generated file path' });
    }
  });

  nftCreator.on('error', (error) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error running nft_creator' });
  });
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

const serverUrl = process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;
app.listen(PORT, () => {
  console.log(`NFT Creator is running on ${serverUrl}`);
});
