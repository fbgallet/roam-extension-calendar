/**
 * CSRF Protection Utility
 * Generates and validates state tokens for OAuth flows to prevent CSRF attacks
 */

const CSRF_STATE_KEY = 'oauth-csrf-state';
const CSRF_STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographically secure random state token
 * @returns {string} Random state token (base64 encoded)
 */
export const generateCSRFToken = () => {
  const randomBytes = new Uint8Array(32); // 256 bits of randomness
  crypto.getRandomValues(randomBytes);

  // Convert to base64 for URL safety
  const base64 = btoa(String.fromCharCode(...randomBytes));

  // Make URL-safe by replacing + and / characters
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Store the CSRF state token with timestamp for validation
 * @param {string} state - State token to store
 */
export const storeCSRFToken = (state) => {
  const data = {
    token: state,
    timestamp: Date.now(),
  };

  sessionStorage.setItem(CSRF_STATE_KEY, JSON.stringify(data));

  console.log('[CSRF] State token generated and stored');
};

/**
 * Validate and consume the CSRF state token
 * @param {string} receivedState - State token received from OAuth callback
 * @returns {boolean} True if token is valid and not expired
 */
export const validateCSRFToken = (receivedState) => {
  try {
    const stored = sessionStorage.getItem(CSRF_STATE_KEY);

    if (!stored) {
      console.error('[CSRF] No stored state token found');
      return false;
    }

    const data = JSON.parse(stored);

    // Check if token has expired
    const age = Date.now() - data.timestamp;
    if (age > CSRF_STATE_EXPIRY) {
      console.error('[CSRF] State token has expired');
      sessionStorage.removeItem(CSRF_STATE_KEY);
      return false;
    }

    // Validate the token matches
    if (data.token !== receivedState) {
      console.error('[CSRF] State token mismatch - possible CSRF attack!');
      return false;
    }

    // Token is valid - consume it (one-time use)
    sessionStorage.removeItem(CSRF_STATE_KEY);
    console.log('[CSRF] ✓ State token validated successfully');

    return true;
  } catch (error) {
    console.error('[CSRF] Error validating state token:', error);
    return false;
  }
};

/**
 * Clear any expired or orphaned CSRF tokens
 */
export const clearExpiredCSRFTokens = () => {
  try {
    const stored = sessionStorage.getItem(CSRF_STATE_KEY);
    if (!stored) return;

    const data = JSON.parse(stored);
    const age = Date.now() - data.timestamp;

    if (age > CSRF_STATE_EXPIRY) {
      sessionStorage.removeItem(CSRF_STATE_KEY);
      console.log('[CSRF] Cleared expired state token');
    }
  } catch (error) {
    // If there's any error reading/parsing, just clear it
    sessionStorage.removeItem(CSRF_STATE_KEY);
  }
};
