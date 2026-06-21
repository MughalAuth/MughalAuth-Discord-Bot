const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_license')
    .setDescription('Delete a MughalAuth license key')
    .addStringOption(option => 
      option.setName('license_key').setDescription('License key to permanently delete').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const licenseKey = interaction.options.getString('license_key');
    
    const params = {
      type: 'delkey',
      key: licenseKey
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    const container = buildV2Container(
      result.success ? "🗑️ MughalAuth License Deleted Successfully" : "❌ Delete Failed",
      result.success ? `MughalAuth License key \`${licenseKey}\` has been deleted in **${selectedApp}**` : `**Error:** ${result.message || 'Unknown error'}`,
      result.success ? 0x2ecc71 : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Deleted Key:** \`${licenseKey}\`\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("🗑️ MughalAuth License Deleted", webhookDesc, 0x2ecc71);
      await client.sendWebhook(webhookContainer);
    }
  }
};
