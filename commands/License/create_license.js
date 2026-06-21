const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create_license')
    .setDescription('Create a new MughalAuth license key')
    .addStringOption(option => 
      option.setName('level').setDescription('License level (default: default)').setRequired(false))
    .addIntegerOption(option => 
      option.setName('expiry_days').setDescription('Expiry duration in Days (default: 30)').setRequired(false))
    .addIntegerOption(option => 
      option.setName('amount').setDescription('Number of licenses to generate (default: 1)').setRequired(false))
    .addStringOption(option => 
      option.setName('format').setDescription('License format (e.g. XXXXX-XXXXX...)').setRequired(false)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const level = interaction.options.getString('level') || "default";
    const expiryDays = interaction.options.getInteger('expiry_days') || 30;
    const amount = interaction.options.getInteger('amount') || 1;
    const format = interaction.options.getString('format') || "XXXXX-XXXXX-XXXXX-XXXXX";
    
    if (amount > 10) {
      const container = buildV2Container("❌ Generation Limit Exceeded", "You can generate a maximum of **10** licenses at a time.", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
    
    const params = {
      type: 'add',
      level,
      amount,
      format,
      expiry: expiryTimestamp
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    let desc = `Created **${amount}** license key(s) in application **${selectedApp}**`;
    if (result.success) {
      desc += 
        `\n\n• **Level:** \`${level}\`` +
        `\n• **Amount:** \`${amount}\`` +
        `\n• **Expiry Days:** \`${expiryDays} days\``;

      if (result.keys && result.keys.length === 1) {
        desc += `\n• **License Key:** \`\`\`${result.keys[0]}\`\`\``;
      } else if (result.keys && result.keys.length > 1) {
        const keysStr = result.keys.map(k => `\`${k}\``).join('\n');
        desc += `\n• **License Keys:**\n${keysStr.slice(0, 1000)}`;
      }
    } else {
      let errorMsg = result.message || 'Unknown error';
      desc = `**Error:** ${errorMsg}`;
    }
    
    const container = buildV2Container(
      result.success ? "🔑 MughalAuth License(s) Created Successfully" : "❌ License Creation Failed",
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
        `• **Application:** ${selectedApp}\n` +
        `• **Amount:** ${amount}\n` +
        `• **Level:** ${level}\n` +
        `• **Expiry:** ${expiryDays} days`;
      const webhookContainer = buildV2Container("🔑 MughalAuth License(s) Created", webhookDesc, 0x2ecc71);
      await client.sendWebhook(webhookContainer);
    }
  }
};
