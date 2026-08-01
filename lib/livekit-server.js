// طبقة موحّدة للتعامل مع LiveKit Community Edition (مستضاف ذاتيًا) من السيرفر.
// كل شي هون بيعتمد على livekit-server-sdk وبيقرأ بيانات الاتصال من env vars:
//   LIVEKIT_URL           رابط WebSocket الداخلي (مثلاً ws://livekit:7880 أو https://live.domain.com)
//   LIVEKIT_API_KEY
//   LIVEKIT_API_SECRET
//   NEXT_PUBLIC_LIVEKIT_WS_URL   الرابط اللي المتصفح بيتصل فيه مباشرة (wss://live.domain.com)

import { AccessToken, RoomServiceClient, EgressClient, WebhookReceiver, TrackSource } from "livekit-server-sdk";

function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`متغير البيئة ${name} غير معرّف — راجعي إعداد LiveKit (LIVEKIT_SETUP.md)`);
  return v;
}

export function getLiveKitHost() {
  return env("LIVEKIT_URL");
}

export function getRoomServiceClient() {
  return new RoomServiceClient(getLiveKitHost(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
}

export function getEgressClient() {
  return new EgressClient(getLiveKitHost(), env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
}

export function getWebhookReceiver() {
  return new WebhookReceiver(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
}

// أدوار المشاركين داخل غرفة البث وصلاحيات كل دور
export const LIVE_ROLES = {
  host: "host", // المدرب/مدرب الدفعة — بيبدأ/ينهي البث، يسجّل، يتحكم بالكل
  moderator: "moderator", // مساعد رقّاه المدرب أثناء البث
  student: "student", // طالب مشاهد
};

export function permissionsForRole(role) {
  const base = {
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  };
  const allSources = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

  if (role === LIVE_ROLES.host) {
    return { ...base, canPublish: true, canPublishSources: allSources, roomAdmin: true, roomRecord: true };
  }
  if (role === LIVE_ROLES.moderator) {
    return { ...base, canPublish: true, canPublishSources: allSources, roomAdmin: false };
  }
  // الطالب فيه يفعّل كاميرا/مايك/مشاركة شاشة كمان (نمط اجتماع/صف تفاعلي)، بس بدون صلاحيات إدارية
  return { ...base, canPublish: true, canPublishSources: allSources };
}

/**
 * بينشئ Access Token لمستخدم عشان ينضم لغرفة بث معيّنة.
 * identity لازم يكون فريد وثابت (بنستخدم user.id من Supabase).
 */
export async function createLiveAccessToken({ identity, name, roomName, role, metadata }) {
  const at = new AccessToken(env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"), {
    identity,
    name,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    ttl: "6h",
  });
  at.addGrant({ room: roomName, ...permissionsForRole(role) });
  return at.toJwt();
}

export async function ensureRoomExists(roomName) {
  const svc = getRoomServiceClient();
  try {
    await svc.createRoom({
      name: roomName,
      emptyTimeout: 60 * 10, // تنحذف تلقائيًا لو ضلت فاضية 10 دقايق
      departureTimeout: 20,
      maxParticipants: 0, // بدون حد أقصى
    });
  } catch (e) {
    // إذا الغرفة موجودة أصلاً بيرجع خطأ، تجاهليه
  }
  return svc;
}
