require('dotenv').config();

const config = {
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  ALLOWED_ROLE_NAME: process.env.ALLOWED_ROLE_NAME || 'Admin',
  MUGHALAUTH_API_URL: process.env.MUGHALAUTH_API_URL || 'https://api.mughalxcheat.xyz/api/seller/',
  COOLDOWN_SECONDS: parseInt(process.env.COOLDOWN_SECONDS) || 5,
  APPLICATIONS: {},
  DEFAULT_APP: null
};

// Parse up to 10 applications from process.env
for (let i = 1; i <= 10; i++) {
  const name = process.env[`APP${i}_NAME`];
  const key = process.env[`APP${i}_SELLER_KEY`];
  if (name && key) {
    config.APPLICATIONS[name] = key;
  }
}

// Find default application (first key in parsed apps)
const appNames = Object.keys(config.APPLICATIONS);
if (appNames.length > 0) {
  config.DEFAULT_APP = appNames[0];
}

module.exports = config;
