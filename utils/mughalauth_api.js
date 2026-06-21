const axios = require('axios');
const config = require('../config');

/**
 * Send request to MughalAuth Seller API with specific seller key.
 * @param {object} params API Request query/payload parameters
 * @param {string} seller_key Application seller key
 * @returns {Promise<object>} API JSON response object
 */
async function mughalauth_request(params, seller_key) {
  try {
    const response = await axios.get(config.MUGHALAUTH_API_URL, {
      params: {
        ...params,
        sellerkey: seller_key
      },
      timeout: 10000
    });

    if (typeof response.data === 'string') {
      try {
        return JSON.parse(response.data);
      } catch (err) {
        return { success: false, message: `Invalid JSON response: ${response.data.slice(0, 500)}` };
      }
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        message: `API HTTP Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      };
    } else if (error.request) {
      return { success: false, message: 'No response received from MughalAuth API server.' };
    } else {
      return { success: false, message: `Request Error: ${error.message}` };
    }
  }
}

module.exports = {
  mughalauth_request
};
