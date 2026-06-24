const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers, invalidateUserCache } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban_user')
    .setDescription('Unban a previously banned user')
    .addStringOption(opt =>
      opt.setName('username').setDescription('Username to unban').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction, client) {
    const focusedValue = interaction.options.getFocused();
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) return interaction.respond([]);
    const sellerKey = config.APPLICATIONS[selectedApp];
    const users = await getCachedUsers(sellerKey, selectedApp);
    const choices = users
      .filter(u => u.username && u.username.toLowerCase().startsWith(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(u => ({ name: `${u.username}${u.banned && u.banned !== '0' ? ' 🚫' : ''}`, value: u.username }));
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

    const result = await mughalauth_request({ type: 'unbanuser', user: username }, sellerKey);

    const container = result.success
      ? buildV2Success('🔓 User Unbanned', `**${username}** has been unbanned in **${selectedApp}**.\n\nThey can now log in again.`, selectedApp)
      : buildV2Error('❌ Unban Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp);

    await interaction.editReply({ components: [container], flags: COMPONENTS_V2 });

    if (result.success) {
      invalidateUserCache(selectedApp);
      if (client.sendWebhook) {
        await client.sendWebhook(buildV2Success('🔓 User Unbanned',
          `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Target:** ${username}\n• **App:** ${selectedApp}`
        ));
      }
    }
  }
};
