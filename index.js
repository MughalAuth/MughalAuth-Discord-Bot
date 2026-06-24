const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  WebhookClient,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { mughalauth_request, getCachedUsers, invalidateUserCache } = require('./utils/mughalauth_api');
const {
  buildV2Container, buildV2Success, buildV2Error, buildV2Warning, buildV2Info, buildV2Panel,
  buildV2Confirm, generateToken, COMPONENTS_V2
} = require('./utils/helpers');
const persistence = require('./utils/persistence');

// ═══════════════════════════════════════════════════════
//  CLIENT SETUP
// ═══════════════════════════════════════════════════════

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();
client.userSelectedApps = {};
client.pendingConfirms = new Map(); // token → pending confirm data

// Load persisted app selections
persistence.load();
const savedSelections = persistence.getAllSelections();
for (const [userId, appName] of Object.entries(savedSelections)) {
  client.userSelectedApps[userId] = appName;
}

// ═══════════════════════════════════════════════════════
//  WEBHOOK SETUP
// ═══════════════════════════════════════════════════════

const webhookClient = config.WEBHOOK_URL ? new WebhookClient({ url: config.WEBHOOK_URL }) : null;

client.sendWebhook = async (container) => {
  if (!webhookClient) return;
  try {
    await webhookClient.send({ components: [container], flags: COMPONENTS_V2 });
  } catch (err) {
    console.error(`❌ Webhook send failed: ${err.message}`);
  }
};

// ═══════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

function isAuthorized(member) {
  if (!member) return false;
  return member.roles.cache.some(role => role.name === config.ALLOWED_ROLE_NAME);
}

function getActiveApp(userId) {
  return client.userSelectedApps[userId] || config.DEFAULT_APP || null;
}

const authErrorContainer = buildV2Error(
  '🔒 Access Denied',
  `You need the \`${config.ALLOWED_ROLE_NAME}\` role to use this bot.`
);

const noAppContainer = buildV2Warning(
  '📱 No Application Selected',
  'Please select an application first using `/selectapplication`!'
);

// ═══════════════════════════════════════════════════════
//  COMMAND LOADING
// ═══════════════════════════════════════════════════════

const commandsData = [];
const commandsFolders = fs.readdirSync(path.join(__dirname, 'commands'));

for (const folder of commandsFolders) {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', folder, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
    }
  }
}

// ═══════════════════════════════════════════════════════
//  MODAL BUILDERS  (used in button handler)
// ═══════════════════════════════════════════════════════

function buildCreateLicenseModal() {
  const m = new ModalBuilder().setCustomId('modal_create_license').setTitle('🔑 Generate License Key(s)');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lvl').setLabel('License level').setValue('default').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('expiry_days').setLabel('Expiry duration (Days)').setValue('30').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Number of licenses (max 10)').setValue('1').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('format').setLabel('License format').setValue('XXXXX-XXXXX-XXXXX-XXXXX').setStyle(TextInputStyle.Short).setRequired(true))
  );
  return m;
}

function buildCreateUserModal() {
  const m = new ModalBuilder().setCustomId('modal_create_user').setTitle('👤 Create New User');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username (3-32 chars, no spaces)').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('password').setLabel('Password (min 6 chars)').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('email').setLabel('Email (optional)').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subscription').setLabel('Subscription level').setValue('default').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('expiry_days').setLabel('Expiry (Days)').setValue('30').setStyle(TextInputStyle.Short).setRequired(true))
  );
  return m;
}

function buildQuickCreateModal() {
  const m = new ModalBuilder().setCustomId('modal_quick_create').setTitle('⚡ Quick Create User');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('expiry_days').setLabel('Expiry (Days)').setValue('30').setStyle(TextInputStyle.Short).setRequired(true))
  );
  return m;
}

function buildResetHwidModal() {
  const m = new ModalBuilder().setCustomId('modal_reset_hwid').setTitle('🔄 Reset HWID');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildUserInfoModal() {
  const m = new ModalBuilder().setCustomId('modal_user_info').setTitle('🔍 User Info Lookup');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to look up').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildEditUserModal() {
  const m = new ModalBuilder().setCustomId('modal_edit_user').setTitle('✏️ Edit User');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_password').setLabel('New Password (leave blank = no change)').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_subscription').setLabel('New Subscription (leave blank = no change)').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_expiry_days').setLabel('New Expiry Days from now (0 = no change)').setValue('0').setStyle(TextInputStyle.Short).setRequired(false))
  );
  return m;
}

function buildExtendExpiryModal() {
  const m = new ModalBuilder().setCustomId('modal_extend_expiry').setTitle('➕ Extend User Expiry');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('days').setLabel('Days to extend').setValue('30').setStyle(TextInputStyle.Short).setRequired(true))
  );
  return m;
}

function buildResetUsernameModal() {
  const m = new ModalBuilder().setCustomId('modal_reset_username').setTitle('🔤 Change Username');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('current_username').setLabel('Current Username').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_username').setLabel('New Username').setStyle(TextInputStyle.Short).setRequired(true))
  );
  return m;
}

function buildPauseUserModal() {
  const m = new ModalBuilder().setCustomId('modal_pause_user').setTitle('⏸️ Pause User');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to pause').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildUnpauseUserModal() {
  const m = new ModalBuilder().setCustomId('modal_unpause_user').setTitle('▶️ Unpause User');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to unpause').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildBanUserModal() {
  const m = new ModalBuilder().setCustomId('modal_ban_user').setTitle('🔨 Ban User');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to ban').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setValue('Banned via Admin Panel').setStyle(TextInputStyle.Short).setRequired(false))
  );
  return m;
}

function buildUnbanUserModal() {
  const m = new ModalBuilder().setCustomId('modal_unban_user').setTitle('🔓 Unban User');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to unban').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildDeleteUserModal() {
  const m = new ModalBuilder().setCustomId('modal_delete_user').setTitle('🗑️ Delete User');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Username to permanently delete').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildBanLicenseModal() {
  const m = new ModalBuilder().setCustomId('modal_ban_license').setTitle('🔨 Ban License Key');
  m.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('license_key').setLabel('License Key').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setValue('Banned via Admin Panel').setStyle(TextInputStyle.Short).setRequired(false))
  );
  return m;
}

function buildUnbanLicenseModal() {
  const m = new ModalBuilder().setCustomId('modal_unban_license').setTitle('🔓 Unban License Key');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('license_key').setLabel('License Key to unban').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

function buildDeleteLicenseModal() {
  const m = new ModalBuilder().setCustomId('modal_delete_license').setTitle('🗑️ Delete License Key');
  m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('license_key').setLabel('License Key to permanently delete').setStyle(TextInputStyle.Short).setRequired(true)));
  return m;
}

// ═══════════════════════════════════════════════════════
//  CONFIRMATION HELPER
// ═══════════════════════════════════════════════════════

function createPendingConfirm(interaction, action, data) {
  const token = generateToken();
  const confirmId = `mughal_confirm_${token}`;
  const cancelId = `mughal_cancel_${token}`;

  const timeoutHandle = setTimeout(async () => {
    client.pendingConfirms.delete(token);
    try {
      await interaction.editReply({
        components: [buildV2Warning('⏱ Confirmation Expired', 'This confirmation has timed out. Please run the command again.')],
        flags: COMPONENTS_V2
      });
    } catch (_) {}
  }, 30_000);

  client.pendingConfirms.set(token, { action, ...data, _timeout: timeoutHandle, _userId: interaction.user.id, _userTag: interaction.user.displayName });

  return { confirmId, cancelId };
}

// ═══════════════════════════════════════════════════════
//  CONFIRMATION BUTTON HANDLER
// ═══════════════════════════════════════════════════════

async function handleConfirmButton(interaction) {
  const isConfirm = interaction.customId.startsWith('mughal_confirm_');
  const token = isConfirm
    ? interaction.customId.slice('mughal_confirm_'.length)
    : interaction.customId.slice('mughal_cancel_'.length);

  const pending = client.pendingConfirms.get(token);

  if (!pending) {
    return interaction.update({
      components: [buildV2Warning('⏱ Expired', 'This confirmation already expired or was already used. Run the command again.')],
      flags: COMPONENTS_V2
    });
  }

  clearTimeout(pending._timeout);
  client.pendingConfirms.delete(token);

  if (!isConfirm) {
    return interaction.update({
      components: [buildV2Info('❌ Cancelled', 'Action cancelled. No changes were made.')],
      flags: COMPONENTS_V2
    });
  }

  await interaction.deferUpdate();

  const { action, sellerKey, selectedApp } = pending;
  let result, container;

  if (action === 'delete_user') {
    result = await mughalauth_request({ type: 'deluser', user: pending.username }, sellerKey);
    container = result.success
      ? buildV2Success('🗑️ User Deleted', `**${pending.username}** has been permanently deleted from **${selectedApp}**.`, selectedApp)
      : buildV2Error('❌ Deletion Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp);
    if (result.success) invalidateUserCache(selectedApp);

  } else if (action === 'delete_license') {
    result = await mughalauth_request({ type: 'delkey', key: pending.licenseKey }, sellerKey);
    container = result.success
      ? buildV2Success('🗑️ License Deleted', `Key \`${pending.licenseKey}\` permanently deleted from **${selectedApp}**.`, selectedApp)
      : buildV2Error('❌ Delete Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp);

  } else if (action === 'ban_user') {
    result = await mughalauth_request({ type: 'banuser', user: pending.username, reason: pending.reason }, sellerKey);
    container = result.success
      ? buildV2Error('🔨 User Banned', `**${pending.username}** has been banned from **${selectedApp}**.\n• **Reason:** \`${pending.reason}\``, selectedApp)
      : buildV2Error('❌ Ban Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp);
    if (result.success) invalidateUserCache(selectedApp);

  } else if (action === 'ban_license') {
    result = await mughalauth_request({ type: 'ban', key: pending.licenseKey, reason: pending.reason }, sellerKey);
    container = result.success
      ? buildV2Error('🔨 License Banned', `Key \`${pending.licenseKey}\` banned from **${selectedApp}**.\n• **Reason:** \`${pending.reason}\``, selectedApp)
      : buildV2Error('❌ Ban Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp);
  }

  if (container) {
    await interaction.editReply({ components: [container], flags: COMPONENTS_V2 });
  }

  if (result?.success && webhookClient) {
    const actionLabels = { delete_user: 'User Deleted 🗑️', delete_license: 'License Deleted 🗑️', ban_user: 'User Banned 🔨', ban_license: 'License Banned 🔨' };
    const target = pending.username ? `**User:** ${pending.username}` : `**Key:** \`${pending.licenseKey}\``;
    const wDesc = `• **By:** ${pending._userTag} (${pending._userId})\n• ${target}\n• **App:** ${selectedApp}${pending.reason ? `\n• **Reason:** ${pending.reason}` : ''}`;
    await client.sendWebhook(buildV2Warning(`⚠️ ${actionLabels[action] || action}`, wDesc));
  }
}

// ═══════════════════════════════════════════════════════
//  READY EVENT
// ═══════════════════════════════════════════════════════

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
    console.log(`✅ Registered ${commandsData.length} slash commands globally.`);
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
});

// ═══════════════════════════════════════════════════════
//  INTERACTION HANDLER
// ═══════════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {

  // ── 0. Autocomplete ──────────────────────────────────
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction, client); }
      catch (e) { console.error('Autocomplete error:', e); await interaction.respond([]).catch(() => {}); }
    }
    return;
  }

  // ── 1. Slash Commands ────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ components: [authErrorContainer], flags: COMPONENTS_V2, ephemeral: true });
    }

    // Cooldown
    const now = Date.now();
    const cooldownAmount = (command.cooldown || config.COOLDOWN_SECONDS || 5) * 1000;
    const timestamps = (client.cooldowns = client.cooldowns || new Collection()).get(interaction.user.id) || new Map();
    if (timestamps.has(command.data.name)) {
      const expirationTime = timestamps.get(command.data.name) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        const c = buildV2Warning('⏳ Cooldown Active', `Please wait **${timeLeft}s** before reusing \`/${command.data.name}\`.`);
        return interaction.reply({ components: [c], flags: COMPONENTS_V2, ephemeral: true });
      }
    }
    timestamps.set(command.data.name, now);
    client.cooldowns.set(interaction.user.id, timestamps);

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error('Command execute error:', error);
      const errResp = { content: 'An error occurred while running this command!', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(errResp);
      else await interaction.reply(errResp);
    }
    return;
  }

  // ── 2. Select Menu — App Selection ───────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_app_dropdown') {
      if (!isAuthorized(interaction.member)) {
        return interaction.reply({ components: [authErrorContainer], flags: COMPONENTS_V2, ephemeral: true });
      }
      const selectedApp = interaction.values[0];
      client.userSelectedApps[interaction.user.id] = selectedApp;
      persistence.setUserApp(interaction.user.id, selectedApp);

      const c = buildV2Success('✅ Application Selected', `**${selectedApp}** is now your active application.`, selectedApp);
      await interaction.reply({ components: [c], flags: COMPONENTS_V2, ephemeral: true });

      await client.sendWebhook(buildV2Info('📱 App Selected',
        `• **User:** ${interaction.user.displayName} (${interaction.user.id})\n• **Selected App:** \`${selectedApp}\``
      ));
    }
    return;
  }

  // ── 3. Button Interactions ────────────────────────────
  if (interaction.isButton()) {
    // 3a. Confirmation buttons (no auth needed)
    if (interaction.customId.startsWith('mughal_confirm_') || interaction.customId.startsWith('mughal_cancel_')) {
      return handleConfirmButton(interaction);
    }

    // 3b. Auth check
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ components: [authErrorContainer], flags: COMPONENTS_V2, ephemeral: true });
    }

    const selectedApp = getActiveApp(interaction.user.id);
    if (!selectedApp) {
      return interaction.reply({ components: [noAppContainer], flags: COMPONENTS_V2, ephemeral: true });
    }
    const sellerKey = config.APPLICATIONS[selectedApp];

    // 3c. Direct action buttons (need defer)
    if (interaction.customId === 'admin_btn_list_users') {
      await interaction.deferReply({ ephemeral: true });
      const result = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);
      if (!result.success || !result.users) {
        return interaction.editReply({ components: [buildV2Error('❌ Failed to fetch users', result.message || 'Unknown error', selectedApp)], flags: COMPONENTS_V2 });
      }
      const users = result.users;
      const total = users.length;
      const banned = users.filter(u => u.banned && u.banned !== '0').length;
      const active = total - banned;
      const shown = users.slice(0, 20);
      const namesStr = shown.map(u => `\`${u.username}\``).join(' • ');
      const desc = `• **Total:** \`${total}\`  |  👑 **Active:** \`${active}\`  |  🚫 **Banned:** \`${banned}\`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**Usernames (showing ${shown.length} of ${total}):**\n${namesStr}${total > 20 ? `\n\n*... and ${total - 20} more*` : ''}`;
      return interaction.editReply({ components: [buildV2Info(`📋 User List — ${selectedApp}`, desc, selectedApp)], flags: COMPONENTS_V2 });
    }

    if (interaction.customId === 'admin_btn_list_licenses') {
      await interaction.deferReply({ ephemeral: true });
      const result = await mughalauth_request({ type: 'fetchalllicenses' }, sellerKey);
      if (!result.success) {
        return interaction.editReply({ components: [buildV2Error('❌ Failed to fetch licenses', result.message || 'Unknown error', selectedApp)], flags: COMPONENTS_V2 });
      }
      const keys = result.keys || [];
      const total = keys.length;
      const used = keys.filter(k => k.used === '1' || k.used === true || k.used === 1).length;
      const banned = keys.filter(k => k.banned === '1' || k.banned === true || k.banned === 1).length;
      const unused = total - used - banned;
      const shown = keys.slice(0, 15).map(k => `\`${k.key || k}\``).join('\n');
      const desc = `• **Total Keys:** \`${total}\`\n• ✅ **Unused:** \`${unused}\`  |  🔑 **Used:** \`${used}\`  |  🚫 **Banned:** \`${banned}\`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**Keys (showing ${Math.min(15, total)} of ${total}):**\n${shown}${total > 15 ? `\n\n*... and ${total - 15} more*` : ''}`;
      return interaction.editReply({ components: [buildV2Info(`📋 License List — ${selectedApp}`, desc, selectedApp)], flags: COMPONENTS_V2 });
    }

    if (interaction.customId === 'admin_btn_app_stats') {
      await interaction.deferReply({ ephemeral: true });
      const result = await mughalauth_request({ type: 'appstats' }, sellerKey);
      if (!result.success) {
        return interaction.editReply({ components: [buildV2Error('❌ Failed to fetch stats', result.message || 'Unknown error', selectedApp)], flags: COMPONENTS_V2 });
      }
      const s = result.stats || {};
      const desc = `📱 **Application:** \`${selectedApp}\`\n\n👤 **Users:** Total \`${s.total_users || 0}\` | Banned \`${s.banned_users || 0}\`\n🔑 **Keys:** Total \`${s.total_keys || 0}\` | Used \`${s.used_keys || 0}\` | Unused \`${s.unused_keys || 0}\` | Banned \`${s.banned_keys || 0}\``;
      return interaction.editReply({ components: [buildV2Panel('📊 App Statistics', desc, selectedApp)], flags: COMPONENTS_V2 });
    }

    // 3d. Modal buttons
    const modalMap = {
      admin_btn_create_license: buildCreateLicenseModal,
      admin_btn_create_user: buildCreateUserModal,
      admin_btn_quick_create: buildQuickCreateModal,
      admin_btn_reset_hwid: buildResetHwidModal,
      admin_btn_user_info: buildUserInfoModal,
      admin_btn_edit_user: buildEditUserModal,
      admin_btn_extend_expiry: buildExtendExpiryModal,
      admin_btn_reset_username: buildResetUsernameModal,
      admin_btn_pause_user: buildPauseUserModal,
      admin_btn_unpause_user: buildUnpauseUserModal,
      admin_btn_ban_user: buildBanUserModal,
      admin_btn_unban_user: buildUnbanUserModal,
      admin_btn_delete_user: buildDeleteUserModal,
      admin_btn_ban_license: buildBanLicenseModal,
      admin_btn_unban_license: buildUnbanLicenseModal,
      admin_btn_delete_license: buildDeleteLicenseModal,
    };

    const buildModal = modalMap[interaction.customId];
    if (buildModal) return interaction.showModal(buildModal());

    return;
  }

  // ── 4. Modal Submissions ──────────────────────────────
  if (interaction.isModalSubmit()) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: 'Access denied.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const selectedApp = getActiveApp(interaction.user.id);
    if (!selectedApp) {
      return interaction.editReply({ components: [noAppContainer], flags: COMPONENTS_V2 });
    }
    const sellerKey = config.APPLICATIONS[selectedApp];

    // ── modal_create_license ──────────────────────────
    if (interaction.customId === 'modal_create_license') {
      const level = interaction.fields.getTextInputValue('lvl').trim() || 'default';
      const expiryDays = parseInt(interaction.fields.getTextInputValue('expiry_days')) || 30;
      const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
      const format = interaction.fields.getTextInputValue('format').trim() || 'XXXXX-XXXXX-XXXXX-XXXXX';
      if (amount > 10) return interaction.editReply({ components: [buildV2Error('❌ Limit', 'Max **10 licenses** at a time.', selectedApp)], flags: COMPONENTS_V2 });
      const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
      const result = await mughalauth_request({ type: 'add', level, amount, format, expiry }, sellerKey);
      let desc = result.success
        ? `Created **${amount}** license(s) in **${selectedApp}**\n\n• **Level:** \`${level}\`\n• **Expiry:** \`${expiryDays} days\``
        : `**Error:** ${result.message}`;
      if (result.success && result.keys?.length === 1) desc += `\n• **Key:**\n\`\`\`${result.keys[0]}\`\`\``;
      else if (result.success && result.keys?.length > 1) desc += `\n• **Keys:**\n${result.keys.map(k => `\`${k}\``).join('\n').slice(0, 900)}`;
      const c = result.success ? buildV2Success('🔑 License(s) Created', desc, selectedApp) : buildV2Error('❌ License Creation Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('🔑 Licenses Created', `• **By:** ${interaction.user.displayName}\n• **App:** ${selectedApp}\n• **Amount:** ${amount} (${level})`));
    }

    // ── modal_create_user ─────────────────────────────
    else if (interaction.customId === 'modal_create_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const password = interaction.fields.getTextInputValue('password');
      const email = interaction.fields.getTextInputValue('email').trim();
      const subscription = interaction.fields.getTextInputValue('subscription').trim() || 'default';
      const expiryDays = parseInt(interaction.fields.getTextInputValue('expiry_days')) || 30;
      if (!username || username.length < 3) return interaction.editReply({ components: [buildV2Error('❌ Invalid Username', 'Username must be at least **3 characters**.', selectedApp)], flags: COMPONENTS_V2 });
      if (!password || password.length < 6) return interaction.editReply({ components: [buildV2Error('❌ Invalid Password', 'Password must be at least **6 characters**.', selectedApp)], flags: COMPONENTS_V2 });
      const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
      const result = await mughalauth_request({ type: 'adduser', user: username, pass: password, email, sub: subscription, expiry }, sellerKey);
      const desc = result.success
        ? `User **${username}** created in **${selectedApp}**\n\n• **Username:** \`${username}\`\n• **Password:** ||${password}||\n• **Email:** \`${email || 'N/A'}\`\n• **Subscription:** \`${subscription}\`\n• **Expiry:** \`${expiryDays} days\``
        : `**Error:** ${result.message}`;
      const c = result.success ? buildV2Success('✅ User Created', desc, selectedApp) : buildV2Error('❌ User Creation Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) { invalidateUserCache(selectedApp); await client.sendWebhook(buildV2Info('👤 User Created', `• **By:** ${interaction.user.displayName}\n• **Created:** ${username}\n• **App:** ${selectedApp}`)); }
    }

    // ── modal_quick_create ────────────────────────────
    else if (interaction.customId === 'modal_quick_create') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const expiryDays = parseInt(interaction.fields.getTextInputValue('expiry_days')) || 30;
      if (!username || username.length < 3) return interaction.editReply({ components: [buildV2Error('❌ Invalid Username', 'Username must be at least **3 characters**.', selectedApp)], flags: COMPONENTS_V2 });
      const password = crypto.randomBytes(6).toString('hex');
      const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
      const result = await mughalauth_request({ type: 'adduser', user: username, pass: password, email: '', sub: 'default', expiry }, sellerKey);
      const desc = result.success
        ? `User **${username}** quick-created in **${selectedApp}**\n\n• **Username:** \`${username}\`\n• **Password:** ||${password}||\n• **Expiry:** \`${expiryDays} days\`\n\n*Password is auto-generated*`
        : `**Error:** ${result.message}`;
      const c = result.success ? buildV2Success('⚡ User Quick-Created', desc, selectedApp) : buildV2Error('❌ Quick Create Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) { invalidateUserCache(selectedApp); await client.sendWebhook(buildV2Info('⚡ Quick User Created', `• **By:** ${interaction.user.displayName}\n• **Created:** ${username}\n• **App:** ${selectedApp}`)); }
    }

    // ── modal_reset_hwid ──────────────────────────────
    else if (interaction.customId === 'modal_reset_hwid') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const result = await mughalauth_request({ type: 'resetuser', user: username }, sellerKey);
      const c = result.success
        ? buildV2Success('🔄 HWID Reset', `HWID has been reset for **${username}** in **${selectedApp}**.`, selectedApp)
        : buildV2Error('❌ HWID Reset Failed', `**Error:** ${result.message}`, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('🔄 HWID Reset', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **App:** ${selectedApp}`));
    }

    // ── modal_user_info ───────────────────────────────
    else if (interaction.customId === 'modal_user_info') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const result = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);
      if (!result.success || !result.users) return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', result.message || 'Could not retrieve users.', selectedApp)], flags: COMPONENTS_V2 });
      const user = result.users.find(u => u.username?.toLowerCase() === username.toLowerCase());
      if (!user) return interaction.editReply({ components: [buildV2Error('❌ User Not Found', `**${username}** was not found in **${selectedApp}**.`, selectedApp)], flags: COMPONENTS_V2 });
      const expDate = user.expiry ? new Date(parseInt(user.expiry) * 1000).toLocaleString('en-GB') : 'N/A';
      const loginDate = user.lastlogin ? new Date(parseInt(user.lastlogin) * 1000).toLocaleString('en-GB') : 'N/A';
      const desc = `• **Username:** \`${user.username}\`\n• **Email:** \`${user.email || 'N/A'}\`\n• **Subscription:** \`${user.sub || 'N/A'}\`\n• **Expiry:** \`${expDate}\`\n• **Last Login:** \`${loginDate}\`\n• **Status:** ${user.banned && user.banned !== '0' ? '🚫 Banned' : '✅ Active'}\n• **HWID:** \`\`\`${user.hwid || 'Not set'}\`\`\``;
      const c = buildV2Info(`🔍 User Info — ${user.username}`, desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
    }

    // ── modal_edit_user ───────────────────────────────
    else if (interaction.customId === 'modal_edit_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const newPassword = interaction.fields.getTextInputValue('new_password').trim();
      const newSubscription = interaction.fields.getTextInputValue('new_subscription').trim();
      const newExpiryDays = parseInt(interaction.fields.getTextInputValue('new_expiry_days')) || 0;
      const params = { type: 'edituser', user: username };
      const changes = [];
      if (newPassword) { if (newPassword.length < 6) return interaction.editReply({ components: [buildV2Error('❌ Invalid Password', 'Password must be at least **6 characters**.', selectedApp)], flags: COMPONENTS_V2 }); params.pass = newPassword; changes.push(`Password updated`); }
      if (newSubscription) { params.sub = newSubscription; changes.push(`Subscription → \`${newSubscription}\``); }
      if (newExpiryDays > 0) { params.expiry = Math.floor(Date.now() / 1000) + (newExpiryDays * 86400); changes.push(`Expiry extended by \`${newExpiryDays} days\``); }
      if (!changes.length) return interaction.editReply({ components: [buildV2Warning('⚠️ No Changes', 'No changes specified. Fill in at least one field.', selectedApp)], flags: COMPONENTS_V2 });
      const result = await mughalauth_request(params, sellerKey);
      const desc = result.success ? `Updated **${username}** in **${selectedApp}**:\n${changes.map(c => `• ${c}`).join('\n')}` : `**Error:** ${result.message}`;
      const c = result.success ? buildV2Success('📝 User Updated', desc, selectedApp) : buildV2Error('❌ Update Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('📝 User Edited', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **App:** ${selectedApp}`));
    }

    // ── modal_extend_expiry ───────────────────────────
    else if (interaction.customId === 'modal_extend_expiry') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const days = parseInt(interaction.fields.getTextInputValue('days')) || 0;
      if (days < 1 || days > 3650) return interaction.editReply({ components: [buildV2Error('❌ Invalid Days', 'Days must be between **1 and 3650**.', selectedApp)], flags: COMPONENTS_V2 });
      const usersResult = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);
      if (!usersResult.success || !usersResult.users) return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', 'Could not retrieve user data.', selectedApp)], flags: COMPONENTS_V2 });
      const user = usersResult.users.find(u => u.username?.toLowerCase() === username.toLowerCase());
      if (!user) return interaction.editReply({ components: [buildV2Error('❌ User Not Found', `**${username}** was not found in **${selectedApp}**.`, selectedApp)], flags: COMPONENTS_V2 });
      const currentExpiry = parseInt(user.expiry) || Math.floor(Date.now() / 1000);
      const baseExpiry = currentExpiry > Math.floor(Date.now() / 1000) ? currentExpiry : Math.floor(Date.now() / 1000);
      const newExpiry = baseExpiry + (days * 86400);
      const result = await mughalauth_request({ type: 'edituser', user: username, expiry: newExpiry }, sellerKey);
      const newExpDate = new Date(newExpiry * 1000).toLocaleString('en-GB');
      const desc = result.success ? `Expiry for **${username}** extended by **${days} days**.\n\n• **New Expiry:** \`${newExpDate}\`\n• **App:** ${selectedApp}` : `**Error:** ${result.message}`;
      const c = result.success ? buildV2Success('➕ Expiry Extended', desc, selectedApp) : buildV2Error('❌ Extension Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('➕ Expiry Extended', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **Days Added:** ${days}\n• **App:** ${selectedApp}`));
    }

    // ── modal_reset_username ──────────────────────────
    else if (interaction.customId === 'modal_reset_username') {
      const currentUsername = interaction.fields.getTextInputValue('current_username').trim();
      const newUsername = interaction.fields.getTextInputValue('new_username').trim();
      if (!newUsername || newUsername.length < 3) return interaction.editReply({ components: [buildV2Error('❌ Invalid Username', 'New username must be at least **3 characters**.', selectedApp)], flags: COMPONENTS_V2 });
      const result = await mughalauth_request({ type: 'setusername', user: currentUsername, newuser: newUsername }, sellerKey);
      const desc = result.success ? `Username changed in **${selectedApp}**:\n• **Old:** \`${currentUsername}\`\n• **New:** \`${newUsername}\`` : `**Error:** ${result.message}`;
      const c = result.success ? buildV2Success('🔤 Username Changed', desc, selectedApp) : buildV2Error('❌ Username Change Failed', desc, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) { invalidateUserCache(selectedApp); await client.sendWebhook(buildV2Info('🔤 Username Changed', `• **By:** ${interaction.user.displayName}\n• **${currentUsername}** → **${newUsername}**\n• **App:** ${selectedApp}`)); }
    }

    // ── modal_pause_user ──────────────────────────────
    else if (interaction.customId === 'modal_pause_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const result = await mughalauth_request({ type: 'pauseuser', user: username }, sellerKey);
      const c = result.success ? buildV2Warning('⏸️ User Paused', `Subscription paused for **${username}** in **${selectedApp}**.`, selectedApp) : buildV2Error('❌ Pause Failed', `**Error:** ${result.message}`, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('⏸️ User Paused', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **App:** ${selectedApp}`));
    }

    // ── modal_unpause_user ────────────────────────────
    else if (interaction.customId === 'modal_unpause_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const result = await mughalauth_request({ type: 'unpauseuser', user: username }, sellerKey);
      const c = result.success ? buildV2Success('▶️ User Unpaused', `Subscription resumed for **${username}** in **${selectedApp}**.`, selectedApp) : buildV2Error('❌ Unpause Failed', `**Error:** ${result.message}`, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('▶️ User Unpaused', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **App:** ${selectedApp}`));
    }

    // ── modal_ban_user ────────────────────────────────
    else if (interaction.customId === 'modal_ban_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const reason = interaction.fields.getTextInputValue('reason').trim() || 'Banned via Admin Panel';
      const token_data = { sellerKey, selectedApp, username, reason };
      const { confirmId, cancelId } = createPendingConfirm(interaction, 'ban_user', token_data);
      const c = buildV2Confirm('⚠️ Confirm Ban User', `Ban **${username}** from **${selectedApp}**?\n\n• **Reason:** \`${reason}\`\n\n> User can be unbanned later.`, confirmId, cancelId);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
    }

    // ── modal_unban_user ──────────────────────────────
    else if (interaction.customId === 'modal_unban_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const result = await mughalauth_request({ type: 'unbanuser', user: username }, sellerKey);
      const c = result.success ? buildV2Success('🔓 User Unbanned', `**${username}** has been unbanned in **${selectedApp}**.`, selectedApp) : buildV2Error('❌ Unban Failed', `**Error:** ${result.message}`, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) { invalidateUserCache(selectedApp); await client.sendWebhook(buildV2Info('🔓 User Unbanned', `• **By:** ${interaction.user.displayName}\n• **Target:** ${username}\n• **App:** ${selectedApp}`)); }
    }

    // ── modal_delete_user ─────────────────────────────
    else if (interaction.customId === 'modal_delete_user') {
      const username = interaction.fields.getTextInputValue('username').trim();
      const { confirmId, cancelId } = createPendingConfirm(interaction, 'delete_user', { sellerKey, selectedApp, username });
      const c = buildV2Confirm('⚠️ Confirm Delete User', `Permanently delete **${username}** from **${selectedApp}**?\n\n> ⛔ This action **cannot be undone**.`, confirmId, cancelId);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
    }

    // ── modal_ban_license ─────────────────────────────
    else if (interaction.customId === 'modal_ban_license') {
      const licenseKey = interaction.fields.getTextInputValue('license_key').trim();
      const reason = interaction.fields.getTextInputValue('reason').trim() || 'Banned via Admin Panel';
      const { confirmId, cancelId } = createPendingConfirm(interaction, 'ban_license', { sellerKey, selectedApp, licenseKey, reason });
      const c = buildV2Confirm('⚠️ Confirm Ban License', `Ban key \`${licenseKey}\` in **${selectedApp}**?\n\n• **Reason:** \`${reason}\``, confirmId, cancelId);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
    }

    // ── modal_unban_license ───────────────────────────
    else if (interaction.customId === 'modal_unban_license') {
      const licenseKey = interaction.fields.getTextInputValue('license_key').trim();
      const result = await mughalauth_request({ type: 'unban', key: licenseKey }, sellerKey);
      const c = result.success ? buildV2Success('🔓 License Unbanned', `Key \`${licenseKey}\` has been unbanned in **${selectedApp}**.`, selectedApp) : buildV2Error('❌ Unban Failed', `**Error:** ${result.message}`, selectedApp);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
      if (result.success) await client.sendWebhook(buildV2Info('🔓 License Unbanned', `• **By:** ${interaction.user.displayName}\n• **Key:** \`${licenseKey}\`\n• **App:** ${selectedApp}`));
    }

    // ── modal_delete_license ──────────────────────────
    else if (interaction.customId === 'modal_delete_license') {
      const licenseKey = interaction.fields.getTextInputValue('license_key').trim();
      const { confirmId, cancelId } = createPendingConfirm(interaction, 'delete_license', { sellerKey, selectedApp, licenseKey });
      const c = buildV2Confirm('⚠️ Confirm Delete License', `Permanently delete key \`${licenseKey}\` from **${selectedApp}**?\n\n> ⛔ This action **cannot be undone**.`, confirmId, cancelId);
      await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });
    }
  }
});

// ═══════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════

client.login(config.BOT_TOKEN);
