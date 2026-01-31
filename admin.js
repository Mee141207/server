const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 3000;

/* ---------- MIDDLEWARE ---------- */
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "j39Dkd8!_Random#Key_2025!!",
    resave: false,
    saveUninitialized: false
  })
);

/* ---------- AUTH MIDDLEWARE ---------- */
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).send("You must be logged in");
}

/* ---------- UPLOAD SETUP ---------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

/* ---------- MYSQL (RAILWAY) ---------- */
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQLPORT),
  waitForConnections: true,
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false }
});

/* ---------- TEST DB ---------- */
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Railway MySQL Connected");
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
  }
})();

/* ---------- ROUTES ---------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "userroles.html"));
});

/* ---------- ADMIN LOGIN ---------- */
app.post("/adminlogin", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM adminn WHERE busid = ? AND password = ?",
      [busid, password]
    );

    if (rows.length > 0) {
      req.session.user = { role: "admin", busid };
      res.json({ message: "Login successful", redirect: "/admindashboard.html" });
    } else {
      res.json({ message: "Invalid bus ID or password" });
    }
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

/* ---------- ADMIN REGISTER ---------- */
app.post("/adminregister", async (req, res) => {
  const { busid, password } = req.body;
  if (!busid || !password)
    return res.status(400).json({ message: "Missing data" });

  try {
    const [exists] = await db.query(
      "SELECT * FROM adminn WHERE busid = ?",
      [busid]
    );

    if (exists.length > 0)
      return res.json({ message: "Admin already exists" });

    await db.query(
      "INSERT INTO adminn (busid, password) VALUES (?, ?)",
      [busid, password]
    );

    req.session.user = { role: "admin", busid };
    res.json({ message: "Admin registered", redirect: "/admindashboard.html" });
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

/* ---------- STUDENT LOGIN ---------- */
app.post("/studentlogin", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM logiin WHERE busid = ? AND password = ?",
      [busid, password]
    );

    if (rows.length > 0) {
      req.session.user = { role: "student", busid };
      res.json({ message: "Login successful", redirect: "/home.html" });
    } else {
      res.json({ message: "User not found, sign up first" });
    }
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

/* ---------- STUDENT REGISTER ---------- */
app.post("/studentregister", async (req, res) => {
  const { busid, password } = req.body;
  if (!busid || !password)
    return res.status(400).json({ message: "Missing data" });

  try {
    const [exists] = await db.query(
      "SELECT * FROM logiin WHERE busid = ?",
      [busid]
    );

    if (exists.length > 0)
      return res.json({ message: "Username already exists" });

    await db.query(
      "INSERT INTO logiin (busid, password) VALUES (?, ?)",
      [busid, password]
    );

    res.json({ message: "User registered", redirect: "/home.html" });
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

/* ---------- FILE UPLOAD ---------- */
let lastUploaded = null;

app.post("/upload-schedule", upload.single("pdf"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const originalName = req.file.originalname;
  const destPath = path.join(uploadDir, originalName);

  fs.renameSync(req.file.path, destPath);

  lastUploaded = {
    stored: originalName,
    original: originalName
  };

  res.json({
    message: "✅ Upload successful",
    file: `/uploads/${originalName}`
  });
});

/* ---------- FILE DOWNLOAD ---------- */
app.get("/download-schedule", (req, res) => {
  if (!lastUploaded) return res.status(404).send("No file uploaded");

  const filePath = path.join(uploadDir, lastUploaded.stored);
  if (!fs.existsSync(filePath))
    return res.status(404).send("File not found");

  res.download(filePath, lastUploaded.original);
});

/* ---------- STUDENT PAGE ---------- */
app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

/* ---------- START SERVER ---------- */
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
