import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

const uploadDir = path.resolve(__dirname, '../../storage/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage(); // Process file in buffer for hashing & validation

const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      return cb(new Error('INVALID_MIME_TYPE: Only PDF, PNG, and JPEG documents are permitted.'));
    }
    cb(null, true);
  }
});

// Magic bytes validation
export function validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  const hexHeader = buffer.slice(0, 4).toString('hex').toLowerCase();

  if (mimeType === 'application/pdf') {
    // %PDF = 25 50 44 46
    return buffer.slice(0, 4).toString('ascii').startsWith('%PDF');
  }

  if (mimeType === 'image/png') {
    // 89 50 4e 47
    return hexHeader.startsWith('89504e47');
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    // ff d8 ff
    return hexHeader.startsWith('ffd8ff');
  }

  return true;
}

// Compute SHA-256
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
