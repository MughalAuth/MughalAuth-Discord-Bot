const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user_info')
    .setDescription('Get detailed user information')
    .addStringOption(option => 
      option.setName('username').setDescription('Username to get info for').setRequired(true)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username');
    
    const params = {
      type: 'fetchallusers'
    };
    
    const result = await mughalauth_request(params, sellerKey);
    
    let container;
    if (result.success && result.users) {
      const userObj = result.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (userObj) {
        const desc = 
          `• **Application:** \`${selectedApp}\`\n` +
          `• **Username:** \`${userObj.username}\`\n` +
          `• **Email:** \`${userObj.email || "N/A"}\`\n` +
          `• **Created Date:** \`${userObj.createdate ? new Date(parseInt(userObj.createdate) * 1000).toLocaleString() : "N/A"}\`\n` +
          `• **Last Login:** \`${userObj.lastlogin ? new Date(parseInt(userObj.lastlogin) * 1000).toLocaleString() : "N/A"}\`\n` +
          `• **Banned:** \`${userObj.banned ? `Yes (${userObj.banned})` : "No"}\`\n` +
          `• **HWID:** \`\`\`${userObj.hwid || "Not set"}\`\`\``;

        container = buildV2Container(`📊 MughalAuth User Info - ${userObj.username}`, desc, 0x3498db);

        // Webhook log
        if (client.sendWebhook) {
          const webhookDesc = 
            `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
            `• **Target Username:** ${userObj.username}\n` +
            `• **Application:** ${selectedApp}`;
          const webhookContainer = buildV2Container("📊 User Info Viewed", webhookDesc, 0x3498db);
          await client.sendWebhook(webhookContainer);
        }
      } else {
        container = buildV2Container(
          "❌ User Not Found", 
          `User **${username}** could not be found in application **${selectedApp}**`, 
          0xe74c3c
        );
      }
    } else {
      let errorMsg = result.message || 'Unknown error';
      container = buildV2Container("❌ User Info Failed", `**Error:** ${errorMsg}`, 0xe74c3c);
    }
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
  }
};
