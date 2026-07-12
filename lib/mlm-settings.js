// قراءة إعدادات الخطة القابلة للتعديل من جدول mlm_settings (بدل hardcoded)

const DEFAULTS = {
  direct_bonus_amount: 20,
  renewal_bonus_amount: 8,
  fast_start_bonus_amount: 10,
  binary_bonus_percent: 10,
  leadership_pool_percent: 12,
  infinity_bonus_percent: 3,
};

/** يجيب قيمة إعداد واحد. لو الجدول أو الصف مش موجود (قبل تشغيل الـ migration) بيرجع القيمة الافتراضية بالكود. */
export async function getSetting(supabaseAdmin, key) {
  const { data, error } = await supabaseAdmin
    .from("mlm_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return DEFAULTS[key] ?? 0;
  return Number(data.value);
}

/** يجيب كل الإعدادات دفعة وحدة — أسرع من نداءات متكررة (تُستخدم بلوحة الأدمن) */
export async function getAllSettings(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("mlm_settings")
    .select("key, value, label_ar, updated_at")
    .order("key", { ascending: true });

  if (error || !data || data.length === 0) {
    return Object.entries(DEFAULTS).map(([key, value]) => ({ key, value, label_ar: key, updated_at: null }));
  }
  return data;
}

export async function updateSetting(supabaseAdmin, key, value) {
  const { error } = await supabaseAdmin
    .from("mlm_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new Error(`updateSetting: ${error.message}`);
}
