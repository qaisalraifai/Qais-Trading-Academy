import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

const MAX_DEPTH = 6; // حماية من payload ضخم بالغلط

/** يتأكد إنه candidateId هو نفسه userId أو أحد أحفاده بالشجرة (صعودًا من candidate لحد ما نلاقي userId أو نوصل للجذر) */
async function isSelfOrDescendant(supabaseAdmin, userId, candidateId) {
  if (userId === candidateId) return true;
  let current = candidateId;
  for (let i = 0; i < 30; i++) {
    const { data: node } = await supabaseAdmin.from("profiles").select("parent_id").eq("id", current).maybeSingle();
    if (!node || !node.parent_id) return false;
    if (node.parent_id === userId) return true;
    current = node.parent_id;
  }
  return false;
}

async function buildSubtree(supabaseAdmin, nodeId, depth) {
  const { data: node } = await supabaseAdmin
    .from("profiles")
    .select("id, username, leg, is_active_member, ranks:rank_id (name_ar)")
    .eq("id", nodeId)
    .maybeSingle();

  if (!node) return null;

  const base = {
    id: node.id,
    username: node.username,
    leg: node.leg,
    isActiveMember: node.is_active_member,
    rankName: node.ranks?.name_ar || null,
    left: null,
    right: null,
  };

  if (depth <= 0) return base;

  const { data: children } = await supabaseAdmin.from("profiles").select("id, leg").eq("parent_id", nodeId);
  const leftChild = (children || []).find((c) => c.leg === "left");
  const rightChild = (children || []).find((c) => c.leg === "right");

  if (leftChild) base.left = await buildSubtree(supabaseAdmin, leftChild.id, depth - 1);
  if (rightChild) base.right = await buildSubtree(supabaseAdmin, rightChild.id, depth - 1);

  return base;
}

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const rootId = searchParams.get("rootId") || user.id;
  const depth = Math.min(Number(searchParams.get("depth")) || 4, MAX_DEPTH);

  const { data: myProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = myProfile?.role === "admin";

  if (!isAdmin && rootId !== user.id) {
    const allowed = await isSelfOrDescendant(supabaseAdmin, user.id, rootId);
    if (!allowed) {
      return NextResponse.json({ error: "ما إلك صلاحية تشوفي هاد الجزء من الشجرة" }, { status: 403 });
    }
  }

  const tree = await buildSubtree(supabaseAdmin, rootId, depth);
  if (!tree) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });

  // معلومات الأب (لو موجود ومسموح الرجوع له) — يفيد لزر "رجوع للأعلى"
  const { data: rootNode } = await supabaseAdmin.from("profiles").select("parent_id, sponsor_id").eq("id", rootId).maybeSingle();
  let parentAllowed = null;
  if (rootNode?.parent_id) {
    if (isAdmin || (await isSelfOrDescendant(supabaseAdmin, user.id, rootNode.parent_id)) || rootNode.parent_id === user.id) {
      parentAllowed = rootNode.parent_id;
    }
  }

  return NextResponse.json({ tree, parentId: parentAllowed, depth });
}
