const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/db');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  next();
}

router.get('/dashboard', requireAdmin, (req, res) => {
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  const photoCount = db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM feedback').get().count;
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const recentContacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5').all();
  res.render('admin/dashboard', { clientCount, photoCount, feedbackCount, contactCount, recentContacts });
});

router.get('/clients', requireAdmin, (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  const photoCounts = db.prepare(
    'SELECT client_id, COUNT(*) as count FROM photos GROUP BY client_id'
  ).all();
  const countMap = {};
  photoCounts.forEach(p => countMap[p.client_id] = p.count);
  res.render('admin/clients', { clients, countMap });
});

router.post('/clients/add', requireAdmin, (req, res) => {
  const { name, email, phone, event_type, event_date } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const token = crypto.randomBytes(16).toString('hex');
  try {
    db.prepare(
      'INSERT INTO clients (name, email, phone, event_type, event_date, gallery_token) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, phone || null, event_type || null, event_date || null, token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add client' });
  }
});

router.post('/clients/delete/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  res.redirect('/admin/clients');
});

router.get('/gallery/:clientId', requireAdmin, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.clientId);
  if (!client) return res.redirect('/admin/clients');
  const photos = db.prepare('SELECT * FROM photos WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
  res.render('admin/gallery', { client, photos });
});

router.post('/upload/:clientId', requireAdmin, upload.array('photos', 50), async (req, res) => {
  const clientId = req.params.clientId;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const cd = require('../utils/cloudinary');
  const cdConfigured = cd.isConfigured();

  const insert = db.prepare(
    'INSERT INTO photos (client_id, filename, original_name, cloudinary_id, cloudinary_url) VALUES (?, ?, ?, ?, ?)'
  );
  const errors = [];
  const uploaded = [];

  for (const file of req.files) {
    try {
      if (cdConfigured) {
        try {
          const result = await cd.uploadPhoto(file.path, file.originalname);
          insert.run(clientId, '', file.originalname, result.cloudinaryId, result.url);
          const fs = require('fs');
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (cdErr) {
          console.error('Cloudinary upload failed, falling back to local:', cdErr.message);
          insert.run(clientId, file.filename, file.originalname, null, null);
        }
      } else {
        insert.run(clientId, file.filename, file.originalname, null, null);
      }
      uploaded.push(file.originalname);
    } catch (err) {
      errors.push(file.originalname);
    }
  }
  res.json({ success: true, uploaded: uploaded.length, errors: errors.length });
});

router.post('/photo/delete/:id', requireAdmin, async (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  const fs = require('fs');
  if (photo.filename) {
    const filePath = path.join(__dirname, '..', 'uploads', photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  if (photo.cloudinary_id) {
    const cd = require('../utils/cloudinary');
    await cd.deletePhoto(photo.cloudinary_id);
  }
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  res.redirect('/admin/gallery/' + photo.client_id);
});

router.get('/feedback', requireAdmin, (req, res) => {
  const feedback = db.prepare(`
    SELECT f.*, c.name as client_name
    FROM feedback f
    JOIN clients c ON f.client_id = c.id
    ORDER BY f.created_at DESC
  `).all();
  res.render('admin/feedback', { feedback });
});

router.get('/contacts', requireAdmin, (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  res.render('admin/contacts', { contacts });
});

router.post('/contact/delete/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/contacts');
});

module.exports = router;
