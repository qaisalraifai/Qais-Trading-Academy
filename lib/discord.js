const DISCORD_API = "https://discord.com/api/v10";

async function discordApiFetch(path, options = {}) {
  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

/**
 * يطرد عضو من سيرفر Discord حسب الـ discord_id تبعه.
 * ما بينفجر لو العضو أصلاً مش موجود بالسيرفر (404) — هاد طبيعي ومقبول.
 */
export async function kickMemberFromGuild(discordUserId) {
  if (!discordUserId) return { skipped: true };

  const guildId = process.env.DISCORD_GUILD_ID;
  const res = await discordApiFetch(`/guilds/${guildId}/members/${discordUserId}`, {
    method: "DELETE",
  });

  if (res.status !== 204 && res.status !== 404) {
    const body = await res.text().catch(() => "");
    console.error("Discord kick failed:", res.status, body);
    return { success: false, status: res.status };
  }

  return { success: true };
}

/**
 * يولّد رابط دعوة صالح لمرة وحدة بس، وينتهي خلال 24 ساعة لو ما استخدم.
 * بياخد أول قناة نصية عادية بالسيرفر وينشئ الدعوة عليها.
 */
export async function createSingleUseInvite() {
  const guildId = process.env.DISCORD_GUILD_ID;

  const channelsRes = await discordApiFetch(`/guilds/${guildId}/channels`);
  if (!channelsRes.ok) {
    throw new Error("تعذر جلب قنوات سيرفر Discord");
  }
  const channels = await channelsRes.json();
  const textChannel = channels.find((c) => c.type === 0); // 0 = GUILD_TEXT

  if (!textChannel) {
    throw new Error("ما في قناة نصية بالسيرفر لإنشاء دعوة عليها");
  }

  const inviteRes = await discordApiFetch(`/channels/${textChannel.id}/invites`, {
    method: "POST",
    body: JSON.stringify({
      max_uses: 1,
      max_age: 86400, // 24 ساعة
      unique: true,
    }),
  });

  if (!inviteRes.ok) {
    const body = await inviteRes.text().catch(() => "");
    throw new Error("تعذر إنشاء دعوة Discord: " + body);
  }

  const invite = await inviteRes.json();
  return `https://discord.gg/${invite.code}`;
}
