const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const persistence = require('../../utils/persistence');
const { buildV2Panel, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminpanel')
    .setDescription('Open the MughalAuth Interactive Admin Control Panel'),

  async execute(interaction, client) {
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;

    const description =
      `Welcome, **${interaction.user.displayName}** 👋\n\n` +
      `🎯 **Active Application:** ${selectedApp ? `\`${selectedApp}\`` : '⚠️ *None — use `/selectapplication` first!*'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Click any button below to perform admin actions.\n` +
      `> 🔑 **Row 1** — License Operations\n` +
      `> 👤 **Row 2** — User Info & Management\n` +
      `> 🛠️ **Row 3** — Account Actions\n` +
      `> ⚠️ **Row 4** — Ban / Delete (with confirmation)`;

    const container = buildV2Panel('🛡️ MughalAuth Admin Panel', description, selectedApp);

    // ── Row 1: License Management ──────────────────────────────────────────
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_btn_create_license').setLabel('🔑 Gen License').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_btn_ban_license').setLabel('🔨 Ban Key').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('admin_btn_unban_license').setLabel('🔓 Unban Key').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_btn_delete_license').setLabel('🗑️ Del Key').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('admin_btn_list_licenses').setLabel('📋 List Keys').setStyle(ButtonStyle.Secondary)
    );

    // ── Row 2: User Info & Creation ────────────────────────────────────────
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_btn_create_user').setLabel('👤 Create User').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_btn_quick_create').setLabel('⚡ Quick Create').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('admin_btn_list_users').setLabel('📋 List Users').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_btn_user_info').setLabel('🔍 User Info').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_btn_app_stats').setLabel('📊 App Stats').setStyle(ButtonStyle.Primary)
    );

    // ── Row 3: Account Actions ─────────────────────────────────────────────
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_btn_edit_user').setLabel('✏️ Edit User').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_btn_extend_expiry').setLabel('➕ Extend Expiry').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_btn_reset_hwid').setLabel('🔄 HWID Reset').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_btn_reset_username').setLabel('🔤 Rename').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_btn_pause_user').setLabel('⏸️ Pause').setStyle(ButtonStyle.Secondary)
    );

    // ── Row 4: Danger Zone (all with confirmation) ─────────────────────────
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_btn_unpause_user').setLabel('▶️ Unpause').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_btn_ban_user').setLabel('🔨 Ban User').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('admin_btn_unban_user').setLabel('🔓 Unban User').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_btn_delete_user').setLabel('🗑️ Delete User').setStyle(ButtonStyle.Danger)
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);
    container.addActionRowComponents(row3);
    container.addActionRowComponents(row4);


    await interaction.reply({
      components: [container],
      flags: COMPONENTS_V2,
      ephemeral: true
    });
  }
};
