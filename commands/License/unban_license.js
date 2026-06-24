const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban_license')
    .setDescription('Unban a previously banned license key')
    .addStringOption(opt => opt.setName('license_key').setDescription('License key to unban').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const licenseKey = interaction.options.getString('license_key').trim();

    const result = await mughalauth_request({ type: 'unban', key: licenseKey }, sellerKey);

    const desc = result.success
      ? `License key \`${licenseKey}\` has been unbanned in **${selectedApp}**.\n\nIt can now be used again.`
      : `**Error:** ${result.message || 'Unknown error'}`;

    await interaction.editReply({
      components: [result.success ? buildV2Success('🔓 License Unbanned', desc, selectedApp) : buildV2Error('❌ Unban Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      await client.sendWebhook(buildV2Success('🔓 License Unbanned',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **Key:** \`${licenseKey}\`\n• **App:** ${selectedApp}`
      ));
    }
  }
};
