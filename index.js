const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  REST, 
  Routes, 
  WebhookClient,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { mughalauth_request } = require('./utils/mughalauth_api');
const { buildV2Container } = require('./utils/helpers');

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Setup dynamic variables
client.commands = new Collection();
client.userSelectedApps = {};

// Setup logging Webhook
const webhookClient = config.WEBHOOK_URL ? new WebhookClient({ url: config.WEBHOOK_URL }) : null;

client.sendWebhook = async (container) => {
  if (!webhookClient) {
    console.log("⚠️ WEBHOOK_URL not configured - webhook logs disabled");
    return;
  }
  try {
    await webhookClient.send({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
  } catch (err) {
    console.error(`❌ Failed to send webhook: ${err.message}`);
  }
};

// Helper: Check Role Authorization
function isAuthorized(member) {
  if (!member) return false;
  return member.roles.cache.some(role => role.name === config.ALLOWED_ROLE_NAME);
}

const authErrorContainer = buildV2Container(
  "🔒 Access Denied",
  `You need the \`${config.ALLOWED_ROLE_NAME}\` role to use this bot!`,
  0xe74c3c
);

// Helper: Get active application
function getActiveApp(userId) {
  return client.userSelectedApps[userId] || config.DEFAULT_APP;
}

// Load commands recursively from /commands directory and its subfolders
const commandsPath = path.join(__dirname, 'commands');
const commandsList = [];

function loadCommands(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith('.js')) {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsList.push(command.data.toJSON());
      } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }
}
loadCommands(commandsPath);

// Client events: Ready
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  console.log(`✅ MughalAuth Bot is ready!`);
  console.log(`✅ Only users with "${config.ALLOWED_ROLE_NAME}" role can use this bot.`);
  console.log(`✅ Available applications: ${Object.keys(config.APPLICATIONS).join(', ')}`);

  // Register slash commands globally
  const rest = new REST().setToken(config.TOKEN);
  try {
    console.log(`🔄 Started refreshing ${commandsList.length} application (/) commands.`);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsList },
    );
    console.log(`✅ Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error(`❌ Failed to reload commands: ${error}`);
  }
});

// Client events: Interaction Create
client.on('interactionCreate', async (interaction) => {
  // 1. Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Check authorization role
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ 
        components: [authErrorContainer], 
        flags: MessageFlags.IsComponentsV2, 
        ephemeral: true 
      });
    }

    // Rate Limit / Cooldown check
    if (!client.cooldowns) {
      client.cooldowns = new Collection();
    }
    
    const now = Date.now();
    const cooldownAmount = (command.cooldown || config.COOLDOWN_SECONDS || 5) * 1000;
    const timestamps = client.cooldowns.get(interaction.user.id) || new Map();
    
    if (timestamps.has(command.data.name)) {
      const expirationTime = timestamps.get(command.data.name) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        const cooldownContainer = buildV2Container(
          "⏳ Cooldown Active",
          `Please wait **${timeLeft.toFixed(1)}** more second(s) before reusing the \`/${command.data.name}\` command.`,
          0xe67e22
        );
        return interaction.reply({
          components: [cooldownContainer],
          flags: MessageFlags.IsComponentsV2,
          ephemeral: true
        });
      }
    }
    
    timestamps.set(command.data.name, now);
    client.cooldowns.set(interaction.user.id, timestamps);

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const errorResponse = { content: 'There was an error while executing this command!', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followup(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    }
    return;
  }

  // 2. Handle Select Menu Submissions (e.g. app selection)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_app_dropdown') {
      if (!isAuthorized(interaction.member)) {
        return interaction.reply({ 
          components: [authErrorContainer], 
          flags: MessageFlags.IsComponentsV2, 
          ephemeral: true 
        });
      }

      const selectedApp = interaction.values[0];
      client.userSelectedApps[interaction.user.id] = selectedApp;

      const successContainer = buildV2Container(
        "✅ Application Selected",
        `**${selectedApp}** is now your active application`,
        0x2ecc71
      );

      await interaction.reply({ 
        components: [successContainer], 
        flags: MessageFlags.IsComponentsV2, 
        ephemeral: true 
      });

      // Webhook log
      const webhookContainer = buildV2Container(
        "📱 Application Selected",
        `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n• **Selected App:** \`${selectedApp}\``,
        0x3498db
      );
      await client.sendWebhook(webhookContainer);
    }
    return;
  }

  // 3. Handle Button Clicks (Opening modals)
  if (interaction.isButton()) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ 
        components: [authErrorContainer], 
        flags: MessageFlags.IsComponentsV2, 
        ephemeral: true 
      });
    }

    const selectedApp = getActiveApp(interaction.user.id);
    if (!selectedApp) {
      const errorContainer = buildV2Container(
        "❌ No Application Selected",
        "Please select an application using `/selectapplication` first!",
        0xe74c3c
      );
      return interaction.reply({ 
        components: [errorContainer], 
        flags: MessageFlags.IsComponentsV2, 
        ephemeral: true 
      });
    }

    // Modal: CREATE LICENSE
    if (interaction.customId === 'admin_btn_create_license') {
      const modal = new ModalBuilder()
        .setCustomId('modal_create_license')
        .setTitle('🔑 Generate License Key(s)');

      const levelInput = new TextInputBuilder()
        .setCustomId('lvl')
        .setLabel('License level')
        .setValue('default')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const expiryInput = new TextInputBuilder()
        .setCustomId('expiry_days')
        .setLabel('Expiry duration (in Days)')
        .setValue('30')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Number of licenses to create')
        .setValue('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const formatInput = new TextInputBuilder()
        .setCustomId('format')
        .setLabel('License format')
        .setValue('XXXXX-XXXXX-XXXXX-XXXXX')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(levelInput),
        new ActionRowBuilder().addComponents(expiryInput),
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(formatInput)
      );

      await interaction.showModal(modal);
    }

    // Modal: CREATE USER
    if (interaction.customId === 'admin_btn_create_user') {
      const modal = new ModalBuilder()
        .setCustomId('modal_create_user')
        .setTitle('👤 Create User Account');

      const userInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const passInput = new TextInputBuilder()
        .setCustomId('password')
        .setLabel('Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const emailInput = new TextInputBuilder()
        .setCustomId('email')
        .setLabel('Email address (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const subInput = new TextInputBuilder()
        .setCustomId('subscription')
        .setLabel('Subscription level')
        .setValue('default')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const expiryInput = new TextInputBuilder()
        .setCustomId('expiry_days')
        .setLabel('Expiry duration (in Days)')
        .setValue('30')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(passInput),
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(subInput),
        new ActionRowBuilder().addComponents(expiryInput)
      );

      await interaction.showModal(modal);
    }

    // Modal: RESET HWID
    if (interaction.customId === 'admin_btn_reset_hwid') {
      const modal = new ModalBuilder()
        .setCustomId('modal_reset_hwid')
        .setTitle('🔄 Reset User HWID');

      const userInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
    }

    // Modal: USER INFO
    if (interaction.customId === 'admin_btn_user_info') {
      const modal = new ModalBuilder()
        .setCustomId('modal_user_info')
        .setTitle('📊 View User Information');

      const userInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
    }

    // Modal: DELETE USER
    if (interaction.customId === 'admin_btn_delete_user') {
      const modal = new ModalBuilder()
        .setCustomId('modal_delete_user')
        .setTitle('🗑️ Delete User Account');

      const userInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Username to permanently delete')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
    }

    // Modal: BAN USER
    if (interaction.customId === 'admin_btn_ban_user') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ban_user')
        .setTitle('🔨 Ban User Account');

      const userInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Username to ban')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Ban reason')
        .setValue('Banned via Admin Panel')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      await interaction.showModal(modal);
    }
    return;
  }

  // 4. Handle Modal Form Submissions
  if (interaction.isModalSubmit()) {
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({ content: authErrorContent, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const selectedApp = getActiveApp(interaction.user.id);
    const sellerKey = config.APPLICATIONS[selectedApp];

    // Helper to format responses dynamically as V2 container
    function buildResponseV2(res, successTitle, successDesc, errorTitle = '❌ Action Failed', accentColor = 0x2ecc71) {
      if (res.success) {
        return buildV2Container(successTitle, successDesc, accentColor);
      } else {
        let errorMsg = res.message || 'Unknown error';
        if (errorMsg.includes('Unhandled type parameter')) {
          errorMsg = "This command endpoint is unsupported by your self-hosted MughalAuth panel's seller API. You must extend `api/seller/index.php` on your server to support this action.";
        }
        return buildV2Container(errorTitle, `**Error:** ${errorMsg}`, 0xe74c3c);
      }
    }

    // Modal Submission: CREATE LICENSE
    if (interaction.customId === 'modal_create_license') {
      const level = interaction.fields.getTextInputValue('lvl');
      const expiryDays = parseInt(interaction.fields.getTextInputValue('expiry_days')) || 30;
      const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
      const format = interaction.fields.getTextInputValue('format');

      if (amount > 10) {
        const errorContainer = buildV2Container(
          "❌ Generation Limit Exceeded",
          "You can generate a maximum of **10** licenses at a time.",
          0xe74c3c
        );
        return interaction.editReply({ 
          components: [errorContainer], 
          flags: MessageFlags.IsComponentsV2 
        });
      }

      const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 86400);

      const params = {
        type: 'add',
        level,
        amount,
        format,
        expiry: expiryTimestamp
      };

      const result = await mughalauth_request(params, sellerKey);
      
      let desc = `Created **${amount}** license key(s) in application **${selectedApp}**`;
      if (result.success) {
        desc += 
          `\n\n• **Level:** \`${level}\`` +
          `\n• **Amount:** \`${amount}\`` +
          `\n• **Expiry Days:** \`${expiryDays} days\``;

        if (result.keys && result.keys.length === 1) {
          desc += `\n• **License Key:** \`\`\`${result.keys[0]}\`\`\``;
        } else if (result.keys && result.keys.length > 1) {
          const keysStr = result.keys.map(k => `\`${k}\``).join('\n');
          desc += `\n• **License Keys:**\n${keysStr.slice(0, 1000)}`;
        }
      }

      const container = buildResponseV2(
        result,
        "🔑 MughalAuth License(s) Created Successfully",
        desc,
        "❌ License Creation Failed",
        0x2ecc71
      );

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      if (result.success) {
        const webhookDesc = 
          `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
          `• **Application:** ${selectedApp}\n` +
          `• **Amount:** ${amount}\n` +
          `• **Level:** ${level}\n` +
          `• **Expiry:** ${expiryDays} days`;
        const webhookContainer = buildV2Container("🔑 MughalAuth License(s) Created", webhookDesc, 0x2ecc71);
        await client.sendWebhook(webhookContainer);
      }
    }

    // Modal Submission: CREATE USER
    if (interaction.customId === 'modal_create_user') {
      const username = interaction.fields.getTextInputValue('username');
      const password = interaction.fields.getTextInputValue('password');
      const email = interaction.fields.getTextInputValue('email');
      const subscription = interaction.fields.getTextInputValue('subscription');
      const expiryDays = parseInt(interaction.fields.getTextInputValue('expiry_days')) || 30;

      const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 86400);

      const params = {
        type: 'adduser',
        user: username,
        pass: password,
        email: email || '',
        sub: subscription,
        expiry: expiryTimestamp
      };

      const result = await mughalauth_request(params, sellerKey);
      
      let desc = `User **${username}** has been created in application **${selectedApp}**`;
      if (result.success) {
        desc += 
          `\n\n• **Username:** \`${username}\`` +
          `\n• **Password:** ||${password}||` +
          `\n• **Email:** \`${email || 'N/A'}\`` +
          `\n• **Subscription:** \`${subscription}\`` +
          `\n• **Expiry Days:** \`${expiryDays} days\``;
      }

      const container = buildResponseV2(
        result,
        "✅ User Created Successfully",
        desc,
        "❌ User Creation Failed",
        0x2ecc71
      );

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      if (result.success) {
        const webhookDesc = 
          `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
          `• **Created Username:** ${username}\n` +
          `• **Application:** ${selectedApp}`;
        const webhookContainer = buildV2Container("✅ New User Created", webhookDesc, 0x2ecc71);
        await client.sendWebhook(webhookContainer);
      }
    }

    // Modal Submission: RESET HWID
    if (interaction.customId === 'modal_reset_hwid') {
      const username = interaction.fields.getTextInputValue('username');

      const params = {
        type: 'resetuser',
        user: username
      };

      const result = await mughalauth_request(params, sellerKey);
      
      const container = buildResponseV2(
        result,
        "🔄 HWID Reset Successful",
        `HWID reset for user **${username}** in application **${selectedApp}**`,
        "❌ HWID Reset Failed",
        0x2ecc71
      );

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      if (result.success) {
        const webhookDesc = 
          `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
          `• **Target Username:** ${username}\n` +
          `• **Application:** ${selectedApp}`;
        const webhookContainer = buildV2Container("🔄 HWID Reset Executed", webhookDesc, 0x2ecc71);
        await client.sendWebhook(webhookContainer);
      }
    }

    // Modal Submission: DELETE USER
    if (interaction.customId === 'modal_delete_user') {
      const username = interaction.fields.getTextInputValue('username');

      const params = {
        type: 'deluser',
        user: username
      };

      const result = await mughalauth_request(params, sellerKey);
      
      const container = buildResponseV2(
        result,
        "🗑️ User Deleted Successfully",
        `User **${username}** deleted from application **${selectedApp}**`,
        "❌ User Deletion Failed",
        0xe74c3c
      );

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      if (result.success) {
        const webhookDesc = 
          `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
          `• **Deleted Username:** ${username}\n` +
          `• **Application:** ${selectedApp}`;
        const webhookContainer = buildV2Container("🗑️ User Deleted Executed", webhookDesc, 0xe74c3c);
        await client.sendWebhook(webhookContainer);
      }
    }

    // Modal Submission: BAN USER
    if (interaction.customId === 'modal_ban_user') {
      const username = interaction.fields.getTextInputValue('username');
      const reason = interaction.fields.getTextInputValue('reason');

      const params = {
        type: 'banuser',
        user: username,
        reason
      };

      const result = await mughalauth_request(params, sellerKey);
      
      let desc = `User **${username}** has been banned in application **${selectedApp}**`;
      if (result.success) {
        desc += `\n\n• **Reason:** \`${reason}\``;
      }

      const container = buildResponseV2(
        result,
        "🔨 User Banned Successfully",
        desc,
        "❌ Ban Failed",
        0xe74c3c
      );

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });

      if (result.success) {
        const webhookDesc = 
          `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
          `• **Banned Username:** ${username}\n` +
          `• **Reason:** ${reason}\n` +
          `• **Application:** ${selectedApp}`;
        const webhookContainer = buildV2Container("🔨 User Banned Executed", webhookDesc, 0xe74c3c);
        await client.sendWebhook(webhookContainer);
      }
    }

    // Modal Submission: USER INFO
    if (interaction.customId === 'modal_user_info') {
      const username = interaction.fields.getTextInputValue('username');

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
          const webhookDesc = 
            `• **User:** ${interaction.user.displayName} (ID: ${interaction.user.id})\n` +
            `• **Target Username:** ${userObj.username}\n` +
            `• **Application:** ${selectedApp}`;
          const webhookContainer = buildV2Container("📊 User Info Viewed", webhookDesc, 0x3498db);
          await client.sendWebhook(webhookContainer);
        } else {
          container = buildV2Container(
            "❌ User Not Found", 
            `User **${username}** could not be found in application **${selectedApp}**`, 
            0xe74c3c
          );
        }
      } else {
        container = buildResponseV2(
          result,
          "",
          "",
          "❌ User Info Failed"
        );
      }

      await interaction.editReply({ 
        components: [container], 
        flags: MessageFlags.IsComponentsV2 
      });
    }
  }
});

// Run bot client
if (!config.TOKEN) {
  console.error("❌ Please set DISCORD_BOT_TOKEN in the .env file");
  process.exit(1);
} else if (Object.keys(config.APPLICATIONS).length === 0) {
  console.error("❌ Please configure at least one application in the .env file");
  process.exit(1);
} else {
  client.login(config.TOKEN).catch(err => {
    console.error(`❌ Fatal Error during login: ${err.message}`);
    process.exit(1);
  });
}
