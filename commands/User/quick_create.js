const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const crypto = require('crypto');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quick_create')
    .setDescription('Quickly create user with just username and expiry')
    .addStringOption(option => 
      option.setName('username').setDescription('Username for new user').setRequired(true))
    .addIntegerOption(option => 
      option.setName('expiry_days').setDescription('Expiry in days (default: 30)').setRequired(false)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username');
    const expiryDays = interaction.options.getInteger('expiry_days') || 30;
    
    // Auto-generate password
    const password = crypto.randomBytes(6).toString('hex');
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
    
    const params = {
      type: 'adduser',
      user: username,
      pass: password,
      email: '',
      sub: 'default',
      expiry: expiryTimestamp
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    let desc = `User **${username}** has been created in application **${selectedApp}**`;
    if (result.success) {
      desc += 
        `\n\n• **Username:** \`${username}\`` +
        `\n• **Password:** ||${password}||` +
        `\n• **Expiry Days:** \`${expiryDays} days\``;
    } else {
      let errorMsg = result.message || 'Unknown error';
      desc = `**Error:** ${errorMsg}`;
    }
    
    const container = buildV2Container(
      result.success ? "✅ User Created Successfully" : "❌ Creation Failed",
      desc,
      result.success ? 0x2ecc71 : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Created Username:** ${username}\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("✅ Quick User Created", webhookDesc, 0x2ecc71);
      await client.sendWebhook(webhookContainer);
    }
  }
};
