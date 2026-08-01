"use client";

import { useMemo, useState } from "react";
import { Track } from "livekit-client";
import ParticipantTile from "./ParticipantTile";

export default function VideoStage({ room, participants }) {
  const [pinnedIdentity, setPinnedIdentity] = useState(null);

  const screenSharer = useMemo(() => participants.find((p) => p.isScreenShareEnabled), [participants]);
  const host = useMemo(() => participants.find((p) => p.role === "host"), [participants]);

  const main = useMemo(() => {
    if (screenSharer) return { participant: screenSharer, source: Track.Source.ScreenShare };
    const pinned = pinnedIdentity && participants.find((p) => p.identity === pinnedIdentity);
    if (pinned) return { participant: pinned, source: Track.Source.Camera };
    if (host) return { participant: host, source: Track.Source.Camera };
    return participants[0] ? { participant: participants[0], source: Track.Source.Camera } : null;
  }, [screenSharer, pinnedIdentity, host, participants]);

  const thumbnails = participants.filter((p) => p.identity !== main?.participant?.identity);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="relative flex-1 min-h-0">
        {main ? (
          <ParticipantTile room={room} participant={main.participant} source={main.source} big />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-sm bg-surface-1 rounded-xl border border-line">
            بانتظار انضمام المدرب...
          </div>
        )}
      </div>

      {thumbnails.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0" style={{ height: thumbnails.length ? 96 : 0 }}>
          {thumbnails.map((p) => (
            <button
              key={p.identity}
              onClick={() => setPinnedIdentity(p.identity === pinnedIdentity ? null : p.identity)}
              className="shrink-0 w-32 h-full rounded-xl overflow-hidden focus:outline-none"
              title="تثبيت هالمشارك بالمنتصف"
            >
              <ParticipantTile room={room} participant={p} source={Track.Source.Camera} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
