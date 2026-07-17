require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();

// Allow the live site (GitHub Pages) and local dev
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://moduforgex.github.io',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ---------- Email (Nodemailer) ----------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/api/send-alert', async (req, res) => {
  try {
    const { message, image, recipientEmail, gps, timestamp, confidence, topClass } = req.body;
    
    let locationStr = 'Not provided';
    if (gps) {
      if (gps.latitude && gps.longitude) {
        locationStr = `Latitude: ${gps.latitude}, Longitude: ${gps.longitude}`;
        if (gps.accuracy) locationStr += ` (Accuracy: ${gps.accuracy}m)`;
      } else {
        locationStr = JSON.stringify(gps);
      }
    }

    const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();
    const formattedConfidence = typeof confidence === 'number' ? `${confidence.toFixed(2)}%` : (confidence || 'N/A');

    const emailText = `${message || 'A crack was detected.'}

--- Detection Details ---
Timestamp: ${formattedTimestamp}
Location: ${locationStr}
Detection Class: ${topClass || 'Crack'}
Confidence: ${formattedConfidence}
`;

    const mailOptions = {
      from: `"Road Inspector Alerts" <${process.env.EMAIL_USER}>`,
      to: recipientEmail || process.env.EMAIL_USER,
      subject: '🚨 Road Inspector Alert: Crack Detected',
      text: emailText,
    };
    if (image) {
      const base64Data = image.split(',')[1];
      mailOptions.attachments = [{ filename: 'crack.jpg', content: base64Data, encoding: 'base64' }];
    }
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Alert sent' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Simple JSON DB (cracks_db.json) ----------
const DB_FILE = path.join(__dirname, 'cracks_db.json');
function readDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Read DB error:', e);
    return [];
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/get-cracks', (req, res) => {
  res.json({ success: true, data: readDB() });
});

app.post('/api/save-crack', (req, res) => {
  const { id, preview, topClass, rawClass, isCrack, timestamp, gps, confidence } = req.body;
  if (!isCrack) {
    return res.json({ success: true, message: 'Not a crack – skipped' });
  }
  const db = readDB();
  const newEntry = { id: id || Date.now().toString(), preview, topClass, rawClass, isCrack, timestamp: timestamp || new Date().toISOString(), gps, confidence };
  db.unshift(newEntry);
  writeDB(db);
  res.json({ success: true, data: newEntry });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
