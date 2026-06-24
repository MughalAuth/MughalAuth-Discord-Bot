const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Warning, buildV2Error, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause_user')
    .setDescription('Pause a user\'s subscription (stops their timer)')
    .addStringOption(opt => opt.setName('username').setDescription('Username to pause').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction, client) {
    const focusedValue = interaction.options.getFocused();
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) return interaction.respond([]);
    const sellerKey = config.APPLICATIONS[selectedApp];
    const users = await getCachedUsers(sellerKey, selectedApp);
    const choices = users
      .filter(u => u.username && u.username.toLowerCase().startsWith(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(u => ({ name: u.username, value: u.username }));
    await interaction.respond(choices);
  },

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username').trim();
    const result = await mughalauth_request({ type: 'pauseuser', user: username }, sellerKey);

    const desc = result.success
      ? `Subscription paused for **${username}** in **${selectedApp}**.\n\nUse \`/unpause_user\` to resume their access.`
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Warning('⏸️ User Paused', desc, selectedApp) : buildV2Error('❌ Pause Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      const { buildV2Warning: ww } = require('../../utils/helpers');
      await client.sendWebhook(ww('⏸️ User Paused',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Target:** ${username}\n• **App:** ${selectedApp}`
      ));
    }
  }
};
