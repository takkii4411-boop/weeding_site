const express = require('express');
const db = require('../database/db');
const router = express.Router();

router.get('/:token', (req, res) => {
  const { token } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE gallery_token = ?').get(token);
  if (!client) return res.status(404).send('Gallery not found');
  const photos = db.prepare('SELECT * FROM photos WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
  const feedback = db.prepare('SELECT * FROM feedback WHERE client_id = ? ORDER BY created_at DESC').all(client.id);
  res.render('client/gallery', { client, photos, feedback, success: null, error: null });
});

router.post('/:token/feedback', (req, res) => {
  const { token } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE gallery_token = ?').get(token);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const { name, email, rating, message } = req.body;
  if (!name || !email || !rating) {
    return res.status(400).json({ error: 'Name, email and rating are required' });
  }
  try {
    db.prepare(
      'INSERT INTO feedback (client_id, name, email, rating, message) VALUES (?, ?, ?, ?, ?)'
    ).run(client.id, name, email, parseInt(rating), message || null);
    const photos = db.prepare('SELECT * FROM photos WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
    const feedback = db.prepare('SELECT * FROM feedback WHERE client_id = ? ORDER BY created_at DESC').all(client.id);
    res.render('client/gallery', { client, photos, feedback, success: 'Thank you for your feedback!', error: null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
