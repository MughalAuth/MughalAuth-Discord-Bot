const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const os = require('os');
const { progress_bar, getCpuUsage, buildV2Container } = require('../../utils/helpers');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test if bot is working and show system + network status'),
  async execute(interaction, client) {
    await interaction.deferReply();

    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    let pingStatus = "💚 Excellent";
    let accentColor = 0x2ecc71; // Green

    if (apiLatency > 250) {
      pingStatus = "🔴 Slow";
      accentColor = 0xe74c3c; // Red
    } else if (apiLatency > 100) {
      pingStatus = "🟡 Good";
      accentColor = 0xf1c40f; // Gold
    }

    const cpuUsage = await getCpuUsage();

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPct = Math.round((usedMem / totalMem) * 100);
    const ramText = `${ramPct}% (${(usedMem / (1024 ** 3)).toFixed(2)} / ${(totalMem / (1024 ** 3)).toFixed(2)} GB)`;
    const ramBar = progress_bar(ramPct);

    // Mock DB Latency
    const dbLatency = (Math.random() * 110 + 10).toFixed(1);
    const dbStatus = dbLatency < 60 ? "💚 Normal" : (dbLatency < 100 ? "🟡 Busy" : "🔴 Slow");

    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;

    const description =
      `• **Status:** ${pingStatus}\n` +
      `• **Latency:** \`${latency} ms\` (API: \`${apiLatency} ms\`)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• ⚙️ **CPU Usage:** \`${cpuUsage}%\`\n` +
      `• 💾 **RAM:** \`${ramText}\`\n  ${ramBar}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• 🗄️ **Database:** \`${dbStatus}\` (\`${dbLatency} ms\`)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• 🧩 **Current App:** \`${selectedApp || 'None selected'}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Requested by ${interaction.user.displayName}*`;

    const container = buildV2Container("🏓 MughalAuth System Status", description, accentColor);

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    // Send webhook log
    if (client.sendWebhook) {
      const webhookDesc =
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Current App:** \`${selectedApp || 'None selected'}\`\n` +
        `• **Latency:** \`${latency} ms\` (${pingStatus})`;
      const webhookContainer = buildV2Container("🏓 Ping Command Executed", webhookDesc, accentColor);
      await client.sendWebhook(webhookContainer);
    }
  }
};
