const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../config');
const persistence = require('../../utils/persistence');
const { buildV2Success, buildV2Error, buildV2Panel, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selectapplication')
    .setDescription('Select which MughalAuth application to manage'),

  async execute(interaction, client) {
    const apps = Object.keys(config.APPLICATIONS || {});

    if (apps.length === 0) {
      const c = buildV2Error('❌ No Applications Configured', 'No applications found in your configuration!');
      return interaction.reply({ components: [c], flags: COMPONENTS_V2, ephemeral: true });
    }

    const currentApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_app_dropdown')
      .setPlaceholder(currentApp ? `Current: ${currentApp}` : '— Choose an application —')
      .addOptions(apps.map(appName => ({
        label: appName,
        value: appName,
        description: `Switch to application: ${appName}`,
        default: appName === currentApp
      })));

    const desc =
      `Choose the MughalAuth application you want to manage.\n\n` +
      `🎯 **Currently active:** ${currentApp ? `\`${currentApp}\`` : '⚠️ *None selected*'}\n\n` +
      `Your selection is **saved automatically** and will persist even after a bot restart.`;

    const container = buildV2Panel('📱 Select Application', desc, currentApp);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

    await interaction.reply({
      components: [container],
      flags: COMPONENTS_V2,
      ephemeral: true
    });
  }
};
