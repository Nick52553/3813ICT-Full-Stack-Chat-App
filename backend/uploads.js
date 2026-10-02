const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// ====================================================
// IMAGE UPLOADS
// ====================================================
// Images are saved as files under backend/uploads/ and
// served at /uploads/... MongoDB only stores the URL,
// which keeps documents small and queries fast.

const UPLOAD_DIR = path.join(__dirname, 'uploads');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

// Allowed types, checked against the file's first bytes
// ("magic numbers"), not just its name or the browser's
// claim - so a renamed .exe can't get through.
const IMAGE_SIGNATURES = [
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] } // "GIF8"
];

function detectImageType(buffer) {

  const match = IMAGE_SIGNATURES.find(signature =>
    buffer.length >= signature.bytes.length &&
    signature.bytes.every((byte, i) => buffer[i] === byte)
  );

  return match ? match.ext : null;
}

// Keep uploads in memory until they've been checked, so
// nothing invalid ever touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1
  }
});

// Express middleware that accepts one image in `fieldName`
// and turns upload problems into friendly 400 responses.
function singleImage(fieldName) {

  const handler = upload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, error => {

      if (!error) {
        return next();
      }

      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Images must be 2MB or smaller'
          : error.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Upload the image in the "${fieldName}" field`
            : 'Could not read the uploaded file';

      res.status(400).json({ message });
    });
  };
}

// Check an uploaded file and write it to uploads/<folder>/.
// Returns { url } or { error }.
async function saveImage(file, folder) {

  if (!file) {
    return { error: 'No image was uploaded' };
  }

  const ext = detectImageType(file.buffer);

  if (!ext) {
    return { error: 'Only PNG, JPG and GIF images are allowed' };
  }

  // Random name: no clashes, and nothing from the
  // user's filename ends up on disk.
  const name = `${crypto.randomUUID()}.${ext}`;

  const dir = path.join(UPLOAD_DIR, folder);

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, name), file.buffer);

  return { url: `/uploads/${folder}/${name}` };
}

// Delete a file previously returned by saveImage.
// Ignores anything outside the uploads folder.
async function deleteImage(url) {

  if (typeof url !== 'string' || !url.startsWith('/uploads/')) {
    return;
  }

  const filePath = path.join(UPLOAD_DIR, url.slice('/uploads/'.length));

  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return;
  }

  await fs.promises.unlink(filePath).catch(() => {});
}

module.exports = {
  UPLOAD_DIR,
  MAX_IMAGE_BYTES,
  singleImage,
  saveImage,
  deleteImage,
  detectImageType
};
