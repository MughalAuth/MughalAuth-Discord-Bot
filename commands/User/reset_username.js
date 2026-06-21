const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_username')
    .setDescription('Change username for a user')
    .addStringOption(option => 
      option.setName('current_username').setDescription('Current username').setRequired(true))
    .addStringOption(option => 
      option.setName('new_username').setDescription('New username').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const currentUsername = interaction.options.getString('current_username');
    const newUsername = interaction.options.getString('new_username');
    
    const params = {
      type: 'setusername',
      user: currentUsername,
      newuser: newUsername
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    const container = buildV2Container(
      result.success ? "👤 Username Changed Successfully" : "❌ Username Change Failed",
      result.success ? `Username changed from **${currentUsername}** to **${newUsername}** in application **${selectedApp}**` : `**Error:** ${result.message || 'Unknown error'}`,
      result.success ? 0x3498db : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Old Username:** ${currentUsername}\n` +
        `• **New Username:** ${newUsername}\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("👤 Username Changed", webhookDesc, 0x3498db);
      await client.sendWebhook(webhookContainer);
    }
  }
};
