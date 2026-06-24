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
    .addIntegerOption(opt => opt.setName('expiry_days').setDescription('Expiry in days (default: 30)').setRequired(false).setMinValue(1).setMaxValue(3650))
    .addUserOption(opt => opt.setName('discord_user').setDescription('Discord user to send credentials in DM (optional)').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username').trim();
    const expiryDays = interaction.options.getInteger('expiry_days') || 30;
    const discordUser = interaction.options.getUser('discord_user');

    const usernameErr = validateUsername(username);
    if (usernameErr) return interaction.editReply({ components: [buildV2Error('❌ Invalid Username', usernameErr, selectedApp)], flags: COMPONENTS_V2 });

    const password = crypto.randomBytes(6).toString('hex');
    const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);

    const result = await mughalauth_request({ type: 'adduser', user: username, pass: password, email: '', sub: 'default', expiry }, sellerKey);

    let dmStatus = '';
    if (result.success && discordUser) {
      try {
        await discordUser.send({
          embeds: [{
            title: `⚡ Account Quick-Created — ${selectedApp}`,
            description: `Your login credentials for **${selectedApp}** are ready.`,
            color: 0x2ecc71,
            fields: [
              { name: '👤 Username', value: `\`${username}\``, inline: true },
              { name: '🔑 Password', value: `\`${password}\``, inline: true },
              { name: '📅 Expiry', value: `${expiryDays} days`, inline: true }
            ],
            footer: { text: `Assigned by ${interaction.user.tag}` },
            timestamp: new Date().toISOString()
          }]
        });
        dmStatus = `\n\n✅ **Credentials sent to <@${discordUser.id}> in DM.**`;
      } catch (err) {
        dmStatus = `\n\n⚠️ **Failed to DM <@${discordUser.id}> (DMs might be closed/blocked).**`;
      }
    }

    const desc = result.success
      ? `**${username}** created in **${selectedApp}** with an auto-generated password.\n\n` +
        `• **Username:** \`${username}\`\n` +
        `• **Password:** ||${password}||\n` +
        `• **Expiry:** \`${expiryDays} days\`\n\n` +
        `*Password is randomly generated — share it securely.*` +
        dmStatus
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
