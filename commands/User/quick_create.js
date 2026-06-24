const { SlashCommandBuilder } = require('discord.js');
const crypto = require('crypto');
const config = require('../../config');
const { mughalauth_request, invalidateUserCache } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, validateUsername, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quick_create')
    .setDescription('Quickly create a user with auto-generated password')
    .addStringOption(opt => opt.setName('username').setDescription('Username (3–32 chars, no spaces)').setRequired(true))
    .addIntegerOption(opt => opt.setName('expiry_days').setDescription('Expiry in days (default: 30)').setRequired(false).setMinValue(1).setMaxValue(3650)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username').trim();
    const expiryDays = interaction.options.getInteger('expiry_days') || 30;

    const usernameErr = validateUsername(username);
    if (usernameErr) return interaction.editReply({ components: [buildV2Error('❌ Invalid Username', usernameErr, selectedApp)], flags: COMPONENTS_V2 });

    const password = crypto.randomBytes(6).toString('hex');
    const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);

    const result = await mughalauth_request({ type: 'adduser', user: username, pass: password, email: '', sub: 'default', expiry }, sellerKey);

    const desc = result.success
      ? `**${username}** created in **${selectedApp}** with an auto-generated password.\n\n` +
        `• **Username:** \`${username}\`\n` +
        `• **Password:** ||${password}||\n` +
        `• **Expiry:** \`${expiryDays} days\`\n\n` +
        `*Password is randomly generated — share it securely.*`
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Success('⚡ User Quick-Created', desc, selectedApp) : buildV2Error('❌ Quick Create Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success) {
      invalidateUserCache(selectedApp);
      if (client.sendWebhook) {
        await client.sendWebhook(buildV2Success('⚡ Quick User Created',
          `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Created:** ${username}\n• **App:** ${selectedApp}`
        ));
      }
    }
  }
};
