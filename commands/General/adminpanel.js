const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../../config');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminpanel')
    .setDescription('Open the MughalAuth Interactive Admin Control Panel'),
  async execute(interaction, client) {
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    
    const description = 
      `Welcome to the **MughalAuth** interactive management dashboard.\n\n` +
      `🎯 **Active Application:** \`${selectedApp || 'None (Select one first!)'}\`\n\n` +
      `Click any button below to trigger actions for this application. Forms will display as popup modals.`;

    const container = buildV2Container("🛡️ MughalAuth Admin Dashboard", description, 0x9b59b6);

    // Row 1 Buttons
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_btn_create_license')
        .setLabel('🔑 Gen Licenses')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_btn_create_user')
        .setLabel('👤 Create User')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_btn_reset_hwid')
        .setLabel('🔄 HWID Reset')
        .setStyle(ButtonStyle.Warning)
    );

    // Row 2 Buttons
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_btn_user_info')
        .setLabel('ℹ️ User Info')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_btn_delete_user')
        .setLabel('🗑️ Delete User')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('admin_btn_ban_user')
        .setLabel('🔨 Ban User')
        .setStyle(ButtonStyle.Danger)
    );

    // Add action rows to container
    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

    await interaction.reply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2, 
      ephemeral: true 
    });
  }
};
