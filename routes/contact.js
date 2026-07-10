const express = require('express');
const db = require('../database/db');
const { sendContactEmail } = require('../utils/mail');
const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, phone, event_type, event_date, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required' });
  }
  try {
    db.prepare(
      'INSERT INTO contacts (name, email, phone, event_type, event_date, message) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, phone || null, event_type || null, event_date || null, message);
    await sendContactEmail({ name, email, phone, event_type, event_date, message });
    res.json({ success: true, message: 'Thank you! We will get back to you soon.' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
