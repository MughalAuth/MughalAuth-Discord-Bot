const {
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const os = require('os');
const path = require('path');

// ═══════════════════════════════════════════════════════
//  SYSTEM UTILITIES
// ═══════════════════════════════════════════════════════

function progress_bar(percentage, length = 10) {
  const filled = Math.max(0, Math.min(length, Math.round(length * (percentage / 100))));
  const empty = length - filled;
  let emojiFilled = '🟩', emojiEmpty = '⬛';
  if (percentage >= 80) { emojiFilled = '🔴'; emojiEmpty = '⚫'; }
  else if (percentage >= 60) { emojiFilled = '🟡'; emojiEmpty = '⚫'; }
  return emojiFilled.repeat(filled) + emojiEmpty.repeat(empty);
}

function get_disk_path() {
  return process.platform === 'win32' ? path.parse(process.cwd()).root : '/';
}

function getCpuAverage() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  let idleMs = 0, totalMs = 0;
  cpus.forEach(core => {
    for (const type in core.times) totalMs += core.times[type];
    idleMs += core.times.idle;
  });
  return { idle: idleMs / cpus.length, total: totalMs / cpus.length };
}

async function getCpuUsage(intervalMs = 200) {
  const start = getCpuAverage();
  await new Promise(resolve => setTimeout(resolve, intervalMs));
  const end = getCpuAverage();
  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;
  const pct = 100 - Math.round(100 * idleDiff / totalDiff);
  return isNaN(pct) ? 0 : pct;
}

// ═══════════════════════════════════════════════════════
//  TIME & TOKEN UTILITIES
// ═══════════════════════════════════════════════════════

/** Returns a short human-readable timestamp string. */
function getTimestamp() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

/** Generates a short random token for confirmation IDs. */
function generateToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ═══════════════════════════════════════════════════════
//  INPUT VALIDATION
// ═══════════════════════════════════════════════════════

function validateUsername(username) {
  if (!username || username.trim().length < 3) return '❌ Username must be at least **3 characters** long.';
  if (username.trim().length > 32) return '❌ Username must be at most **32 characters** long.';
  if (/\s/.test(username)) return '❌ Username **cannot contain spaces**.';
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 1) return '❌ Password must be at least **1 character** long.';
  return null;
}

function validateExpiryDays(days) {
  if (!Number.isInteger(days) || days < 1) return '❌ Expiry must be at least **1 day**.';
  if (days > 3650) return '❌ Expiry cannot exceed **3650 days** (10 years).';
  return null;
}

function validateAmount(amount) {
  if (!Number.isInteger(amount) || amount < 1) return '❌ Amount must be at least **1**.';
  if (amount > 10) return '❌ Maximum **10 licenses** can be generated at a time.';
  return null;
}

// ═══════════════════════════════════════════════════════
//  COMPONENT V2 BUILDERS
// ═══════════════════════════════════════════════════════

/**
 * Core V2 container builder with optional timestamp/app footer.
 * @param {string} title - Header text (shown as ###)
 * @param {string} description - Main markdown content
 * @param {number} accentColor - Hex accent color
 * @param {string|null} footer - Optional subtext (e.g. timestamp + app badge)
 */
function buildV2Container(title, description, accentColor = 0x2f3136, footer = null) {
  const container = new ContainerBuilder().setAccentColor(accentColor);
  const contentText = title ? `### ${title}\n\n${description}` : description;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));
  if (footer) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  }
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  return container;
}

function _footer(app) {
  return app ? `⏱ ${getTimestamp()} • 📱 ${app}` : `⏱ ${getTimestamp()}`;
}

/** Green ✅ success container with auto timestamp+app footer. */
function buildV2Success(title, desc, app = null) {
  return buildV2Container(title, desc, 0x2ecc71, _footer(app));
}

/** Red ❌ error container. */
function buildV2Error(title, desc, app = null) {
  return buildV2Container(title, desc, 0xe74c3c, _footer(app));
}

/** Orange ⚠️ warning container. */
function buildV2Warning(title, desc, app = null) {
  return buildV2Container(title, desc, 0xe67e22, _footer(app));
}

/** Blue ℹ️ info container. */
function buildV2Info(title, desc, app = null) {
  return buildV2Container(title, desc, 0x3498db, _footer(app));
}

/** Purple 🔮 panel/neutral container. */
function buildV2Panel(title, desc, app = null) {
  return buildV2Container(title, desc, 0x9b59b6, _footer(app));
}

/**
 * Confirmation container with ✅ Confirm + ❌ Cancel buttons.
 * @param {string} title
 * @param {string} desc
 * @param {string} confirmId - Button customId for confirm
 * @param {string} cancelId  - Button customId for cancel
 */
function buildV2Confirm(title, desc, confirmId, cancelId) {
  const container = new ContainerBuilder().setAccentColor(0xe67e22);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${title}\n\n${desc}`)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('✅  Confirm').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel('❌  Cancel').setStyle(ButtonStyle.Secondary)
    )
  );
  return container;
}

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════

// MessageFlags.IsComponentsV2 = bit 15 = 32768
// Hardcoded since some discord.js server installs don't expose this yet.
const COMPONENTS_V2 = 1 << 15;

// ═══════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════

module.exports = {
  // System
  progress_bar, get_disk_path, getCpuUsage,
  // Time & Tokens
  getTimestamp, generateToken,
  // Validation
  validateUsername, validatePassword, validateExpiryDays, validateAmount,
  // V2 UI Builders
  buildV2Container, buildV2Success, buildV2Error,
  buildV2Warning, buildV2Info, buildV2Panel, buildV2Confirm,
  // Constants
  COMPONENTS_V2
};
