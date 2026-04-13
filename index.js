require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || "!";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";
const COOLDOWN_MINUTES = Number(process.env.COOLDOWN_MINUTES || 60);
const BANNER_URL = process.env.BANNER_URL || "";

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const cooldowns = new Map();

const rewards = [
  {
    name: "Nothing",
    emoji: "❌",
    chance: 50,
    rarity: "Common",
    color: 0x7f8c8d,
    win: false,
    dmText: null
  },
  {
    name: "Coupon Code",
    emoji: "🎟️",
    chance: 25,
    rarity: "Rare",
    color: 0xf1c40f,
    win: true,
    dmText: "Συγχαρητήρια! Κέρδισες **Coupon Code**."
  },
  {
    name: "1 Rockstars",
    emoji: "⭐",
    chance: 10,
    rarity: "Epic",
    color: 0x3498db,
    win: true,
    dmText: "Συγχαρητήρια! Κέρδισες **1 Rockstars**."
  },
  {
    name: "10 Rockstars",
    emoji: "🔥",
    chance: 10,
    rarity: "Legendary",
    color: 0x9b59b6,
    win: true,
    dmText: "Συγχαρητήρια! Κέρδισες **10 Rockstars**."
  },
  {
    name: "5 Rockstars",
    emoji: "💎",
    chance: 5,
    rarity: "Diamond",
    color: 0x00e5ff,
    win: true,
    dmText: "Συγχαρητήρια! Κέρδισες **5 Rockstars**."
  }
];

function pickReward() {
  const roll = Math.random() * 100;
  let current = 0;

  for (const reward of rewards) {
    current += reward.chance;
    if (roll <= current) return reward;
  }

  return rewards[0];
}

function getRemainingCooldown(userId) {
  const now = Date.now();
  const expiresAt = cooldowns.get(userId);

  if (!expiresAt) return 0;
  if (now >= expiresAt) {
    cooldowns.delete(userId);
    return 0;
  }

  return expiresAt - now;
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function buildSpinEmbed(message, reward) {
  const embed = new EmbedBuilder()
    .setColor(reward.color)
    .setTitle("🎡 Spin Result")
    .setDescription(`${reward.emoji} Ο ${message.author} έκανε spin!`)
    .addFields(
      {
        name: "👤 Player",
        value: `${message.member?.displayName || message.author.username}`,
        inline: false
      },
      {
        name: "🎁 Reward",
        value: `${reward.emoji} ${reward.name}`,
        inline: false
      },
      {
        name: "⭐ Rarity",
        value: reward.rarity,
        inline: false
      }
    )
    .setFooter({ text: "Niro Market Spin System" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

function buildChancesEmbed(message) {
  const lines = rewards.map(
    (reward) => `${reward.emoji} **${reward.name}** — ${reward.chance}%`
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("📊 Spin Chances")
    .setDescription(lines.join("\n"))
    .addFields({
      name: "👤 Player",
      value: `${message.member?.displayName || message.author.username}`,
      inline: false
    })
    .setFooter({ text: "Niro Market Chances" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

async function sendLog(message, reward, dmStatus) {
  if (!LOG_CHANNEL_ID) return;

  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(reward.color)
      .setTitle("📝 Spin Log")
      .addFields(
        {
          name: "User",
          value: `${message.author.tag} (${message.author.id})`,
          inline: false
        },
        {
          name: "Reward",
          value: `${reward.emoji} ${reward.name}`,
          inline: true
        },
        {
          name: "Rarity",
          value: reward.rarity,
          inline: true
        },
        {
          name: "DM Status",
          value: dmStatus,
          inline: false
        }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Log send error:", error);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === "chances") {
    const embed = buildChancesEmbed(message);
    await message.reply({ embeds: [embed] });
    return;
  }

  if (command === "spin") {
    const remaining = getRemainingCooldown(message.author.id);

    if (remaining > 0) {
      await message.reply(
        `⏳ Πρέπει να περιμένεις ακόμα **${formatDuration(remaining)}** για να ξανακάνεις spin.`
      );
      return;
    }

    const reward = pickReward();
    cooldowns.set(
      message.author.id,
      Date.now() + COOLDOWN_MINUTES * 60 * 1000
    );

    const embed = buildSpinEmbed(message, reward);
    await message.reply({ embeds: [embed] });

    let dmStatus = "No DM sent";

    if (reward.win && reward.dmText) {
      try {
        await message.author.send(
          `${reward.emoji} ${reward.dmText}\n\nReward: **${reward.name}**\nRarity: **${reward.rarity}**`
        );
        dmStatus = "DM sent successfully";
      } catch (error) {
        dmStatus = "DM failed";
      }
    }

    await sendLog(message, reward, dmStatus);
  }
});

client.login(TOKEN);
