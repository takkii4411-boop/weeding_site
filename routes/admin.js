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
    const imageExts = /jpeg|jpg|png|gif|webp/;
    const videoExts = /mp4|mov|avi|mkv|webm/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (imageExts.test(ext) && file.mimetype.startsWith('image/')) return cb(null, true);
    if (videoExts.test(ext) && file.mimetype.startsWith('video/')) return cb(null, true);
    cb(new Error('Only images (jpg, png, gif, webp) and videos (mp4, mov, webm) are allowed'));
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/auth/login');
  next();
}

router.get('/dashboard', requireAdmin, async (req, res) => {
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  const photoCount = db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM feedback').get().count;
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const recentContacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5').all();

  const r2 = require('../utils/r2');
  const cd = require('../utils/cloudinary');
  let r2Usage = { usedMB: '0', usedGB: '0', totalCount: 0 };
  let cdUsage = { usedMB: '0', totalCount: 0 };
  const r2Configured = r2.isConfigured();
  const cdConfigured = cd.isConfigured();

  if (r2Configured) {
    r2Usage = await r2.getStorageUsage();
  }
  if (cdConfigured) {
    try {
      const result = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size FROM photos WHERE cloudinary_url IS NOT NULL').get();
      cdUsage = { usedMB: (result.total_size / (1024 * 1024)).toFixed(2), totalCount: result.count };
    } catch (e) { /* ignore */ }
  }

  res.render('admin/dashboard', { clientCount, photoCount, feedbackCount, contactCount, recentContacts, r2Usage, cdUsage, r2Configured, cdConfigured });
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

router.post('/clients/delete/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const photos = db.prepare('SELECT * FROM photos WHERE client_id = ?').all(id);
  const fs = require('fs');
  const cd = require('../utils/cloudinary');
  const r2 = require('../utils/r2');
  for (const photo of photos) {
    if (photo.filename) {
      const filePath = path.join(__dirname, '..', 'uploads', photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (photo.cloudinary_id) {
      await cd.deletePhoto(photo.cloudinary_id);
    }
    if (photo.r2_key) {
      await r2.deleteOriginal(photo.r2_key);
    }
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ success: true });
  res.redirect('/admin/clients');
});

router.post('/photos/delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No photo IDs provided' });
  }
  const fs = require('fs');
  const cd = require('../utils/cloudinary');
  const r2 = require('../utils/r2');
  let deleted = 0;
  for (const id of ids) {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
    if (!photo) continue;
    if (photo.filename) {
      const filePath = path.join(__dirname, '..', 'uploads', photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (photo.cloudinary_id) {
      await cd.deletePhoto(photo.cloudinary_id);
    }
    if (photo.r2_key) {
      await r2.deleteOriginal(photo.r2_key);
    }
    db.prepare('DELETE FROM photos WHERE id = ?').run(id);
    deleted++;
  }
  res.json({ success: true, deleted });
});

router.get('/gallery/:clientId', requireAdmin, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.clientId);
  if (!client) return res.redirect('/admin/clients');
  const photos = db.prepare('SELECT * FROM photos WHERE client_id = ? ORDER BY uploaded_at DESC').all(client.id);
  res.render('admin/gallery', { client, photos });
});

router.post('/upload/:clientId', requireAdmin, upload.array('photos', 1000), async (req, res) => {
  const clientId = req.params.clientId;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const uploadMode = req.query.upload_mode || 'compressed';
  const cd = require('../utils/cloudinary');
  const r2 = require('../utils/r2');
  const cdConfigured = cd.isConfigured();
  const r2Configured = r2.isConfigured();
  const fs = require('fs');

  const insert = db.prepare(
    'INSERT INTO photos (client_id, filename, original_name, cloudinary_id, cloudinary_url, r2_url, r2_key, file_size, upload_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const errors = [];
  const uploaded = [];

  for (const file of req.files) {
    try {
      let cloudinaryId = null, cloudinaryUrl = null;
      let r2Url = null, r2Key = null;
      let localFilename = file.filename;
      let fileSize = file.size;

      if (uploadMode === 'original') {
        if (r2Configured) {
          try {
            const r2Result = await r2.uploadOriginal(file.path, file.originalname);
            r2Url = r2Result.url;
            r2Key = r2Result.key;
            fileSize = r2Result.size;
          } catch (r2Err) {
            console.error('R2 upload failed:', r2Err.message);
          }
        }
        if (cdConfigured) {
          try {
            const cdResult = await cd.uploadPhoto(file.path, file.originalname);
            cloudinaryId = cdResult.cloudinaryId;
            cloudinaryUrl = cdResult.url;
          } catch (cdErr) {
            console.error('Cloudinary upload failed:', cdErr.message);
          }
        }
      } else {
        if (cdConfigured) {
          try {
            const cdResult = await cd.uploadPhoto(file.path, file.originalname);
            cloudinaryId = cdResult.cloudinaryId;
            cloudinaryUrl = cdResult.url;
            fileSize = file.size;
          } catch (cdErr) {
            console.error('Cloudinary upload failed:', cdErr.message);
          }
        }
      }

      if (!cloudinaryUrl && !r2Url) {
        localFilename = file.filename;
      } else {
        localFilename = '';
      }

      insert.run(clientId, localFilename, file.originalname, cloudinaryId, cloudinaryUrl, r2Url, r2Key, fileSize, uploadMode);

      if ((r2Url || cloudinaryUrl) && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
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
  if (photo.r2_key) {
    const r2 = require('../utils/r2');
    await r2.deleteOriginal(photo.r2_key);
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
