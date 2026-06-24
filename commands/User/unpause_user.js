const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unpause_user')
    .setDescription('Resume a paused user\'s subscription')
    .addStringOption(opt => opt.setName('username').setDescription('Username to unpause').setRequired(true).setAutocomplete(true)),

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
    await interaction.deferReply();

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username').trim();
    const result = await mughalauth_request({ type: 'unpauseuser', user: username }, sellerKey);

    const desc = result.success
      ? `Subscription resumed for **${username}** in **${selectedApp}**.\n\nThey can now log in again.`
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Success('▶️ User Unpaused', desc, selectedApp) : buildV2Error('❌ Unpause Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      await client.sendWebhook(buildV2Success('▶️ User Unpaused',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Target:** ${username}\n• **App:** ${selectedApp}`
      ));
    }
  }
};
