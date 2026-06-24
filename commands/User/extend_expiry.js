const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, generateToken, buildV2Confirm, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('extend_expiry')
    .setDescription('Extend a user\'s subscription expiry by a number of days')
    .addStringOption(opt =>
      opt.setName('username').setDescription('Username to extend').setRequired(true).setAutocomplete(true))
    .addIntegerOption(opt =>
      opt.setName('days').setDescription('Number of days to add (1-3650)').setRequired(true).setMinValue(1).setMaxValue(3650)),

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
    const days = interaction.options.getInteger('days');

    // Fetch current user expiry
    const usersResult = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);
    if (!usersResult.success || !usersResult.users) {
      return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', 'Could not retrieve user data from the API.', selectedApp)], flags: COMPONENTS_V2 });
    }

    const user = usersResult.users.find(u => u.username?.toLowerCase() === username.toLowerCase());
    if (!user) {
      return interaction.editReply({ components: [buildV2Error('❌ User Not Found', `**${username}** was not found in **${selectedApp}**.`, selectedApp)], flags: COMPONENTS_V2 });
    }

    const now = Math.floor(Date.now() / 1000);
    const currentExpiry = parseInt(user.expiry) || now;
    const baseExpiry = currentExpiry > now ? currentExpiry : now; // If expired, extend from now
    const newExpiry = baseExpiry + (days * 86400);
    const newExpDate = new Date(newExpiry * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const oldExpDate = currentExpiry > now
      ? new Date(currentExpiry * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour12: false })
      : 'Expired';

    const result = await mughalauth_request({ type: 'edituser', user: username, expiry: newExpiry }, sellerKey);

    const desc = result.success
      ? `Expiry extended for **${username}** in **${selectedApp}**\n\n` +
        `• **Days Added:** \`+${days} days\`\n` +
        `• **Previous Expiry:** \`${oldExpDate}\`\n` +
        `• **New Expiry:** \`${newExpDate}\``
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success
        ? buildV2Success('➕ Expiry Extended', desc, selectedApp)
        : buildV2Error('❌ Extension Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      await client.sendWebhook(buildV2Success('➕ Expiry Extended',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Target:** ${username}\n• **Days:** +${days}\n• **New Expiry:** ${newExpDate}\n• **App:** ${selectedApp}`
      ));
    }
  }
};
