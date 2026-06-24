# 📋 Changelog

All notable changes to **MughalAuth Discord Bot** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [v1.2.0] — 2026-06-24

### 🆕 Added — New Commands

| Command | Description |
|---------|-------------|
| `/unban_user` | Unban a previously banned user (with autocomplete) |
| `/list_users` | List all users with `all / active / banned` filter |
| `/extend_expiry` | Extend a user's subscription by N days (smart: extends from now if already expired) |
| `/unban_license` | Unban a previously banned license key |
| `/list_licenses` | List all keys with `all / used / unused / banned` filter |

### 🆕 Added — Admin Panel Overhaul

- **19-button, 4-row** redesigned admin panel replacing the old 6-button layout
- Row 1 — License Operations: Gen License, Ban Key, Unban Key, Del Key, List Keys
- Row 2 — User Management: Create User, Quick Create, List Users, User Info, App Stats
- Row 3 — Account Actions: Edit User, Extend Expiry, HWID Reset, Rename, Pause
- Row 4 — Danger Zone: Unpause, Ban User, Unban User, Delete User
- All new panel buttons (Edit User, Extend Expiry, Rename, Pause, Unpause, Unban User, Ban Key, Unban Key, Del Key) now supported with full modal handlers

### 🆕 Added — Confirmation Dialogs

Destructive actions now require confirmation before executing:
- `/ban_user` — ⚠️ Confirm → 🔨 Ban / ❌ Cancel
- `/delete_user` — ⚠️ Confirm → 🗑️ Delete / ❌ Cancel
- `/ban_license` — ⚠️ Confirm → 🔨 Ban / ❌ Cancel
- `/delete_license` — ⚠️ Confirm → 🗑️ Delete / ❌ Cancel
- Admin Panel equivalents all share the same confirmation system
- Confirmations **automatically expire after 30 seconds**

### 🆕 Added — Autocomplete on Username Fields

The following commands now show live username suggestions while you type:
`/ban_user`, `/delete_user`, `/edit_user`, `/reset_hwid`, `/reset_username`,
`/pause_user`, `/unpause_user`, `/user_info`, `/unban_user`, `/extend_expiry`

- User list fetched from API and **cached per-app for 2 minutes**
- Cache auto-invalidated after any create / delete / ban / unban action
- Up to 25 suggestions shown, filtered by typed prefix
- Banned users shown with a 🚫 badge in autocomplete results

### 🆕 Added — Persistent App Selection

- Selected application is now **saved to disk** (`data/userSelections.json`)
- Selections survive bot restarts — users don't need to re-select after downtime
- `data/` directory and JSON file are **auto-created** on first run — no manual setup

### 🆕 Added — Input Validation

| Field | Validation Rule |
|-------|----------------|
| Username | 3–32 characters, no spaces |
| Password | Minimum 6 characters |
| Expiry Days | 1 to 3650 (10 years max) |
| License Amount | 1 to 10 per generation |

### ✨ Improved — UI & Visual Upgrades

- **6 color-coded V2 container presets**:
  - 🟢 `buildV2Success` — Green (created, unban, reset)
  - 🔴 `buildV2Error` — Red (failures, bans)
  - 🟠 `buildV2Warning` — Orange (warnings, pause)
  - 🔵 `buildV2Info` — Blue (lists, lookups)
  - 🟣 `buildV2Panel` — Purple (admin panel, stats)
  - 🟠 `buildV2Confirm` — Orange + action buttons
- Every response now shows a **timestamp + active app footer**: `⏱ 24 Jun 2026, 14:55 • 📱 MyApp`
- `/user_info` upgraded — shows account status (✅ Active / ⏰ Expired / 🚫 Banned), creation date, last login, expiry with warning indicator
- `/create_license` now shows single key in a code block for easy copying
- `/selectapplication` shows current selection with a default option pre-selected
- `/ping` shows active app and per-resource status badges

### ✨ Improved — Architecture

- `utils/persistence.js` — **NEW** utility module for disk-based key/value storage
- `utils/mughalauth_api.js` — Added `getCachedUsers()` and `invalidateUserCache()` exports
- `utils/helpers.js` — **Fully rewritten**: new presets, validation utils, `generateToken()`, `getTimestamp()`
- `index.js` — **Rebuilt**: added autocomplete handler, confirmation button handler, 8 new modal handlers, unified webhook logging, persistence sync on startup

---

## [v1.1.0] — 2026-06-23

### 🔧 Fixed — Discord.js V14 Component Compatibility

- Fixed `CombinedError` crash: `ButtonBuilder` and `ThumbnailBuilder` instance validation failures inside `SectionBuilder`
- Fixed `Invalid Form Body` error: Discord rejected `components[0].type` — replaced unsupported `SectionBuilder` layout with flat `ContainerBuilder` + `TextDisplayBuilder` structure
- Fixed `MessageFlags.IsComponentsV2` being `undefined` on some library versions — replaced with hardcoded bitwise constant `1 << 15` (= `32768`)
- Fixed `setStyle(undefined)` crash in `adminpanel.js` button builder

### ✨ Improved

- Full migration of all 12 command files to stable Component V2 (`ContainerBuilder`) layout
- Unified `buildV2Container()` helper introduced in `utils/helpers.js`
- Removed all `EmbedBuilder` usage across the codebase

---

## [v1.0.0] — Initial Release

### 🎉 Features

- Modular slash command loader (General / User / License categories)
- Admin panel with 6 modal-based action buttons
- MughalAuth Seller API integration
- Role-based authorization (`ALLOWED_ROLE_NAME`)
- Per-user app selection via `/selectapplication`
- Audit webhook logging for all actions
- Command cooldown (rate limit) protection
- Component V2 (no-embed) UI layout

### Commands

- **General**: `/adminpanel`, `/selectapplication`, `/app_stats`, `/ping`
- **User**: `/create_user`, `/quick_create`, `/delete_user`, `/ban_user`, `/reset_hwid`, `/user_info`, `/pause_user`, `/unpause_user`, `/edit_user`, `/reset_username`
- **License**: `/create_license`, `/ban_license`, `/delete_license`
