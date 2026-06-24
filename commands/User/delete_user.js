const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Warning, buildV2Confirm, generateToken, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_user')
    .setDescription('Permanently delete a user from the active application')
    .addStringOption(opt => opt.setName('username').setDescription('Username to delete').setRequired(true).setAutocomplete(true)),

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

    // Show confirmation dialog
    const token = generateToken();
    const confirmId = `mughal_confirm_${token}`;
    const cancelId = `mughal_cancel_${token}`;

    const c = buildV2Confirm(
      '⚠️ Confirm Delete User',
      `Permanently delete **${username}** from **${selectedApp}**?\n\n> ⛔ This action **cannot be undone**. All user data will be lost.`,
      confirmId, cancelId
    );
    await interaction.editReply({ components: [c], flags: COMPONENTS_V2 });

    const timeoutHandle = setTimeout(async () => {
      client.pendingConfirms?.delete(token);
      try {
        const { buildV2Warning: w } = require('../../utils/helpers');
        await interaction.editReply({ components: [w('⏱ Confirmation Expired', 'Timed out after 30s. Run the command again.')], flags: COMPONENTS_V2 });
      } catch (_) {}
    }, 30_000);

    (client.pendingConfirms = client.pendingConfirms || new Map()).set(token, {
      action: 'delete_user', sellerKey, selectedApp, username,
      _timeout: timeoutHandle, _userId: interaction.user.id, _userTag: interaction.user.displayName
    });
  }
};
