const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Info, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list_licenses')
    .setDescription('List all license keys in the active application')
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Filter by status')
        .setRequired(false)
        .addChoices(
          { name: '🔑 All Keys', value: 'all' },
          { name: '✅ Unused Only', value: 'unused' },
          { name: '🔒 Used Only', value: 'used' },
          { name: '🚫 Banned Only', value: 'banned' }
        )),

  async execute(interaction, client) {
    await interaction.deferReply();

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const filter = interaction.options.getString('filter') || 'all';

    const result = await mughalauth_request({ type: 'fetchalllicenses' }, sellerKey);

    if (!result.success) {
      return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp)], flags: COMPONENTS_V2 });
    }

    let keys = result.keys || [];
    const total = keys.length;
    const usedKeys = keys.filter(k => k.used === '1' || k.used === 1 || k.used === true);
    const bannedKeys = keys.filter(k => k.banned === '1' || k.banned === 1 || k.banned === true);
    const unusedKeys = keys.filter(k => (!k.used || k.used === '0' || k.used === 0) && (!k.banned || k.banned === '0' || k.banned === 0));

    if (filter === 'used') keys = usedKeys;
    else if (filter === 'unused') keys = unusedKeys;
    else if (filter === 'banned') keys = bannedKeys;

    const filterLabel = filter === 'all' ? 'All' : filter === 'used' ? 'Used' : filter === 'unused' ? 'Unused' : 'Banned';
    const shown = keys.slice(0, 15);

    const keysStr = shown.length > 0
      ? shown.map(k => `\`${k.key || k}\``).join('\n')
      : '*No keys found.*';

    const description =
      `📱 **App:** \`${selectedApp}\`  |  🔍 **Filter:** \`${filterLabel}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 **Total:** \`${total}\`  |  ✅ **Unused:** \`${unusedKeys.length}\`  |  🔒 **Used:** \`${usedKeys.length}\`  |  🚫 **Banned:** \`${bannedKeys.length}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Keys — ${filterLabel} (showing ${shown.length} of ${keys.length}):**\n` +
      keysStr +
      (keys.length > 15 ? `\n\n*... and ${keys.length - 15} more key(s)*` : '');

    await interaction.editReply({
      components: [buildV2Info(`📋 License List — ${selectedApp}`, description, selectedApp)],
      flags: COMPONENTS_V2
    });
  }
};
