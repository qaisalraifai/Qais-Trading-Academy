"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, ConnectionState } from "livekit-client";

const CHAT_TOPIC = "chat";
const REACTION_TOPIC = "reaction";
const ANNOUNCEMENT_TOPIC = "announcement";

function participantSnapshot(p) {
  let meta = {};
  try {
    meta = p.metadata ? JSON.parse(p.metadata) : {};
  } catch (_) {}
  return {
    identity: p.identity,
    name: p.name || meta.username || p.identity,
    role: meta.role || "student",
    isLocal: p.isLocal,
    isSpeaking: p.isSpeaking,
    isCameraEnabled: p.isCameraEnabled,
    isMicrophoneEnabled: p.isMicrophoneEnabled,
    isScreenShareEnabled: p.isScreenShareEnabled,
    connectionQuality: p.connectionQuality,
    handRaised: p.attributes?.handRaised === "true",
    sid: p.sid,
  };
}

/**
 * Hook مركزي يغلّف livekit-client كامل: الاتصال، الأجهزة، مشاركة الشاشة،
 * الدردشة/الردود عبر Data Channels، رفع اليد عبر Participant Attributes،
 * وحالة الشبكة/إعادة الاتصال. لا يستخدم أي واجهة جاهزة من LiveKit.
 */
export function useLiveKitRoom({ wsUrl, token, onChatMessage, onAnnouncement }) {
  const roomRef = useRef(null);
  const [connState, setConnState] = useState("idle"); // idle | connecting | connected | reconnecting | disconnected | failed
  const [participants, setParticipants] = useState([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const all = [participantSnapshot(room.localParticipant), ...Array.from(room.remoteParticipants.values()).map(participantSnapshot)];
    setParticipants(all);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: list.filter((d) => d.kind === "videoinput"),
        microphones: list.filter((d) => d.kind === "audioinput"),
        speakers: list.filter((d) => d.kind === "audiooutput"),
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!wsUrl || !token) return;
    let disposed = false;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { simulcast: true, videoCodec: "vp9" },
      videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
      reconnectPolicy: { nextRetryDelayInMs: (ctx) => Math.min(1000 * 2 ** ctx.retryCount, 10000) },
    });
    roomRef.current = room;

    room
      .on(RoomEvent.ParticipantConnected, refreshParticipants)
      .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
      .on(RoomEvent.TrackSubscribed, refreshParticipants)
      .on(RoomEvent.TrackUnsubscribed, refreshParticipants)
      .on(RoomEvent.TrackMuted, refreshParticipants)
      .on(RoomEvent.TrackUnmuted, refreshParticipants)
      .on(RoomEvent.LocalTrackPublished, refreshParticipants)
      .on(RoomEvent.LocalTrackUnpublished, refreshParticipants)
      .on(RoomEvent.ParticipantMetadataChanged, refreshParticipants)
      .on(RoomEvent.ParticipantAttributesChanged, refreshParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakerIds(speakers.map((s) => s.identity));
        refreshParticipants();
      })
      .on(RoomEvent.ConnectionQualityChanged, refreshParticipants)
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (disposed) return;
        if (state === ConnectionState.Connected) setConnState("connected");
        else if (state === ConnectionState.Reconnecting) setConnState("reconnecting");
        else if (state === ConnectionState.Disconnected) setConnState("disconnected");
        else if (state === ConnectionState.Connecting) setConnState("connecting");
      })
      .on(RoomEvent.Reconnecting, () => setConnState("reconnecting"))
      .on(RoomEvent.Reconnected, () => setConnState("connected"))
      .on(RoomEvent.Disconnected, () => setConnState("disconnected"))
      .on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          if (topic === CHAT_TOPIC) onChatMessage?.(data);
          else if (topic === ANNOUNCEMENT_TOPIC) onAnnouncement?.(data);
        } catch (_) {}
      });

    (async () => {
      try {
        setConnState("connecting");
        await room.connect(wsUrl, token, { autoSubscribe: true });
        if (disposed) return;
        refreshParticipants();
        refreshDevices();
      } catch (e) {
        if (!disposed) {
          setError(e.message || "تعذّر الاتصال بالبث");
          setConnState("failed");
        }
      }
    })();

    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);

    return () => {
      disposed = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
      room.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, token]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
  }, [camEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (screenEnabled) {
      await room.localParticipant.setScreenShareEnabled(false);
      setScreenEnabled(false);
      return;
    }
    try {
      await room.localParticipant.setScreenShareEnabled(true, { audio: true, resolution: { width: 1920, height: 1080 } });
      setScreenEnabled(true);
      // بمتصفح Chrome بتصير مشاركة الشاشة توقف تلقائيًا لو المستخدم دوس "Stop sharing" من شريط المتصفح
      room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack?.addEventListener("ended", () => {
        setScreenEnabled(false);
      });
    } catch (e) {
      // المستخدم لغى نافذة اختيار الشاشة/التبويب/النافذة
    }
  }, [screenEnabled]);

  const setCameraDevice = useCallback(async (deviceId) => {
    await roomRef.current?.switchActiveDevice("videoinput", deviceId);
  }, []);
  const setMicrophoneDevice = useCallback(async (deviceId) => {
    await roomRef.current?.switchActiveDevice("audioinput", deviceId);
  }, []);
  const setSpeakerDevice = useCallback(async (deviceId) => {
    await roomRef.current?.switchActiveDevice("audiooutput", deviceId);
  }, []);

  const sendChat = useCallback((data) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify(data));
    room.localParticipant.publishData(payload, { reliable: true, topic: CHAT_TOPIC });
  }, []);

  const sendReaction = useCallback((emoji) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ emoji, from: room.localParticipant.identity }));
    room.localParticipant.publishData(payload, { reliable: false, topic: REACTION_TOPIC });
  }, []);

  const sendAnnouncement = useCallback((data) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify(data));
    room.localParticipant.publishData(payload, { reliable: true, topic: ANNOUNCEMENT_TOPIC });
  }, []);

  const onReaction = useCallback((cb) => {
    const room = roomRef.current;
    if (!room) return () => {};
    const handler = (payload, participant, kind, topic) => {
      if (topic !== REACTION_TOPIC) return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        cb(data);
      } catch (_) {}
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => room.off(RoomEvent.DataReceived, handler);
  }, []);

  const toggleHandRaise = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !handRaised;
    await room.localParticipant.setAttributes({ handRaised: next ? "true" : "false" });
    setHandRaised(next);
  }, [handRaised]);

  return {
    room: roomRef,
    connState,
    participants,
    micEnabled,
    camEnabled,
    screenEnabled,
    activeSpeakerIds,
    handRaised,
    error,
    devices,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    setCameraDevice,
    setMicrophoneDevice,
    setSpeakerDevice,
    sendChat,
    sendReaction,
    sendAnnouncement,
    onReaction,
    toggleHandRaise,
    refreshParticipants,
  };
}
