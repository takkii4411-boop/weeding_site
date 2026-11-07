require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/client');
const contactRoutes = require('./routes/contact');
const db = require('./database/db');
const { isConfigured } = require('./utils/cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use(session({
  secret: 'wedding-site-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.currentPath = req.path;
  res.locals.baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  next();
});

app.use('/admin/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/gallery', clientRoutes);
app.use('/api/contact', contactRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  isConfigured();
});
