const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, validatePassword, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_user')
    .setDescription('Edit a user\'s password, subscription, or expiry')
    .addStringOption(opt => opt.setName('username').setDescription('Username to edit').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('new_password').setDescription('New password (min 6 chars)').setRequired(false))
    .addStringOption(opt => opt.setName('new_subscription').setDescription('New subscription level').setRequired(false))
    .addStringOption(opt => opt.setName('new_email').setDescription('New email address').setRequired(false))
    .addIntegerOption(opt => opt.setName('new_expiry_days').setDescription('New expiry: days from now').setRequired(false).setMinValue(1).setMaxValue(3650)),

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
    const newPassword = interaction.options.getString('new_password');
    const newSubscription = interaction.options.getString('new_subscription')?.trim();
    const newEmail = interaction.options.getString('new_email')?.trim();
    const newExpiryDays = interaction.options.getInteger('new_expiry_days');

    if (!newPassword && !newSubscription && newEmail === null && !newExpiryDays) {
      return interaction.editReply({ components: [buildV2Warning('⚠️ No Changes Specified', 'Please provide at least one field to update.', selectedApp)], flags: COMPONENTS_V2 });
    }

    if (newPassword) {
      const passwordErr = validatePassword(newPassword);
      if (passwordErr) return interaction.editReply({ components: [buildV2Error('❌ Invalid Password', passwordErr, selectedApp)], flags: COMPONENTS_V2 });
    }

    const params = { type: 'edituser', user: username };
    const changes = [];
    if (newPassword) { params.pass = newPassword; changes.push(`🔑 Password updated`); }
    if (newSubscription) { params.sub = newSubscription; changes.push(`📋 Subscription → \`${newSubscription}\``); }
    if (newEmail !== null) { params.email = newEmail; changes.push(`📧 Email → \`${newEmail || 'Cleared'}\``); }
    if (newExpiryDays) { params.expiry = Math.floor(Date.now() / 1000) + (newExpiryDays * 86400); changes.push(`📅 Expiry → \`${newExpiryDays} days from now\``); }

    const result = await mughalauth_request(params, sellerKey);

    const desc = result.success
      ? `Updated **${username}** in **${selectedApp}**:\n\n${changes.map(c => `• ${c}`).join('\n')}`
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Success('📝 User Updated', desc, selectedApp) : buildV2Error('❌ Update Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      await client.sendWebhook(buildV2Success('📝 User Edited',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Target:** ${username}\n• **App:** ${selectedApp}\n• **Changes:** ${changes.length}`
      ));
    }
  }
};
