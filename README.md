# 📱 MughalAuth Discord Bot V1.0.0

A premium, professional, and modular **MughalAuth Seller Admin Control Bot** built in Node.js using `discord.js@v14`. This bot implements a fully compliant, user-friendly plain text interface with dividing line styling (`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`) and Message Components V2 layouts — **completely free of Embeds** for maximum performance and a distinct aesthetic.

---

## 🚀 Key Features

* **Command Cooldowns (Rate Limit Protection)**: Prevents command spamming at the Discord client level with ephemeral V2 countdown alerts.
* **Modular Command Loader**: Slash commands organized neatly in categorised subdirectories:
  * 🖥️ **General**: `/selectapplication`, `/app_stats`, `/adminpanel`, `/ping`
  * 👤 **User Control**: `/create_user`, `/quick_create`, `/delete_user`, `/reset_hwid`, `/user_info`, `/ban_user`, `/pause_user`, `/unpause_user`, `/edit_user`
  * 🔑 **License Keys**: `/create_license`, `/delete_license`, `/ban_license`
* **Hard Limit Controls**: Enforces a generation limit of `10` license keys maximum per single request across slash commands and button modals.
* **Audit Webhook Logs**: Dispatches real-time audit logs of administrative actions to your private Discord logging channel.

---

## 🛠️ Prerequisites

* **Node.js**: `v16.9.0` or higher
* **MughalAuth Self-Hosted Panel**: Active running instance with extended API modifications.

---

## ⚙️ Installation & Configuration

### 1. Clone & Install Dependencies
Download this repository, enter the directory, and install dependencies:
```bash
npm install
```

### 2. Configure Environment variables
Create a `.env` file in the root directory (never commit this to GitHub!) and configure:

```ini
# Discord Bot Secrets
DISCORD_BOT_TOKEN=your_discord_bot_token_here
WEBHOOK_URL=your_discord_logging_webhook_url_here

# Bot Authorization
ALLOWED_ROLE_NAME=Admin

# Bot Cooldown Configuration
COOLDOWN_SECONDS=5

# MughalAuth Seller API Configuration
MUGHALAUTH_API_URL=https://api.mughalxcheat.xyz/api/seller/

# List of applications and their seller keys (Up to 10 applications supported)
APP1_NAME=hello
APP1_SELLER_KEY=5307ad25fa90080aas22e3368b8f6c70
# APP2_NAME=Streamer
# APP2_SELLER_KEY=your_app_2_seller_key
```

### 3. Start the Bot
Run the bot in production mode:
```bash
npm start
```

---

## 🌐 Hosting (24/7 Online)

For high-performance, low latency, and **24/7 online hosting** with zero downtime, we highly recommend using [Obsidian Hosting](https://obsidianhosting.in) to host this Discord bot.

* **Website**: [obsidianhosting.in](https://obsidianhosting.in)
* **Discord Support**: [Join Discord Server](https://discord.gg/jYKh38e3BS)

---

## 🖥️ Panel API Extensions (Required)

To enable `/pause_user`, `/unpause_user`, `/reset_username`, `/edit_user`, and `/app_stats` commands, you **must extend** the seller API script in your self-hosted MughalAuth panel.

Ensure your seller API (`api/seller/index.php`) supports the following request `type` actions:
* `pauseuser`: Pause user subscription.
* `unpauseuser`: Resume user subscription.
* `setusername`: Change username for a user.
* `edituser`: Edit user details (password, email, subscription level, or expiry).
* `appstats`: Return summary statistics of the application.

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
