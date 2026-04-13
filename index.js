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

const BANNER_URL =
  process.env.BANNER_URL ||
  "https://i.ibb.co/fd9yngNN/Gemini-Generated-Image-1.png";

const DM_SIDE_IMAGE_URL =
  process.env.DM_SIDE_IMAGE_URL ||
  "https://i.ibb.co/QFPFt4b6/Gemini-Generated-Image-removebg-preview-removebg-preview.png";

const UNLIMITED_SPINS_ROLE_ID = "1480671765909733472";
const ALLOWED_CHANNEL_ID = "1493149839805120602";
const BRAND_COLOR = 0x2ecc70;

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
    color: BRAND_COLOR,
    win: false
  },
  {
    name: "Coupon Code",
    emoji: "🎟️",
    chance: 25,
    rarity: "Rare",
    color: BRAND_COLOR,
    win: true,
    couponDiscount: "25%",
    couponValidFor: "2 days"
  },
  {
    name: "1 Rockstars",
    emoji: "⭐",
    chance: 10,
    rarity: "Epic",
    color: BRAND_COLOR,
    win: true
  },
  {
    name: "10 Rockstars",
    emoji: "🔥",
    chance: 10,
    rarity: "Legendary",
    color: BRAND_COLOR,
    win: true
  },
  {
    name: "5 Rockstars",
    emoji: "💎",
    chance: 5,
    rarity: "Diamond",
    color: BRAND_COLOR,
    win: true
  }
];

function pickReward() {
  const roll = Math.random() * 100;
  let current = 0;

  for (const reward of rewards) {
    current += reward.chance;
    if (roll <= current) {
      return reward;
    }
  }

  return rewards[0];
}

function generateCouponCode(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "NIRO-";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
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

function hasUnlimitedSpins(member) {
  return member?.roles?.cache?.has(UNLIMITED_SPINS_ROLE_ID);
}

function buildSpinEmbed(message, reward) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎰 Spin Result")
    .setDescription(`${reward.emoji} ${message.author} spun the wheel!`)
    .addFields(
      {
        name: "👤 Player",
        value: message.member?.displayName || message.author.username,
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
    .setThumbnail(
      message.author.displayAvatarURL({ extension: "png", size: 512 })
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
    .setColor(BRAND_COLOR)
    .setTitle("🎰 Spin Chances")
    .setDescription(lines.join("\n"))
    .addFields({
      name: "👤 Player",
      value: message.member?.displayName || message.author.username,
      inline: false
    })
    .setThumbnail(
      message.author.displayAvatarURL({ extension: "png", size: 512 })
    )
    .setFooter({ text: "Niro Market Chances" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

function buildCouponDmEmbed(user, couponCode, reward) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: "Marketplace" })
    .setTitle("🎟️ Marketplace Discount Coupon")
    .setDescription(`🔴 Hello ${user}, here is your discount coupon!`)
    .addFields(
      {
        name: "📉 Discount",
        value: reward.couponDiscount || "25%",
        inline: true
      },
      {
        name: "🪝 Valid For",
        value: reward.couponValidFor || "2 days",
        inline: true
      },
      {
        name: "📌 Coupon ID",
        value: `\`${couponCode}\``,
        inline: true
      }
    )
    .setThumbnail(DM_SIDE_IMAGE_URL)
    .setFooter({
      text: "Coupon is valid ONLY for bots & tools!"
    })
    .setTimestamp();
}

function buildRewardDmEmbed(user, reward) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: "Marketplace" })
    .setTitle("🎁 Reward Claimed")
    .setDescription(`🔴 Hello ${user}, you won a reward!`)
    .addFields(
      {
        name: "🎁 Reward",
        value: `${reward.emoji} ${reward.name}`,
        inline: true
      },
      {
        name: "⭐ Rarity",
        value: reward.rarity,
        inline: true
      }
    )
    .setThumbnail(DM_SIDE_IMAGE_URL)
    .setFooter({
      text: "Thank you for using Niro Market!"
    })
    .setTimestamp();
}

async function sendLog(message, reward, dmStatus) {
  if (!LOG_CHANNEL_ID) return;
  if (!reward.win) return;

  try {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
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
      .setThumbnail(
        message.author.displayAvatarURL({ extension: "png", size: 512 })
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
  try {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    if (message.channel.id !== ALLOWED_CHANNEL_ID) {
      return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (command === "chances") {
      const embed = buildChancesEmbed(message);
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === "spin") {
      const unlimited = hasUnlimitedSpins(message.member);

      if (!unlimited) {
        const remaining = getRemainingCooldown(message.author.id);

        if (remaining > 0) {
          await message.reply({
            content: `⏳ You need to wait **${formatDuration(
              remaining
            )}** before spinning again.`
          });
          return;
        }

        cooldowns.set(
          message.author.id,
          Date.now() + COOLDOWN_MINUTES * 60 * 1000
        );
      }

      const reward = pickReward();
      const embed = buildSpinEmbed(message, reward);

      await message.reply({ embeds: [embed] });

      let dmStatus = "No DM sent";

      if (reward.win) {
        try {
          if (reward.name === "Coupon Code") {
            const couponCode = generateCouponCode(5);
            const couponEmbed = buildCouponDmEmbed(
              message.author,
              couponCode,
              reward
            );
            await message.author.send({ embeds: [couponEmbed] });
          } else {
            const rewardEmbed = buildRewardDmEmbed(message.author, reward);
            await message.author.send({ embeds: [rewardEmbed] });
          }

          dmStatus = "DM sent successfully";
        } catch (error) {
          dmStatus = "DM failed";
          console.error("DM send error:", error);
        }

        await sendLog(message, reward, dmStatus);
      }
    }
  } catch (error) {
    console.error("Message handler error:", error);

    try {
      await message.reply({
        content: "An error occurred while processing your command."
      });
    } catch {
    }
  }
});

client.login(TOKEN);
