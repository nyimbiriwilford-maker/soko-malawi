// src/lib/r2.js
const ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID;
const ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const BUCKET = import.meta.env.VITE_R2_BUCKET;
const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

const S3_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function getSignedHeaders(method, key, contentType = '') {
  const url = `${S3_ENDPOINT}/${BUCKET}/${key}`;
  const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${ACCOUNT_ID}.r2.cloudflarestorage.com\n` +
    `x-amz-date:${datetime}\n`;

  const signedHeaders = 'content-type;host;x-amz-date';

  const canonicalRequest = [
    method,
    `/${BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const credentialScope = `${date}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(SECRET_ACCESS_KEY, date);
  const signature = await hmacHex(signingKey, stringToSign);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url, datetime, authorization };
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key, message) {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
}

async function hmacHex(key, message) {
  const buf = await hmac(key, message);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSigningKey(secret, date) {
  const kDate = await hmac(`AWS4${secret}`, date);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

// Upload a file to R2
// Compress an image before upload
async function compressImage(file, maxWidth = 1200, quality = 0.78) {
  if (!file.type.startsWith('image/')) return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })),
        'image/webp',
        quality
      )
    }
    img.src = url
  })
}

// Upload a file to R2
export async function uploadToR2(file, path, onProgress = null) {
  if (file.type.startsWith('image/')) {
    file = await compressImage(file)
    path = path.replace(/\.\w+$/, '.webp')
  }
  const { url, datetime, authorization } = await getSignedHeaders('PUT', path, file.type);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('x-amz-date', datetime)
    xhr.setRequestHeader('Authorization', authorization)
    xhr.setRequestHeader('x-amz-content-sha256', 'UNSIGNED-PAYLOAD')
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(getR2Url(path))
      else reject(new Error(`R2 upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('R2 upload failed: network error'))
    xhr.send(file)
  })
}

// Delete a file from R2
export async function deleteFromR2(path) {
  const { url, datetime, authorization } = await getSignedHeaders('DELETE', path);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': '',
      'x-amz-date': datetime,
      Authorization: authorization,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    },
  });

  if (!res.ok) throw new Error(`R2 delete failed: ${res.status}`);
}

// Get public URL for a file
export function getR2Url(path) {
  return `${PUBLIC_URL}/${path}`;
}