require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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

const SELLAUTH_API_KEY = process.env.SELLAUTH_API_KEY || "";
const SELLAUTH_SHOP_ID = process.env.SELLAUTH_SHOP_ID || "";
const COUPON_DISCOUNT_PERCENT = Number(process.env.COUPON_DISCOUNT_PERCENT || 25);
const COUPON_MIN_ORDER_EUR = Number(process.env.COUPON_MIN_ORDER_EUR || 5);
const COUPON_EXPIRE_DAYS = Number(process.env.COUPON_EXPIRE_DAYS || 2);
const COUPON_MAX_USES = Number(process.env.COUPON_MAX_USES || 1);
const COUPON_MAX_USES_PER_CUSTOMER = Number(
  process.env.COUPON_MAX_USES_PER_CUSTOMER || 1
);

const REQUIRED_ROLE_ID = "1480671765889024111";
const COOLDOWN_WITH_ROLE_MINUTES = 120;
const COOLDOWN_WITHOUT_ROLE_MINUTES = 240;

const BANNER_URL =
  process.env.BANNER_URL ||
  "https://i.ibb.co/fd9yngNN/Gemini-Generated-Image-1.png";

const DM_SIDE_IMAGE_URL =
  process.env.DM_SIDE_IMAGE_URL ||
  "https://i.ibb.co/QFPFt4b6/Gemini-Generated-Image-removebg-preview-removebg-preview.png";

const UNLIMITED_SPINS_ROLE_ID = "1480671765909733472";
const ALLOWED_CHANNEL_ID = "1493149839805120602";
const BRAND_COLOR = 0x94eac3;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const cooldowns = new Map();

const rewards = [
  {
    name: "Nothing",
    emoji: "❌",
    chance: 70,
    rarity: "Common",
    color: BRAND_COLOR,
    win: false
  },
  {
    name: "Coupon Code",
    emoji: "🎟️",
    chance: 21,
    rarity: "Rare",
    color: BRAND_COLOR,
    win: true,
    couponDiscount: `${COUPON_DISCOUNT_PERCENT}%`,
    couponValidFor: `${COUPON_EXPIRE_DAYS} days`,
    couponMinimumOrder: `${COUPON_MIN_ORDER_EUR}€`
  },
  {
    name: "10 steams",
    emoji: "⭐",
    chance: 5,
    rarity: "Epic",
    color: BRAND_COLOR,
    win: true
  },
  {
    name: "5 Rockstars",
    emoji: "💎",
    chance: 3,
    rarity: "Diamond",
    color: BRAND_COLOR,
    win: true
  },
  {
    name: "Promo Code Gen",
    emoji: "🔥",
    chance: 1,
    rarity: "Legendary",
    color: BRAND_COLOR,
    win: true
  }
];

function hasRequiredRole(member) {
  return member?.roles?.cache?.has(REQUIRED_ROLE_ID);
}

function hasUnlimitedSpins(member) {
  return member?.roles?.cache?.has(UNLIMITED_SPINS_ROLE_ID);
}

function getCooldownMinutes(member) {
  return hasRequiredRole(member)
    ? COOLDOWN_WITH_ROLE_MINUTES
    : COOLDOWN_WITHOUT_ROLE_MINUTES;
}

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

function generateCouponCode(length = 6) {
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

function buildSpinPanelEmbed(user, member) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎡 Spin the Wheel 🎡")
    .setDescription("Press the button to spin the wheel")
    .addFields({
      name: "👤 Spin From",
      value: member?.displayName || user.username,
      inline: false
    })
    .setThumbnail(DM_SIDE_IMAGE_URL)
    .setFooter({ text: "Niro Market Spin System" })
    .setTimestamp();
}

function buildSpinButton(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`spin_${userId}`)
      .setEmoji("🎡")
      .setLabel("Spin")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildSpinResultEmbed(user, member, reward) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎰 Spin Result")
    .setDescription(`${reward.emoji} ${user} spun the wheel!`)
    .addFields(
      {
        name: "👤 Player",
        value: member?.displayName || user.username,
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
    .setThumbnail(user.displayAvatarURL({ extension: "png", size: 512 }))
    .setFooter({ text: "Niro Market Spin System" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

function buildChancesEmbed(user, member) {
  const lines = rewards.map(
    (reward) => `${reward.emoji} **${reward.name}** — ${reward.chance}%`
  );

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎰 Spin Chances")
    .setDescription(lines.join("\n"))
    .addFields({
      name: "👤 Player",
      value: member?.displayName || user.username,
      inline: false
    })
    .setThumbnail(user.displayAvatarURL({ extension: "png", size: 512 }))
    .setFooter({ text: "Niro Market Chances" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

function formatSellAuthDate(date) {
  return date.toISOString().slice(0, 10);
}

function getCouponExpirationDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + COUPON_EXPIRE_DAYS);
  return formatSellAuthDate(date);
}

async function createSellAuthCoupon() {
  if (!SELLAUTH_API_KEY || !SELLAUTH_SHOP_ID) {
    throw new Error("Missing SELLAUTH_API_KEY or SELLAUTH_SHOP_ID in .env");
  }

  const couponCode = generateCouponCode(6);
  const expirationDate = getCouponExpirationDate();

  const response = await fetch(
    `https://api.sellauth.com/v1/shops/${SELLAUTH_SHOP_ID}/coupons`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SELLAUTH_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: couponCode,
        global: true,
        discount: COUPON_DISCOUNT_PERCENT,
        type: "percentage",
        max_uses: COUPON_MAX_USES,
        max_uses_per_customer: COUPON_MAX_USES_PER_CUSTOMER,
        min_invoice_price: COUPON_MIN_ORDER_EUR,
        expiration_date: expirationDate,
        disable_if_volume_discount: false
      })
    }
  );

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }

  if (!response.ok) {
    throw new Error(
      `SellAuth API error ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return {
    couponCode,
    expirationDate,
    apiResponse: data
  };
}

function buildCouponDmEmbed(user, couponCode, reward, expirationDate) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: "Niro Market" })
    .setTitle("🎟️ Niro Market Discount Coupon")
    .setDescription(`🔴 Hello ${user}, here is your discount coupon!`)
    .addFields(
      {
        name: "📉 Discount",
        value: reward.couponDiscount || `${COUPON_DISCOUNT_PERCENT}%`,
        inline: true
      },
      {
        name: "🛒 Min Order",
        value: reward.couponMinimumOrder || `${COUPON_MIN_ORDER_EUR}€`,
        inline: true
      },
      {
        name: "📅 Expires",
        value: expirationDate || `${COUPON_EXPIRE_DAYS} days`,
        inline: true
      },
      {
        name: "📌 Coupon ID",
        value: `\`${couponCode}\``,
        inline: false
      }
    )
    .setThumbnail(DM_SIDE_IMAGE_URL)
    .setFooter({
      text: `Coupon is valid only for orders over ${COUPON_MIN_ORDER_EUR}€.`
    })
    .setTimestamp();
}

function buildRewardDmEmbed(user, reward) {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: "Niro Market" })
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

async function sendLog(user, member, reward, dmStatus, extraFields = []) {
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
          value: `${user.tag} (${user.id})`,
          inline: false
        },
        {
          name: "Display Name",
          value: member?.displayName || user.username,
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
        },
        ...extraFields
      )
      .setThumbnail(user.displayAvatarURL({ extension: "png", size: 512 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Log send error:", error);
  }
}

async function processSpin({ user, member, channel }) {
  const unlimited = hasUnlimitedSpins(member);

  if (!unlimited) {
    const remaining = getRemainingCooldown(user.id);

    if (remaining > 0) {
      await channel.send({
        content: `${user} ⏳ You need to wait **${formatDuration(
          remaining
        )}** before spinning again.`
      });
      return;
    }

    const cooldownMinutes = getCooldownMinutes(member);
    cooldowns.set(user.id, Date.now() + cooldownMinutes * 60 * 1000);
  }

  const reward = pickReward();
  const embed = buildSpinResultEmbed(user, member, reward);

  await channel.send({ embeds: [embed] });

  let dmStatus = "No DM sent";
  const extraLogFields = [];

  if (reward.win) {
    try {
      if (reward.name === "Coupon Code") {
        const { couponCode, expirationDate } = await createSellAuthCoupon();
        const couponEmbed = buildCouponDmEmbed(
          user,
          couponCode,
          reward,
          expirationDate
        );

        await user.send({ embeds: [couponEmbed] });

        extraLogFields.push(
          {
            name: "Coupon Code",
            value: `\`${couponCode}\``,
            inline: false
          },
          {
            name: "Minimum Order",
            value: `${COUPON_MIN_ORDER_EUR}€`,
            inline: true
          },
          {
            name: "Expires",
            value: expirationDate,
            inline: true
          }
        );
      } else {
        const rewardEmbed = buildRewardDmEmbed(user, reward);
        await user.send({ embeds: [rewardEmbed] });
      }

      dmStatus = "DM sent successfully";
    } catch (error) {
      dmStatus = "DM failed or coupon creation failed";
      console.error("Reward send error:", error);

      await channel.send({
        content:
          reward.name === "Coupon Code"
            ? `${user} ❌ The coupon could not be created in SellAuth. Check your API settings in .env.`
            : `${user} ❌ There was a problem sending your reward DM.`
      });
    }

    await sendLog(user, member, reward, dmStatus, extraLogFields);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (command === "chances") {
      const embed = buildChancesEmbed(message.author, message.member);
      await message.reply({ embeds: [embed] });
      return;
    }

    if (command === "spin") {
      const embed = buildSpinPanelEmbed(message.author, message.member);
      const row = buildSpinButton(message.author.id);

      await message.reply({
        embeds: [embed],
        components: [row]
      });
    }
  } catch (error) {
    console.error("Message handler error:", error);

    try {
      await message.reply({
        content: "An error occurred while processing your command."
      });
    } catch {}
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("spin_")) return;

    const ownerId = interaction.customId.split("_")[1];

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This spin button is not for you.",
        ephemeral: true
      });
      return;
    }

    if (!interaction.guild || interaction.channel.id !== ALLOWED_CHANNEL_ID) {
      await interaction.reply({
        content: "❌ You cannot use this button here.",
        ephemeral: true
      });
      return;
    }

    const member = interaction.member;

    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});

    await processSpin({
      user: interaction.user,
      member,
      channel: interaction.channel
    });
  } catch (error) {
    console.error("Interaction handler error:", error);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing the spin.",
          ephemeral: true
        });
      } else {
        await interaction.channel.send({
          content: `${interaction.user} ❌ An error occurred while processing the spin.`
        });
      }
    } catch {}
  }
});

client.login(TOKEN);
