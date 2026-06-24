const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const { mughalauth_request, getCachedUsers } = require('../../utils/mughalauth_api');
const { buildV2Info, buildV2Error, buildV2Warning, COMPONENTS_V2 } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user_info')
    .setDescription('Get detailed information about a user')
    .addStringOption(opt => opt.setName('username').setDescription('Username to look up').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction, client) {
    const focusedValue = interaction.options.getFocused();
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) return interaction.respond([]);
    const sellerKey = config.APPLICATIONS[selectedApp];
    const users = await getCachedUsers(sellerKey, selectedApp);
    const choices = users
      .filter(u => u.username && u.username.toLowerCase().startsWith(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(u => ({ name: `${u.username}${u.banned && u.banned !== '0' ? ' 🚫' : ''}`, value: u.username }));
    await interaction.respond(choices);
  },

  async execute(interaction, client) {
    await interaction.deferReply();

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      return interaction.editReply({ components: [buildV2Warning('📱 No App Selected', 'Use `/selectapplication` first.')], flags: COMPONENTS_V2 });
    }

    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username').trim();

    const result = await mughalauth_request({ type: 'fetchallusers' }, sellerKey);

    if (!result.success || !result.users) {
      return interaction.editReply({ components: [buildV2Error('❌ Fetch Failed', `**Error:** ${result.message || 'Unknown error'}`, selectedApp)], flags: COMPONENTS_V2 });
    }

    const user = result.users.find(u => u.username?.toLowerCase() === username.toLowerCase());

    if (!user) {
      return interaction.editReply({ components: [buildV2Error('❌ User Not Found', `**${username}** was not found in **${selectedApp}**.`, selectedApp)], flags: COMPONENTS_V2 });
    }

    const isBanned = user.banned && user.banned !== '0';
    const expiryMs = parseInt(user.expiry) * 1000;
    const now = Date.now();
    const isExpired = expiryMs < now;
    const expDate = user.expiry ? new Date(expiryMs).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }) : 'N/A';
    const loginDate = user.lastlogin ? new Date(parseInt(user.lastlogin) * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }) : 'Never';
    const createDate = user.createdate ? new Date(parseInt(user.createdate) * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour12: false
    }) : 'N/A';

    const statusEmoji = isBanned ? '🚫 Banned' : (isExpired ? '⏰ Expired' : '✅ Active');

    const description =
      `📱 **App:** \`${selectedApp}\`  |  👤 **Status:** ${statusEmoji}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• **Username:** \`${user.username}\`\n` +
      `• **Email:** \`${user.email || 'N/A'}\`\n` +
      `• **Subscription:** \`${user.sub || 'N/A'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• **Created:** \`${createDate}\`\n` +
      `• **Last Login:** \`${loginDate}\`\n` +
      `• **Expiry:** \`${expDate}\`${isExpired && !isBanned ? ' ⚠️' : ''}\n` +
      (isBanned ? `• **Ban Reason:** \`${user.banned}\`\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• **HWID:** \`\`\`${user.hwid || 'Not set'}\`\`\``;

    await interaction.editReply({
      components: [buildV2Info(`🔍 User Info — ${user.username}`, description, selectedApp)],
      flags: COMPONENTS_V2
    });
  }
};
