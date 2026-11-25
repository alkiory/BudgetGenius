import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Encrypted-at-rest storage for provider credentials (Finny's keys).
 *
 * Unlike the `bg_live_` API keys, a provider key must be usable in cleartext
 * when calling the provider, so hashing is not an option. It is sealed with
 * AES-256-GCM using a key derived from the server's secret, and only the
 * superadmin endpoints ever decrypt it back.
 *
 * `PROVIDER_KEYS_SECRET` is optional: deployments that already carry a strong
 * `JWT_SECRET` keep working. Rotating that secret invalidates stored provider
 * keys, which then have to be re-entered in the backoffice.
 */
const VERSION = 'v1';

function encryptionKey(): Buffer {
  const secret = (
    process.env.PROVIDER_KEYS_SECRET ||
    process.env.JWT_SECRET ||
    ''
  ).trim();
  if (!secret) {
    throw new Error(
      'PROVIDER_KEYS_SECRET or JWT_SECRET is required to store provider keys',
    );
  }
  return createHash('sha256').update(secret).digest();
}

export function sealSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Returns `null` when the payload was sealed with another secret. */
export function openSecret(payload: string): string | null {
  try {
    const [version, iv, tag, ciphertext] = payload.split(':');
    if (version !== VERSION) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** Last four characters, for the list view without revealing the secret. */
export function lastFour(value: string): string {
  return value.slice(-4);
}
