const cloudinary = require('cloudinary').v2;

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
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'wedding',
    public_id: Date.now() + '-' + originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_'),
    resource_type: 'image'
  });
  return {
    cloudinaryId: result.public_id,
    url: result.secure_url,
    originalName
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
