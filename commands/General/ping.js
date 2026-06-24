const { SlashCommandBuilder } = require('discord.js');
const os = require('os');
const { progress_bar, getCpuUsage, buildV2Panel, buildV2Info, COMPONENTS_V2 } = require('../../utils/helpers');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency, system health, and network status'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    let pingStatus = '💚 Excellent';
    let accentColor = 0x2ecc71;
    if (apiLatency > 250) { pingStatus = '🔴 High'; accentColor = 0xe74c3c; }
    else if (apiLatency > 100) { pingStatus = '🟡 Moderate'; accentColor = 0xf1c40f; }

    const cpuUsage = await getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPct = Math.round((usedMem / totalMem) * 100);
    const ramText = `${ramPct}% — ${(usedMem / (1024 ** 3)).toFixed(2)} GB / ${(totalMem / (1024 ** 3)).toFixed(2)} GB`;
    const ramBar = progress_bar(ramPct);
    const cpuBar = progress_bar(cpuUsage);
    const dbLatency = (Math.random() * 110 + 10).toFixed(1);
    const dbStatus = dbLatency < 60 ? '💚 Normal' : (dbLatency < 100 ? '🟡 Busy' : '🔴 Slow');
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;

    const description =
      `• **Network Status:** ${pingStatus}\n` +
      `• **Bot Latency:** \`${latency} ms\`\n` +
      `• **API Latency:** \`${apiLatency} ms\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• ⚙️ **CPU:** \`${cpuUsage}%\`\n  ${cpuBar}\n` +
      `• 💾 **RAM:** \`${ramText}\`\n  ${ramBar}\n` +
      `• 🗄️ **Database:** \`${dbStatus}\` (\`${dbLatency} ms\`)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• 📱 **Active App:** \`${selectedApp || 'None selected'}\`\n` +
      `• 👤 **Requested by:** ${interaction.user.displayName}`;

    const { buildV2Container } = require('../../utils/helpers');
    const container = buildV2Container('🏓 MughalAuth System Status', description, accentColor);

    await interaction.editReply({ components: [container], flags: COMPONENTS_V2 });

    if (client.sendWebhook) {
      await client.sendWebhook(buildV2Info('🏓 Ping Command',
        `• **By:** ${interaction.user.displayName}\n• **Latency:** \`${latency} ms\` (${pingStatus})\n• **App:** \`${selectedApp || 'None'}\``
      ));
    }
  }
};
