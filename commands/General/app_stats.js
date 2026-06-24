const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Panel, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('app_stats')
    .setDescription('View statistics for the active MughalAuth application'),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const result = await mughalauth_request({ type: 'appstats' }, sellerKey);

    if (!result.success) {
      return interaction.editReply({ components: [buildV2Error('❌ Stats Fetch Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp)], flags: COMPONENTS_V2 });
    }

    const s = result.stats || {};
    const description =
      `📱 **Application:** \`${selectedApp}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 **User Statistics**\n` +
      `  • **Total Registered:** \`${s.total_users ?? 'N/A'}\`\n` +
      `  • **Banned Users:** \`${s.banned_users ?? 'N/A'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 **License Key Statistics**\n` +
      `  • **Total Keys:** \`${s.total_keys ?? 'N/A'}\`\n` +
      `  • **Used Keys:** \`${s.used_keys ?? 'N/A'}\`\n` +
      `  • **Unused Keys:** \`${s.unused_keys ?? 'N/A'}\`\n` +
      `  • **Banned Keys:** \`${s.banned_keys ?? 'N/A'}\``;

    await interaction.editReply({
      components: [buildV2Panel('📊 Application Statistics', description, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (client.sendWebhook) {
      await client.sendWebhook(buildV2Panel('📊 App Stats Viewed',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **App:** ${selectedApp}`
      ));
    }
  }
};
