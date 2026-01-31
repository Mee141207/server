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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "bus-secret",
    resave: false,
    saveUninitialized: true
  })
);

/* ---------- UPLOAD FOLDER ---------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ---------- MULTER (FIXED) ---------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({ storage }); // ✅ THIS WAS MISSING BEFORE

/* ---------- MYSQL (RAILWAY VARIABLES) ---------- */
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: Number(process.env.MYSQLPORT),
  ssl: { rejectUnauthorized: false }
});

/* ---------- TEST DB CONNECTION ---------- */
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Railway MySQL Connected");
  } catch (err) {
    console.error("❌ DB Connection Failed:", err);
  }
})();

/* ---------- ROUTES ---------- */

app.get("/", (req, res) => {
  res.send("Admin server running");
});

/* ---------- ADMIN LOGIN ---------- */
app.post("/admin-login", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM adminn WHERE busid = ? AND password = ?",
      [busid, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.admin = busid;
    res.json({ message: "Login successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- FILE UPLOAD ---------- */
app.post("/upload-schedule", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.json({
    message: "File uploaded successfully",
    filename: req.file.filename
  });
});

/* ---------- START SERVER ---------- */
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
