const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
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
    const { message, image } = req.body;
    
    const mailOptions = {
      from: `"Nirmaan Alerts" <${process.env.EMAIL_USER}>`,
      to: 'justbored0812@gmail.com',
      subject: '🚨 Nirmaan Alert: Crack Detected',
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
