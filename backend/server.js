const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/api/send-alert', async (req, res) => {
  try {
    const { message, image, recipientEmail } = req.body;
    
    const mailOptions = {
      from: `"Road Inspector Alerts" <${process.env.EMAIL_USER}>`,
      to: recipientEmail || 'justbored0812@gmail.com',
      subject: '🚨 Road Inspector Alert: Crack Detected',
      text: message || 'A crack was detected in one of the uploaded images.',
    };

    if (image) {
      const base64Data = image.split(',')[1];
      mailOptions.attachments = [
        {
          filename: 'crack-detected.jpg',
          content: base64Data,
          encoding: 'base64'
        }
      ];
    }

    // Send email asynchronously in the background so the frontend doesn't wait
    transporter.sendMail(mailOptions)
      .then(() => console.log('Alert email sent successfully.'))
      .catch((error) => console.error('Error sending email:', error));
      
    res.status(200).json({ success: true, message: 'Email queued for sending' });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

const DB_FILE = path.join(__dirname, 'cracks_db.json');

const readDB = () => {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return [];
  }
};

const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

app.get('/api/get-cracks', (req, res) => {
  const cracks = readDB();
  res.status(200).json({ success: true, data: cracks });
});

app.post('/api/save-crack', (req, res) => {
  try {
    const { id, preview, topClass, rawClass, isCrack, timestamp, gps, confidence } = req.body;
    
    if (!isCrack) {
      return res.status(200).json({ success: true, message: 'Not a crack, skipped.' });
    }

    const cracks = readDB();
    const newCrack = {
      id: id || Date.now().toString(),
      preview,
      topClass,
      rawClass,
      isCrack,
      timestamp: timestamp || new Date().toISOString(),
      gps,
      confidence
    };
    
    cracks.unshift(newCrack);
    writeDB(cracks);
    
    res.status(200).json({ success: true, data: newCrack });
  } catch (error) {
    console.error('Error saving crack:', error);
    res.status(500).json({ success: false, error: 'Failed to save crack' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
