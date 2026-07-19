import 'server-only';

import crypto from 'node:crypto';
import { envValue } from './env';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

export function isR2Configured() {
  return Boolean(
    envValue('R2_ACCOUNT_ID') &&
      envValue('R2_BUCKET_NAME') &&
      envValue('R2_ACCESS_KEY_ID') &&
      envValue('R2_SECRET_ACCESS_KEY')
  );
}

export async function r2PutObject(key, body, contentType = 'application/octet-stream') {
  const accountId = envValue('R2_ACCOUNT_ID');
  const bucket = envValue('R2_BUCKET_NAME');
  const accessKeyId = envValue('R2_ACCESS_KEY_ID');
  const secretAccessKey = envValue('R2_SECRET_ACCESS_KEY');
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const canonicalUri = `/${bucket}/${encodedKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const payloadHash = sha256Hex(body);

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Content-Type': contentType
    },
    body,
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 upload failed: HTTP ${response.status} ${text.slice(0, 200)}`);
  }
  return key;
}
