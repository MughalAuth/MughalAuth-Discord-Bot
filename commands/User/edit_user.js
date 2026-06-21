const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const { mughalauth_request } = require('../../utils/mughalauth_api');
const { buildV2Container } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_user')
    .setDescription('Edit user details (password, email, subscription, or expiry)')
    .addStringOption(option => 
      option.setName('username').setDescription('Username of user to edit').setRequired(true))
    .addStringOption(option => 
      option.setName('new_password').setDescription('New password').setRequired(false))
    .addStringOption(option => 
      option.setName('new_email').setDescription('New email address').setRequired(false))
    .addStringOption(option => 
      option.setName('new_subscription').setDescription('New subscription level').setRequired(false))
    .addIntegerOption(option => 
      option.setName('new_expiry_days').setDescription('New expiry in days').setRequired(false)),
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    
    const selectedApp = client.userSelectedApps[interaction.user.id] || config.DEFAULT_APP;
    if (!selectedApp) {
      const container = buildV2Container("❌ No Application Selected", "Please select an application using `/selectapplication` first!", 0xe74c3c);
      return interaction.editReply({ components: [container] });
    }
    
    const sellerKey = config.APPLICATIONS[selectedApp];
    const username = interaction.options.getString('username');
    const newPassword = interaction.options.getString('new_password');
    const newEmail = interaction.options.getString('new_email');
    const newSubscription = interaction.options.getString('new_subscription');
    const newExpiryDays = interaction.options.getInteger('new_expiry_days');
    
    const params = {
      type: 'edituser',
      user: username
    };
    
    if (newPassword) params.pass = newPassword;
    if (newEmail !== null) params.email = newEmail;
    if (newSubscription) params.sub = newSubscription;
    if (newExpiryDays !== null) params.expiry = newExpiryDays;
    
    if (!newPassword && newEmail === null && !newSubscription && newExpiryDays === null) {
      const container = buildV2Container("⚠️ No Changes Specified", "Please specify at least one field to update (password, email, sub, or expiry).", 0xe67e22);
      return interaction.editReply({ components: [container] });
    }
    
    const result = await mughalauth_request(params, sellerKey);
    
    let desc = `User details for **${username}** updated in application **${selectedApp}**`;
    if (result.success) {
      desc += `\n\n**Updated Fields:**`;
      if (newPassword) desc += `\n• **Password:** ||${newPassword}||`;
      if (newEmail !== null) desc += `\n• **Email:** \`${newEmail || 'Cleared'}\``;
      if (newSubscription) desc += `\n• **Subscription:** \`${newSubscription}\``;
      if (newExpiryDays !== null) desc += `\n• **Expiry Days:** \`${newExpiryDays} days\``;
    } else {
      desc = `**Error:** ${result.message || 'Unknown error'}`;
    }
    
    const container = buildV2Container(
      result.success ? "📝 User Updated Successfully" : "❌ User Update Failed",
      desc,
      result.success ? 0x2ecc71 : 0xe74c3c
    );
    
    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
    
    if (result.success && client.sendWebhook) {
      let webhookDesc = `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
        `• **Target Username:** ${username}\n` +
        `• **Application:** ${selectedApp}\n` +
        `• **Changes:**`;
      if (newPassword) webhookDesc += `\n  - Password updated`;
      if (newEmail !== null) webhookDesc += `\n  - Email: ${newEmail || 'Cleared'}`;
      if (newSubscription) webhookDesc += `\n  - Subscription: ${newSubscription}`;
      if (newExpiryDays !== null) webhookDesc += `\n  - Expiry: ${newExpiryDays} days`;
      
      const webhookContainer = buildV2Container("📝 User Updated", webhookDesc, 0x2ecc71);
      await client.sendWebhook(webhookContainer);
    }
  }
};
