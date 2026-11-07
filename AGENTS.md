# Wedding Site - Project State

## Tech Stack
- **Backend:** Node.js + Express 5
- **Database:** SQLite (better-sqlite3)
- **Templating:** EJS
- **Email:** Nodemailer
- **Storage:** Cloudinary (25GB free)

## Project Structure
```
server.js                     ← Main entry point (port 3000)
database/db.js                ← SQLite schema + migrations
routes/
├── auth.js                   ← Admin login (admin/admin123)
├── admin.js                  ← Admin panel (clients, upload, gallery, feedback, contacts)
├── client.js                 ← Client gallery (unique token URL)
├── contact.js                ← Contact form API + email
utils/
├── mail.js                   ← Nodemailer email sender
├── cloudinary.js             ← Cloudinary upload + delete
views/
├── admin/                    ← login, dashboard, clients, gallery, feedback, contacts
├── client/gallery.ejs       ← Client-facing gallery page
public/css/admin.css          ← Admin panel styles
data/wedding.db               ← SQLite database (auto-created)
uploads/                      ← Local fallback for photos
.env                          ← Credentials (Cloudinary, SMTP)
```

## Database Tables
| Table | Purpose |
|-------|---------|
| admins | Admin users (default: admin/admin123) |
| clients | Client info + unique gallery_token |
| photos | Photo records (local filename OR cloudinary_id + cloudinary_url) |
| feedback | Client feedback (rating, message) |
| contacts | Contact form submissions |

## Features Built
1. **Admin Panel** - Login-protected dashboard with client management
2. **Client CRUD** - Add/delete clients, auto-generates unique gallery token
3. **Photo Upload** - Each client has own gallery, drag-drop upload, max 50 files. Uploads to Cloudinary first; falls back to local `/uploads/`
4. **Client Gallery** - Private page at `/gallery/{token}`, NOT on main page, with lightbox viewer
5. **Feedback System** - Star rating + message on client gallery page, viewable in admin
6. **Contact Form** - Saves to DB + sends email notification (Nodemailer)
7. **Responsive Admin** - Sidebar navigation with mobile support

## Known Issues
1. **Email sending fails** - SMTP not configured properly in .env (Gmail app password needed)

## Setup Required
1. Cloudinary account: https://cloudinary.com/console → copy CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to .env
2. SMTP credentials for email (Gmail app password)

## Running
```bash
npm start   # starts on http://localhost:3000
```

## Default Admin
- URL: http://localhost:3000/admin/auth/login
- Username: admin
- Password: admin123
