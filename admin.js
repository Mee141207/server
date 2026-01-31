const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

/* ===============================
   DATABASE CONNECTION (RAILWAY)
   =============================== */

const db = mysql.createPool(process.env.MYSQL_URL);

(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ MySQL Connected Successfully");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL Connection Failed:", err);
  }
})();

/* ===============================
   CREATE TABLE IF NOT EXISTS
   =============================== */

app.get("/init", async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS adminn (
        id INT AUTO_INCREMENT PRIMARY KEY,
        busid VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);

    res.send("✅ adminn table ready");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* ===============================
   INSERT ADMIN (SIGNUP)
   =============================== */

app.post("/admin/register", async (req, res) => {
  const { busid, password } = req.body;

  if (!busid || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    await db.query(
      "INSERT INTO adminn (busid, password) VALUES (?, ?)",
      [busid, password]
    );

    res.json({ message: "✅ Admin registered" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===============================
   ADMIN LOGIN
   =============================== */

app.post("/admin/login", async (req, res) => {
  const { busid, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM adminn WHERE busid = ? AND password = ?",
      [busid, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "❌ Invalid credentials" });
    }

    res.json({ message: "✅ Login successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===============================
   SERVER START
   =============================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
