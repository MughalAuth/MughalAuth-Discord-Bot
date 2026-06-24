const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Success, buildV2Error, buildV2Warning, validateAmount, validateExpiryDays, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create_license')
    .setDescription('Generate one or more license keys')
    .addIntegerOption(opt => opt.setName('expiry_days').setDescription('Expiry in days (1–3650)').setRequired(true).setMinValue(1).setMaxValue(3650))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of keys to generate (1–10)').setRequired(false).setMinValue(1).setMaxValue(10))
    .addStringOption(opt => opt.setName('level').setDescription('License level (default: default)').setRequired(false))
    .addStringOption(opt => opt.setName('format').setDescription('Key format (default: XXXXX-XXXXX-XXXXX-XXXXX)').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const expiryDays = interaction.options.getInteger('expiry_days');
    const amount = interaction.options.getInteger('amount') || 1;
    const level = interaction.options.getString('level')?.trim() || 'default';
    const format = interaction.options.getString('format')?.trim() || 'XXXXX-XXXXX-XXXXX-XXXXX';

    const expiry = Math.floor(Date.now() / 1000) + (expiryDays * 86400);
    const result = await mughalauth_request({ type: 'add', level, amount, format, expiry }, sellerKey);

    let desc;
    if (result.success) {
      desc = `Generated **${amount}** key(s) in **${selectedApp}**\n\n` +
        `• **Level:** \`${level}\`\n• **Amount:** \`${amount}\`\n• **Expiry:** \`${expiryDays} days\`\n• **Format:** \`${format}\``;
      if (result.keys?.length === 1) {
        desc += `\n\n**🔑 Key:**\n\`\`\`\n${result.keys[0]}\n\`\`\``;
      } else if (result.keys?.length > 1) {
        desc += `\n\n**🔑 Keys:**\n${result.keys.map(k => `\`${k}\``).join('\n').slice(0, 900)}`;
      }
    } else {
      desc = `**Error:** ${result.message || 'Unknown error'}`;
    }

    await interaction.editReply({
      components: [result.success ? buildV2Success('🔑 License(s) Created', desc, selectedApp) : buildV2Error('❌ License Creation Failed', desc, selectedApp)],
      flags: COMPONENTS_V2
    });

    if (result.success && client.sendWebhook) {
      await client.sendWebhook(buildV2Success('🔑 Licenses Created',
        `• **By:** ${interaction.user.displayName} (${interaction.user.id})\n• **App:** ${selectedApp}\n• **Amount:** ${amount} (${level})\n• **Expiry:** ${expiryDays} days`
      ));
    }
  }
};
