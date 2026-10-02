// Image helpers shared by the profile page and chat window.
// The rules match backend/uploads.js, so users get instant
// feedback instead of waiting for the server to say no.

export const SERVER_URL = 'http://localhost:3000';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

// For <input type="file" accept="...">
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

// Returns an error message, or null if the file is OK.
export function validateImageFile(file: File): string | null {

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only PNG, JPG and GIF images are allowed';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'Images must be 2MB or smaller';
  }

  return null;
}

// The server stores paths like /uploads/chat/x.png;
// turn them into full URLs for <img src>.
export function imageSrc(url: string | null | undefined): string | null {
  return url ? `${SERVER_URL}${url}` : null;
}
