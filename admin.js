const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require("mysql2/promise");
const path = require('path');
const fs = require("fs");
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const session = require("express-session");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

app.use(session({
  secret: "j39Dkd8!_Random#Key_2025!!",  
  resave: false,
  saveUninitialized: false
}));

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).send("You must be logged in to access this page");
}

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

let files = []; 

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQLPORT),
  ssl: { rejectUnauthorized: false }
});


db.connect((err) => {
  if (err) console.error('❌ DB error:', err);
  else console.log('✅ Connected to MySQL.');
});
app.post("/adminlogin", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM adminn WHERE busid=? AND password=?",
      [busid, password]
    );

    if (rows.length > 0) {
      req.session.user = { role: "admin", busid };
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Invalid Admin credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/adminregister", async (req, res) => {
  const { busid, password } = req.body;

  try {
    await db.query(
      "INSERT INTO adminn (busid, password) VALUES (?,?)",
      [busid, password]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Admin already exists" });
  }
});

app.post("/studentlogin", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM logiin WHERE busid=? AND password=?",
      [busid, password]
    );

    if (rows.length > 0) {
      req.session.user = { role: "student", busid };
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Student not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post("/studentregister", async (req, res) => {
  const { busid, password } = req.body;

  try {
    await db.query(
      "INSERT INTO logiin (busid, password) VALUES (?,?)",
      [busid, password]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Student exists" });
  }
});

let lastUploaded = null;

app.post("/upload-schedule", upload.single("pdf"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const originalName = req.file.originalname; 
    const destPath = path.join(uploadDir, originalName);

    fs.renameSync(req.file.path, destPath);


    lastUploaded = {
      stored: originalName,
      original: originalName
    };

    res.json({
      message: "✅ Upload successful",
      file: `/uploads/${originalName}`,
      originalName: originalName
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "❌ Upload failed" });
  }
});

app.get("/download-schedule", (req, res) => {
  if (!lastUploaded) {
    return res.status(404).send("No schedule uploaded yet");
  }

  const filePath = path.join(uploadDir, lastUploaded.stored);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found on server");
  }

  res.download(filePath, lastUploaded.original); 
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});




