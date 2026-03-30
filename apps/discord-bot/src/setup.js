/**
 * One-time setup: creates categories, channels, roles, voice channels, and slash commands.
 * Run with: node src/setup.js
 */
import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes } from "discord.js";
import "dotenv/config";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error("Guild not found"); process.exit(1); }

  // ── Create "Member" role if it doesn't exist ──
  let memberRole = guild.roles.cache.find(r => r.name === "Member");
  if (!memberRole) {
    memberRole = await guild.roles.create({
      name: "Member",
      color: "#635BFF",
      reason: "Threely paid member role",
    });
    console.log(`Created role: ${memberRole.name}`);
  } else {
    console.log(`Role already exists: ${memberRole.name}`);
  }

  const everyone = guild.roles.everyone;

  // ── Helper to find or create a category ──
  async function ensureCategory(name, permissionOverwrites) {
    let cat = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildCategory);
    if (!cat) {
      cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites });
      console.log(`Created category: ${name}`);
    } else {
      console.log(`Category already exists: ${name}`);
    }
    return cat;
  }

  // ── Helper to find or create a channel ──
  async function ensureChannel(name, options) {
    let channel = guild.channels.cache.find(c => c.name === name && c.type === (options.type ?? ChannelType.GuildText));
    if (!channel) {
      channel = await guild.channels.create({ name, ...options });
      console.log(`Created channel: ${options.type === ChannelType.GuildVoice ? "🔊" : "#"}${name}`);
    } else {
      // Try to move to correct category, skip if no permission
      if (options.parent && channel.parentId !== options.parent) {
        try {
          await channel.setParent(options.parent, { lockPermissions: false });
          console.log(`Moved ${name} to correct category`);
        } catch {
          console.log(`Could not move ${name} (no permission) — please move it manually`);
        }
      }
      // Update permissions
      if (options.permissionOverwrites) {
        try {
          await channel.permissionOverwrites.set(options.permissionOverwrites);
          console.log(`Updated permissions for ${name}`);
        } catch {
          console.log(`Could not update permissions for ${name}`);
        }
      }
      console.log(`Channel already exists: ${name}`);
    }
    return channel;
  }

  // ── Category: Threely Community (open channels, read-only for non-members) ──
  const communityCat = await ensureCategory("Threely Community", [
    { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
    { id: memberRole.id, allow: [PermissionFlagsBits.SendMessages] },
  ]);

  // #announcements — read-only for everyone including members
  await ensureChannel("announcements", {
    type: ChannelType.GuildText,
    parent: communityCat.id,
    permissionOverwrites: [
      { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: memberRole.id, deny: [PermissionFlagsBits.SendMessages] },
    ],
  });

  // #erik — read-only for everyone
  await ensureChannel("erik", {
    type: ChannelType.GuildText,
    parent: communityCat.id,
    permissionOverwrites: [
      { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: memberRole.id, deny: [PermissionFlagsBits.SendMessages] },
    ],
  });

  // #general — everyone can read, only Members can type
  await ensureChannel("general", {
    type: ChannelType.GuildText,
    parent: communityCat.id,
    permissionOverwrites: [
      { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: memberRole.id, allow: [PermissionFlagsBits.SendMessages] },
    ],
  });

  // #wins — everyone can read, only Members can type
  await ensureChannel("wins", {
    type: ChannelType.GuildText,
    parent: communityCat.id,
    permissionOverwrites: [
      { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: memberRole.id, allow: [PermissionFlagsBits.SendMessages] },
    ],
  });

  // #verify — everyone can see, only bot sends
  await ensureChannel("verify", {
    type: ChannelType.GuildText,
    parent: communityCat.id,
    topic: "Use /verify to link your Threely subscription and unlock the server.",
    permissionOverwrites: [
      { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages] },
    ],
  });

  // ── Category: Members Only (subscribers only) ──
  const membersCat = await ensureCategory("Members Only", [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
  ]);

  // #inner-circle — only visible + typeable by Members
  await ensureChannel("inner-circle", {
    type: ChannelType.GuildText,
    parent: membersCat.id,
    permissionOverwrites: [
      { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  // 🔊 Community Lounge — voice channel, Members only
  await ensureChannel("Community Lounge", {
    type: ChannelType.GuildVoice,
    parent: membersCat.id,
    permissionOverwrites: [
      { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    ],
  });

  // ── Register slash commands ──
  const commands = [
    new SlashCommandBuilder()
      .setName("verify")
      .setDescription("Verify your Threely subscription to get Member access")
      .addStringOption(opt =>
        opt.setName("email").setDescription("The email you use for Threely").setRequired(true)
      ),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands.map(c => c.toJSON()),
  });
  console.log("Registered slash commands");

  console.log("\nSetup complete!");
  process.exit(0);
});

client.login(TOKEN);
