const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { buildV2Warning, buildV2Confirm, generateToken, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban_license')
    .setDescription('Ban a license key from the active application')
    .addStringOption(opt => opt.setName('license_key').setDescription('License key to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const licenseKey = interaction.options.getString('license_key').trim();
    const reason = interaction.options.getString('reason')?.trim() || 'Banned via Discord Bot';

    // Show confirmation dialog
    const token = generateToken();
    const confirmId = `mughal_confirm_${token}`;
    const cancelId = `mughal_cancel_${token}`;

    const c = buildV2Confirm(
      '⚠️ Confirm Ban License',
      `Ban key \`${licenseKey}\` in **${selectedApp}**?\n\n• **Reason:** \`${reason}\`\n\n> Key can be unbanned later with \`/unban_license\`.`,
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
      action: 'ban_license', sellerKey, selectedApp, licenseKey, reason,
      _timeout: timeoutHandle, _userId: interaction.user.id, _userTag: interaction.user.displayName
    });
  }
};
