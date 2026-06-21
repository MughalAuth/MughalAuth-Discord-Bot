const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban_user')
    .setDescription('Ban a user')
    .addStringOption(option => 
      option.setName('username').setDescription('Username of user to ban').setRequired(true))
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
    const username = interaction.options.getString('username');
    const reason = interaction.options.getString('reason') || "Banned via Admin Panel";
    
    const params = {
      type: 'banuser',
      user: username,
      reason
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    let desc = `User **${username}** has been banned in application **${selectedApp}**`;
    if (result.success) {
      desc += `\n\n• **Reason:** \`${reason}\``;
    } else {
      let errorMsg = result.message || 'Unknown error';
      desc = `**Error:** ${errorMsg}`;
    }
    
    const container = buildV2Container(
      result.success ? "🔨 User Banned Successfully" : "❌ Ban Failed",
      desc,
      result.success ? 0xe74c3c : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Banned Username:** ${username}\n` +
        `• **Reason:** ${reason}\n` +
        `• **Application:** ${selectedApp}`;
      const webhookContainer = buildV2Container("🔨 User Banned Executed", webhookDesc, 0xe74c3c);
      await client.sendWebhook(webhookContainer);
    }
  }
};
