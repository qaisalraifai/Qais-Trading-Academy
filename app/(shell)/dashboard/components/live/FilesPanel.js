"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { Paperclip, FileText, Download, Loader2 } from "lucide-react";

const BUCKET = "live-files";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export default function FilesPanel({ sessionId, files, canUpload, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${sessionId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const res = await fetch("/api/live/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, fileName: file.name, fileUrl: pub.publicUrl, sizeBytes: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data.file);
    } catch (e) {
      setError(e.message || "تعذّر رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {files.length === 0 && <p className="text-text-muted text-xs text-center mt-6">لا توجد ملفات مشتركة بعد</p>}
        {files.map((f) => (
          <a
            key={f.id}
            href={f.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-surface-2 border border-line rounded-lg px-2.5 py-2 hover:border-gold-300/50"
          >
            <FileText size={16} className="text-gold-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-primary truncate">{f.file_name}</p>
              <p className="text-[10px] text-text-muted">{formatSize(f.size_bytes)}</p>
            </div>
            <Download size={14} className="text-text-secondary shrink-0" />
          </a>
        ))}
      </div>

      {canUpload && (
        <div className="p-2.5 border-t border-line">
          {error && <p className="text-loss text-[11px] mb-1.5">{error}</p>}
          <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
          <button
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 bg-surface-2 border border-line rounded-lg py-2 text-sm text-text-primary hover:border-gold-300/50 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
            {uploading ? "جاري الرفع..." : "رفع ملف"}
          </button>
        </div>
      )}
    </div>
  );
}
