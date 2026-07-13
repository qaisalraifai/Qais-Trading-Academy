"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

const GOLD = "#C9A24B";
const BG = "#050505";
const BORDER = "#1a1a1a";

function Node({ node, onFocus }) {
  if (!node) {
    return (
      <div style={{ padding: "0.6rem 0.9rem", borderRadius: 10, border: "1px dashed #2a2a2a", color: "#444", fontSize: "0.75rem", textAlign: "center", minWidth: 100 }}>
        فاضي
      </div>
    );
  }
  return (
    <button
      onClick={() => onFocus(node.id)}
      style={{
        padding: "0.6rem 0.9rem",
        borderRadius: 10,
        border: `1px solid ${node.isActiveMember ? GOLD + "77" : "#2a2a2a"}`,
        background: "#0d0d0d",
        color: "#E8E0D0",
        cursor: "pointer",
        textAlign: "center",
        minWidth: 100,
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{node.username}</div>
      <div style={{ fontSize: "0.65rem", color: node.isActiveMember ? "#4CAF50" : "#888", marginTop: 2 }}>
        {node.rankName || "—"}
      </div>
    </button>
  );
}

function TreeLevel({ node, onFocus, maxDepth, depth = 0 }) {
  if (depth >= maxDepth || !node) return null;
  const hasChildren = node.left || node.right;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Node node={node} onFocus={onFocus} />
      {hasChildren && depth < maxDepth - 1 && (
        <>
          <div style={{ width: 1, height: 20, background: "#2a2a2a" }} />
          <div style={{ display: "flex", gap: "2.5rem", position: "relative" }}>
            <div style={{ position: "absolute", top: -20, left: "25%", right: "25%", height: 1, background: "#2a2a2a" }} />
            <TreeLevel node={node.left} onFocus={onFocus} maxDepth={maxDepth} depth={depth + 1} />
            <TreeLevel node={node.right} onFocus={onFocus} maxDepth={maxDepth} depth={depth + 1} />
          </div>
        </>
      )}
    </div>
  );
}

function MlmTreeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [tree, setTree] = useState(null);
  const [parentId, setParentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rootId = searchParams.get("rootId");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    setLoading(true);
    setError("");
    try {
      const qs = rootId ? `?rootId=${rootId}&depth=4` : "?depth=4";
      const res = await fetch(`/api/mlm/tree${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTree(json.tree);
      setParentId(json.parentId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId]);

  useEffect(() => { load(); }, [load]);

  function focusNode(id) {
    router.push(`/mlm/tree?rootId=${id}`);
  }

  return (
    <div style={{ background: BG, color: "#E8E0D0", minHeight: "100vh", padding: "2.5rem 3rem", direction: "rtl", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ color: GOLD, fontSize: "0.75rem", letterSpacing: 2, marginBottom: 4 }}>QAIS TRADING ACADEMY</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>الشجرة الثنائية — استكشاف</h1>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {parentId && (
            <button onClick={() => focusNode(parentId)} style={{ background: "transparent", border: `1px solid ${BORDER}`, color: "#aaa", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer" }}>
              ↑ رجوع للأعلى
            </button>
          )}
          <a href="/mlm" style={{ color: GOLD, textDecoration: "none", fontSize: "0.85rem", alignSelf: "center" }}>← ملخصي</a>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#888" }}>جاري التحميل...</div>
      ) : error ? (
        <div style={{ color: "#ef4444" }}>{error}</div>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", minWidth: 600 }}>
            <TreeLevel node={tree} onFocus={focusNode} maxDepth={4} />
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#666", textAlign: "center" }}>
        اضغطي على أي عضو حتى تشوفي شجرته الفرعية (4 مستويات بكل مرة)
      </div>
    </div>
  );
}

export default function MlmTreePage() {
  return (
    <Suspense fallback={<div style={{ background: BG, color: "#888", minHeight: "100vh", padding: "3rem", direction: "rtl" }}>جاري التحميل...</div>}>
      <MlmTreeInner />
    </Suspense>
  );
}
