const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Info, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list_users')
    .setDescription('List all users in the active application')
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Filter by status')
        .setRequired(false)
        .addChoices(
          { name: '👥 All Users', value: 'all' },
          { name: '✅ Active Only', value: 'active' },
          { name: '🚫 Banned Only', value: 'banned' }
        )),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const filter = interaction.options.getString('filter') || 'all';

    const result = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);

    if (!result.success || !result.users) {
      return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp)], flags: COMPONENTS_V2 });
    }

    let users = result.users;
    const totalAll = users.length;
    const totalBanned = users.filter(u => u.banned && u.banned !== '0').length;
    const totalActive = totalAll - totalBanned;

    if (filter === 'active') users = users.filter(u => !u.banned || u.banned === '0');
    else if (filter === 'banned') users = users.filter(u => u.banned && u.banned !== '0');

    const shown = users.slice(0, 20);
    const filterLabel = filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Banned';

    const namesStr = shown.length > 0
      ? shown.map(u => `\`${u.username}\``).join(' • ')
      : '*No users found.*';

    const description =
      `📱 **App:** \`${selectedApp}\` | 🔍 **Filter:** \`${filterLabel}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 **Total:** \`${totalAll}\`  |  ✅ **Active:** \`${totalActive}\`  |  🚫 **Banned:** \`${totalBanned}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Usernames — ${filterLabel} (showing ${shown.length} of ${users.length}):**\n` +
      namesStr +
      (users.length > 20 ? `\n\n*... and ${users.length - 20} more user(s)*` : '');

    await interaction.editReply({
      components: [buildV2Info(`📋 User List — ${selectedApp}`, description, selectedApp)],
      flags: COMPONENTS_V2
    });
  }
};
