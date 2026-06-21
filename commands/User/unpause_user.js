const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unpause_user')
    .setDescription('Unpause a user account subscription')
    .addStringOption(option => 
      option.setName('username').setDescription('Username of user to unpause').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username');
    
    const params = {
      type: 'unpauseuser',
      user: username
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    const container = buildV2Container(
      result.success ? "▶️ User Unpaused Successfully" : "❌ User Unpause Failed",
      result.success ? `Subscription for user **${username}** has been unpaused/resumed in application **${selectedApp}**` : `**Error:** ${result.message || 'Unknown error'}`,
      result.success ? 0x2ecc71 : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Unpaused Username:** ${username}\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("▶️ User Unpaused", webhookDesc, 0x2ecc71);
      await client.sendWebhook(webhookContainer);
    }
  }
};
