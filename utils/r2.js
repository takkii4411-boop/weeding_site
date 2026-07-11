const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const https = require('https');
const fs = require('fs');
const path = require('path');

const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  secureProtocol: 'TLSv1_2_method',
  maxSockets: 500,
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({ httpsAgent }),
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

function isConfigured() {
  const configured = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL);
  if (!configured) {
    console.warn('⚠ Cloudflare R2 NOT configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL in .env');
  } else {
    console.log('✓ Cloudflare R2 configured for bucket: ' + BUCKET);
  }
  return configured;
}

async function uploadOriginal(filePath, originalName) {
  const key = `wedding/originals/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fileBuffer = fs.readFileSync(filePath);
  const contentType = getContentType(originalName);

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }));

  const size = fs.statSync(filePath).size;
  return { key, url: `${PUBLIC_URL}/${key}`, size };
}

async function deleteOriginal(key) {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('R2 delete failed:', err.message);
  }
}

async function getStorageUsage() {
  try {
    let totalSize = 0;
    let totalCount = 0;
    let continuationToken = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'wedding/',
        ContinuationToken: continuationToken,
      });
      const response = await r2.send(command);
      if (response.Contents) {
        for (const obj of response.Contents) {
          totalSize += obj.Size || 0;
          totalCount++;
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { totalSize, totalCount, usedMB: (totalSize / (1024 * 1024)).toFixed(2), usedGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2) };
  } catch (err) {
    console.error('R2 storage check failed:', err.message);
    return { totalSize: 0, totalCount: 0, usedMB: '0', usedGB: '0' };
  }
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm',
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = { uploadOriginal, deleteOriginal, getStorageUsage, isConfigured };
