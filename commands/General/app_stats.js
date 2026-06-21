const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('app_stats')
    .setDescription('View stats overview for the active MughalAuth application'),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    
    const params = {
      type: 'appstats'
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    if (!result.success) {
      const container = buildV2Container(
        "❌ Fetch Stats Failed",
        `**Error:** ${result.message || 'Unknown error'}`,
        0xe74c3c
      );
      return interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });
    }
    
    const stats = result.stats;
    
    const description = 
      `📱 **Application:** \`${selectedApp}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 **Users Information:**\n` +
      `  • **Total Registered:** \`${stats.total_users}\`\n` +
      `  • **Banned Users:** \`${stats.banned_users}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 **License Keys Information:**\n` +
      `  • **Total Keys:** \`${stats.total_keys}\`\n` +
      `  • **Used Keys:** \`${stats.used_keys}\`\n` +
      `  • **Unused Keys:** \`${stats.unused_keys}\`\n` +
      `  • **Banned Keys:** \`${stats.banned_keys}\``;
      
    const container = buildV2Container(
      "📊 Application Statistics",
      description,
      0x9b59b6 // Purple color accent
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (client.sendWebhook) {
      const webhookDesc = 
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Application:** ${selectedApp}\n` +
        `• **Action:** Viewed application statistics`;
      const webhookContainer = buildV2Container("📊 Application Stats Viewed", webhookDesc, 0x9b59b6);
      await client.sendWebhook(webhookContainer);
    }
  }
};
