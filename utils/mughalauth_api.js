const axios = require('axios');
const config = require('../config');

// ─────────────── User Cache (for autocomplete) ───────────────
const _userCache = new Map(); // appName → { users: [], timestamp: number }
const _CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Send a request to the MughalAuth Seller API.
 * @param {object} params  API query parameters
 * @param {string} seller_key  Application seller key
 * @returns {Promise<object>} Parsed JSON response
 */
async function mughalauth_request(params, seller_key) {
  try {
    const response = await axios.get(config.MUGHALAUTH_API_URL, {
      params: { ...params, sellerkey: seller_key },
      timeout: 10000
    });
    if (typeof response.data === 'string') {
      try {
        return JSON.parse(response.data);
      } catch (err) {
        return { success: false, message: `Invalid JSON: ${response.data.slice(0, 500)}` };
      }
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      return { success: false, message: `API HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` };
    } else if (error.request) {
      return { success: false, message: 'No response from MughalAuth API server.' };
    } else {
      return { success: false, message: `Request Error: ${error.message}` };
    }
  }
}

/**
 * Fetch user list for an app, with 2-minute in-memory cache.
 * Used for autocomplete in slash commands.
 * @param {string} sellerKey  Seller key for the app
 * @param {string} appName  Name of the app (cache key)
 * @returns {Promise<Array>} Array of user objects
 */
async function getCachedUsers(sellerKey, appName) {
  const cached = _userCache.get(appName);
  if (cached && (Date.now() - cached.timestamp) < _CACHE_TTL) {
    return cached.users;
  }
  const result = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);
  if (result.success && Array.isArray(result.users)) {
    _userCache.set(appName, { users: result.users, timestamp: Date.now() });
    return result.users;
  }
  return [];
}

/**
 * Invalidate the user cache for an app (call after create/delete/ban).
 * @param {string} appName
 */
function invalidateUserCache(appName) {
  _userCache.delete(appName);
}

module.exports = { mughalauth_request, getCachedUsers, invalidateUserCache };
