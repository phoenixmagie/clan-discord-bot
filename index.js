require('dotenv').config();
const {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

const cfg = require('./config.json');
const clanRoles = require('./roles.json');

if (!process.env.DISCORD_TOKEN) {
  console.error(cfg.console.noToken);
  process.exit(1);
}

// Message Content brauchen wir nur, wenn Prefix-Befehle an sind
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers];
if (cfg.prefix.enabled) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

// {platzhalter} im Text ersetzen, unbekannte bleiben einfach stehen
function fill(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// holt Text aus config.messages, Pfad z.B. "clantag.added"
function getText(path, vars) {
  const str = path.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), cfg.messages);
  if (typeof str !== 'string') return `[${path}]`;
  return fill(str, vars);
}

function findCommand(name, type) {
  const lower = name.toLowerCase();
  for (const [key, cmd] of Object.entries(cfg.commands)) {
    if (cmd[type] && cmd.name.toLowerCase() === lower) return { key, cmd };
  }
  return null;
}

function clanRolesOf(member) {
  return member.roles.cache.filter((r) => clanRoles.includes(r.id));
}

function allowed(member, cmd) {
  if (!cmd.allowedRoles.length) return true;
  return cmd.allowedRoles.some((name) => member.roles.cache.has(cfg.roles[name]));
}

function build(kind, content, type) {
  if (type === 'embed') {
    const embed = new EmbedBuilder()
      .setDescription(content)
      .setColor(cfg.colors[kind] || cfg.colors.info);
    if (cfg.embedTitles[kind]) embed.setTitle(cfg.embedTitles[kind]);
    return { embeds: [embed] };
  }
  return { content: (cfg.icons[kind] || '') + content };
}

async function writeLog(action, vars) {
  const mode = cfg.logs.actions[action] || cfg.logs.default;
  const targets = cfg.logs.modes[mode];

  if (!targets) {
    console.warn(fill(cfg.console.unknownLogMode, { mode, action }));
    return;
  }
  if (!targets.length) return;

  const text = getText(`logs.${action}`, vars);

  if (targets.includes('console')) {
    console.log(`[${action}] ${text}`);
  }

  if (targets.includes('channel')) {
    if (!cfg.logs.channelId) {
      console.warn(fill(cfg.console.noLogChannel, { action }));
      return;
    }
    try {
      const channel = await client.channels.fetch(cfg.logs.channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ content: text, allowedMentions: { parse: [] } });
      }
    } catch (err) {
      console.error(fill(cfg.console.logChannelFailed, { error: err.message }));
    }
  }
}

// Rolle bestimmen, die bei einem Toggle-Befehl vergeben wird
async function getRole(ctx) {
  if (ctx.cmd.roleSource === 'executorClanRole') {
    const own = clanRolesOf(ctx.executor);
    if (own.size === 0) return { error: 'general.noOwnClanRole' };
    if (own.size > 1) return { error: 'general.multipleOwnClanRoles' };
    return { role: own.first() };
  }

  const id = cfg.roles[ctx.cmd.roleSource];
  const role = await ctx.executor.guild.roles.fetch(id).catch(() => null);
  if (!role) return { error: 'general.roleMissing' };
  return { role };
}

const handlers = {
  async exit(ctx) {
    const roles = clanRolesOf(ctx.executor);
    if (roles.size === 0) return ctx.reply('error', `${ctx.key}.none`);

    const reason = fill(ctx.cmd.auditReason, { executor: ctx.executor.user.username });
    await ctx.executor.roles.remove([...roles.keys()], reason);

    await ctx.reply('success', `${ctx.key}.done`, {
      roles: roles.map((r) => r.toString()).join(' '),
    });
    await writeLog(`${ctx.key}.done`, {
      executor: ctx.executor.user.username,
      roles: roles.map((r) => r.name).join(', '),
    });
  },

  async toggle(ctx) {
    const { executor, target } = ctx;

    if (!target) return ctx.reply('error', 'general.missingTarget', { usage: ctx.usage });
    if (target.user.bot) return ctx.reply('error', 'general.botTarget');

    const res = await getRole(ctx);
    if (res.error) return ctx.reply('error', res.error);
    const role = res.role;

    const reason = fill(ctx.cmd.auditReason, { executor: executor.user.username });
    const hasRole = target.roles.cache.has(role.id);

    if (hasRole) {
      await target.roles.remove(role, reason);
    } else {
      await target.roles.add(role, reason);
    }

    const state = hasRole ? 'removed' : 'added';
    await ctx.reply('success', `${ctx.key}.${state}`, {
      user: target.toString(),
      role: role.toString(),
    });
    await writeLog(`${ctx.key}.${state}`, {
      executor: executor.user.username,
      target: target.user.username,
      role: role.name,
    });
  },
};

async function run(ctx) {
  try {
    if (!allowed(ctx.executor, ctx.cmd)) {
      return await ctx.reply('error', ctx.cmd.noPermission);
    }
    await handlers[ctx.cmd.action](ctx);
  } catch (err) {
    console.error(err);
    await writeLog('error', { command: ctx.cmd.name, error: err.message });
    await ctx.reply('error', 'general.error').catch(() => {});
  }
}

// ---------- Prefix ----------

client.on('messageCreate', async (message) => {
  if (!cfg.prefix.enabled) return;
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(cfg.prefix.symbol)) return;

  const parts = message.content.slice(cfg.prefix.symbol.length).trim().split(/\s+/);
  const name = parts.shift() || '';
  const found = findCommand(name, 'prefix');
  if (!found) return;

  const rp = cfg.responses.prefix;

  const reply = async (kind, path, vars) => {
    const payload = build(kind, getText(path, vars), rp.type);
    payload.allowedMentions = { parse: [], repliedUser: rp.pingUser };

    const sent = rp.replyToMessage
      ? await message.reply(payload)
      : await message.channel.send(payload);

    if (rp.deleteAfterSeconds > 0) {
      setTimeout(() => {
        if (rp.deleteCommand) message.delete().catch(() => {});
        if (rp.deleteReply) sent.delete().catch(() => {});
      }, rp.deleteAfterSeconds * 1000);
    }
  };

  // Kanal prüfen: leere Liste = überall erlaubt
  const channelId = message.channel.id;
  const whitelist = found.cmd.prefixChannels;
  const blocked = cfg.prefix.blockedChannels.includes(channelId);
  const notInList = whitelist.length > 0 && !whitelist.includes(channelId);

  if (blocked || notInList) {
    if (cfg.prefix.wrongChannelAction === 'reply') {
      const list = whitelist.map((id) => `<#${id}>`).join(', ');
      await reply('error', 'general.wrongChannel', { channels: list }).catch(() => {});
    }
    return;
  }

  const executor = message.member || (await message.guild.members.fetch(message.author.id));

  // Ziel: Erwähnung oder reine ID
  let target = message.mentions.members.first() || null;
  if (!target && /^\d{17,20}$/.test(parts[0] || '')) {
    target = await message.guild.members.fetch(parts[0]).catch(() => null);
  }

  await run({
    key: found.key,
    cmd: found.cmd,
    executor,
    target,
    reply,
    usage: fill(cfg.usage.prefix, { prefix: cfg.prefix.symbol, name: found.cmd.name }),
  });
});

// ---------- Slash ----------

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  const found = findCommand(interaction.commandName, 'slash');
  if (!found) return;

  const rs = cfg.responses.slash;

  await interaction.deferReply(rs.ephemeral ? { flags: MessageFlags.Ephemeral } : {});

  const executor = await interaction.guild.members.fetch(interaction.user.id);
  const userOpt = interaction.options.getUser(found.cmd.optionName || 'user');
  const target = userOpt
    ? await interaction.guild.members.fetch(userOpt.id).catch(() => null)
    : null;

  const reply = (kind, path, vars) =>
    interaction.editReply(build(kind, getText(path, vars), rs.type));

  await run({
    key: found.key,
    cmd: found.cmd,
    executor,
    target,
    reply,
    usage: fill(cfg.usage.slash, { name: found.cmd.name }),
  });
});

// ---------- Start ----------

client.once('ready', async () => {
  console.log(fill(cfg.console.ready, { tag: client.user.tag }));

  if (!cfg.slash.enabled) return;

  const list = Object.values(cfg.commands)
    .filter((cmd) => cmd.slash)
    .map((cmd) => {
      const builder = new SlashCommandBuilder()
        .setName(cmd.name)
        .setDescription(cmd.description);

      if (cmd.needsUser) {
        builder.addUserOption((o) =>
          o
            .setName(cmd.optionName)
            .setDescription(cmd.optionDescription)
            .setRequired(true)
        );
      }
      return builder.toJSON();
    });

  try {
    if (cfg.slash.guildId) {
      const guild = await client.guilds.fetch(cfg.slash.guildId);
      await guild.commands.set(list);
      console.log(fill(cfg.console.slashGuild, { guild: guild.name }));
    } else {
      await client.application.commands.set(list);
      console.log(cfg.console.slashGlobal);
    }
  } catch (err) {
    console.error(fill(cfg.console.slashFailed, { error: err.message }));
  }
});

process.on('unhandledRejection', (err) => {
  console.error(cfg.console.unhandled, err);
});

client.login(process.env.DISCORD_TOKEN);
