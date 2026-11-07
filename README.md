# weeding_site — Wedding Site (SQLite + Local Uploads)

![Node](https://img.shields.io/badge/Node-20.x-green) ![Express](https://img.shields.io/badge/Express-5-blue) ![DB](https://img.shields.io/badge/better--sqlite3-native-red)

Cinematic wedding portfolio — is version me **better-sqlite3 + sharp** (fast native DB + image processing) with **local uploads** folder instead of external storage.

## What it offers

- 🎨 Portfolio + galleries (public `/gallery`)
- ✍️ Admin panel `/admin` (auth protected)
- 📨 Contact form `/api/contact` + SMTP email notify
- 🗂 Local media (`uploads/`, `images/`) served statically
- ⚡ sharp-based image pipeline

## Install

**Requirement:** Node **20.x** (engines pinned)

```bash
git clone https://github.com/takkii4411-boop/weeding_site.git
cd weeding_site
npm install          # postinstall: better-sqlite3 + sharp rebuild
node server.js
```

Open → **http://localhost:3000**

### Configuration (`.env`)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFY_EMAIL=admin@example.com
SESSION_SECRET=<long-random>
```

DB file project ke `data/` me auto-create hota hai (better-sqlite3 native).

## Usage manual

### Visitor

| URL | What |
|---|---|
| `/` | portfolio home |
| `/gallery` | client gallery listing |
| `/api/contact` (POST) | inquiry (SMTP optional) |

### Admin

| URL | What |
|---|---|
| `/admin` | dashboard (login protected) |
| `/admin/auth/login` | session auth |

Uploads `/uploads` se publicly serve hote hain (planning ke hero/gallery images yahan daal sakte ho).

## Structure

```
weeding_site/
├── server.js
├── routes/ (admin, auth, client, contact)
├── views/ (client/ admin/, EJS)
├── public/ uploads/ images/
├── database/ utils/
└── package.json
```

## License

ISC
