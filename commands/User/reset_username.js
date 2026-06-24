const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers, invalidateUserCache } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, validateUsername, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_username')
    .setDescription('Change a user\'s username')
    .addStringOption(opt => opt.setName('current_username').setDescription('Current username').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('new_username').setDescription('New username (3–32 chars, no spaces)').setRequired(true)),

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
    const currentUsername = interaction.options.getString('current_username').trim();
    const newUsername = interaction.options.getString('new_username').trim();

    const usernameErr = validateUsername(newUsername);
    if (usernameErr) return interaction.editReply({ components: [buildV2Error('❌ Invalid New Username', usernameErr, selectedApp)], flags: COMPONENTS_V2 });

    const result = await mughalauth_request({ type: 'setusername', user: currentUsername, newuser: newUsername }, sellerKey);

    const desc = result.success
      ? `Username changed in **${selectedApp}**:\n\n• **Old:** \`${currentUsername}\`\n• **New:** \`${newUsername}\``
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Success('🔤 Username Changed', desc, selectedApp) : buildV2Error('❌ Username Change Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success) {
      invalidateUserCache(selectedApp);
      if (client.sendWebhook) {
        await client.sendWebhook(buildV2Success('🔤 Username Changed',
          `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **${currentUsername}** → **${newUsername}**\n• **App:** ${selectedApp}`
        ));
      }
    }
  }
};
