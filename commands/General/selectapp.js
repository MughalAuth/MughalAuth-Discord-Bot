const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selectapplication')
    .setDescription('Select a MughalAuth application to work with'),
  async execute(interaction, client) {
    if (Object.keys(config.APPLICATIONS).length === 0) {
      const container = buildV2Container("❌ No Applications Configured", "No applications found in configuration!", 0xe74c3c);
      return interaction.reply({ 
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true 
      });
    }

    const currentSelection = client.userSelectedApps[interaction.user.id] || "None";
    
    let description = 
      `🎯 **Current Selection:** \`${currentSelection}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const [appName, sellerKey] of Object.entries(config.APPLICATIONS)) {
      const maskedKey = `${sellerKey.slice(0, 4)}****${sellerKey.slice(-4)}`;
      description += `• **${appName}**\n  Seller Key: \`${maskedKey}\`\n`;
    }
    
    description += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Select an application from the dropdown below.*`;

    const container = buildV2Container("📱 Available Applications", description, 0x3498db);

    // Build the selection dropdown menu
    const options = Object.keys(config.APPLICATIONS).map((appName) => ({
      label: appName,
      description: `Select ${appName} for MughalAuth operations`,
      value: appName,
      emoji: "📱"
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_app_dropdown')
      .setPlaceholder('🎯 Select an application...')
      .addOptions(options);

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(selectMenu)
    );

    await interaction.reply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2, 
      ephemeral: true 
    });
  }
};
