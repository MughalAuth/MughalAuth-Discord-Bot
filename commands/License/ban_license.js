const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban_license')
    .setDescription('Ban a MughalAuth license key')
    .addStringOption(option => 
      option.setName('license_key').setDescription('License key to ban').setRequired(true))
    .addStringOption(option => 
      option.setName('reason').setDescription('Reason for the ban').setRequired(false)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const licenseKey = interaction.options.getString('license_key');
    const reason = interaction.options.getString('reason') || "Banned via Admin Panel";
    
    const params = {
      type: 'ban',
      key: licenseKey,
      reason
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    const container = buildV2Container(
      result.success ? "🔨 MughalAuth License Banned Successfully" : "❌ Ban Failed",
      result.success ? `MughalAuth License key \`${licenseKey}\` has been banned in **${selectedApp}**\n\n• **Reason:** \`${reason}\`` : `**Error:** ${result.message || 'Unknown error'}`,
      result.success ? 0xe74c3c : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Banned Key:** \`${licenseKey}\`\n` +
        `• **Reason:** ${reason}\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("🔨 MughalAuth License Banned", webhookDesc, 0xe74c3c);
      await client.sendWebhook(webhookContainer);
    }
  }
};
