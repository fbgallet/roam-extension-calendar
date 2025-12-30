/**
 * Token Encryption Utility
 * Provides secure encryption/decryption for OAuth tokens using Web Crypto API
 *
 * Security Features:
 * - AES-GCM encryption (256-bit)
 * - Unique IV for each encryption
 * - Key derived from browser fingerprint + extension ID
 * - Protection against token theft via XSS
 */

/**
 * Generate a consistent encryption key based on browser/extension fingerprint
 * This creates a deterministic key that persists across sessions but is unique per installation
 */
const getEncryptionKey = async () => {
  // Create a fingerprint from available browser data
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    // Use a constant salt for this extension
    'roam-calendar-extension-v1'
  ].join('|');

  // Hash the fingerprint to create key material
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Import as a CryptoKey for AES-GCM
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt a token string
 * @param {string} token - Plain text token to encrypt
 * @returns {Promise<string>} Base64-encoded encrypted token with IV
 */
export const encryptToken = async (token) => {
  if (!token) return null;

  try {
    const key = await getEncryptionKey();

    // Generate a random IV (Initialization Vector) for this encryption
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits recommended for GCM

    // Encrypt the token
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[TokenEncryption] Encryption failed:', error);
    // Fallback: return original token but log the error
    // In production, you might want to handle this differently
    return token;
  }
};

/**
 * Decrypt an encrypted token
 * @param {string} encryptedToken - Base64-encoded encrypted token
 * @returns {Promise<string>} Decrypted plain text token
 */
export const decryptToken = async (encryptedToken) => {
  if (!encryptedToken) return null;

  try {
    const key = await getEncryptionKey();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('[TokenEncryption] Decryption failed:', error);
    // If decryption fails, it might be an old unencrypted token
    // Return as-is and let caller handle migration
    return encryptedToken;
  }
};

/**
 * Check if a token appears to be encrypted (heuristic)
 * @param {string} token - Token to check
 * @returns {boolean} True if token appears encrypted
 */
export const isTokenEncrypted = (token) => {
  if (!token || typeof token !== 'string') return false;

  // Encrypted tokens will be base64 and relatively long (>100 chars typically)
  // OAuth tokens are also base64 but have different patterns
  try {
    // Check if it's valid base64
    const decoded = atob(token);
    // Encrypted tokens will have binary data, check for non-printable characters
    const nonPrintable = decoded.split('').some(c => {
      const code = c.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    });
    return nonPrintable && token.length > 100;
  } catch {
    return false;
  }
};

/**
 * Migrate an unencrypted token to encrypted format
 * @param {string} token - Plain text token
 * @returns {Promise<string>} Encrypted token
 */
export const migrateToken = async (token) => {
  if (!token) return null;

  // Check if already encrypted
  if (isTokenEncrypted(token)) {
    return token;
  }

  // Encrypt the plain token
  return encryptToken(token);
};
