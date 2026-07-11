const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function isConfigured() {
  const configured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (!configured) {
    console.warn('⚠ Cloudinary NOT configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env or Render env vars.');
  } else {
    console.log('✓ Cloudinary configured for cloud: ' + process.env.CLOUDINARY_CLOUD_NAME);
  }
  return configured;
}

async function uploadPhoto(filePath, originalName) {
  const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(originalName);
  const ext = path.extname(originalName).toLowerCase();
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(ext);
  let uploadPath = filePath;

  if (isImage) {
    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024) {
      console.log(`Compressing ${originalName} (${(stat.size / 1024 / 1024).toFixed(1)}MB) for Cloudinary...`);
      const compressedPath = filePath + '.compressed.jpg';
      await sharp(filePath)
        .resize(4000, 4000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(compressedPath);
      uploadPath = compressedPath;
      console.log(`Compressed to ${(fs.statSync(compressedPath).size / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  const result = await cloudinary.uploader.upload(uploadPath, {
    folder: 'wedding',
    public_id: Date.now() + '-' + originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_'),
    resource_type: isVideo ? 'video' : 'image'
  });

  if (uploadPath !== filePath && fs.existsSync(uploadPath)) {
    fs.unlinkSync(uploadPath);
  }

  return {
    cloudinaryId: result.public_id,
    url: result.secure_url,
    originalName,
    isVideo
  };
}

async function deletePhoto(cloudinaryId) {
  try {
    await cloudinary.uploader.destroy(cloudinaryId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
}

module.exports = { uploadPhoto, deletePhoto, isConfigured };
