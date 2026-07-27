--- /home/claude/orig/Qais-Trading-Academy-main/app/replay/ReplayClient.jsx	2026-07-26 23:43:00.000000000 +0000
+++ /home/claude/project/Qais-Trading-Academy-main/app/replay/ReplayClient.jsx	2026-07-27 00:20:11.553092262 +0000
@@ -1326,6 +1326,11 @@
      (زي تريدنغ فيو: لون/سماكة/قفل/نسخ/حذف بدون ما تفتحي اللوحة الكاملة) ===== */
   const [selectedDrawingId, setSelectedDrawingId] = useState(null);
   const selectedIdRef = useRef(null);
+  /* ===== تحويم الفأرة فوق رسمة (بدون تحديد): بيطلع مقابضها مؤقتاً بالضبط
+     متل تريدنغ فيو - قريبي الفأرة من أي خط/شكل بتبين نقاط تحكمه، بعّديها
+     بتختفي. هاد منفصل تماماً عن selectedIdRef (يلي بيضل ظاهر حتى لو بعّدتي
+     الفأرة، لحد ما تنكبسي بمكان فاضي) ===== */
+  const hoveredIdRef = useRef(null);
   const [selectionRenderTick, setSelectionRenderTick] = useState(0);
   const selectionToolbarRef = useRef(null);
   /* موضع الشريط العائم (مركز أفقي X، حافة علوية Y) - مستقل تماماً عن الرسمة
@@ -2507,14 +2512,68 @@
       }
     }
 
+    /* ===== نص/كابشن اختياري على أي أداة تانية غير المستطيل (يلي عندها منطقها
+       الخاص فوق جوا حلقة الرسم الرئيسية) - خط واحد فوق منتصف الأدوات الخطية
+       (خط اتجاه/شعاع/خط ممتد/سهم/خط أفقي.../عمودي/متقاطع)، أو نص متعدد الأسطر
+       جوا صندوق محيط للأشكال يلي إلها مساحة (دائرة/مثلث/مسار/قناة متوازية) -
+       بالظبط متل "Add text" بتريدنغ فيو على أي أداة رسم تقريباً ===== */
+    const LINE_TEXT_TYPES = new Set(["trendline", "ray", "extendedline", "arrow", "hline", "hray", "vline", "crossline"]);
+    const AREA_TEXT_TYPES = new Set(["circle", "triangle", "path", "parallelchannel"]);
+    for (const d of drawingsRef.current) {
+      if (!d.text || d.hidden) continue;
+      const style = d.style || defaultStyleFor(d.type);
+      if (LINE_TEXT_TYPES.has(d.type)) {
+        let anchor = null, align = "center";
+        if (d.type === "hline") {
+          const y = series.priceToCoordinate(d.p1.price);
+          if (y != null) { anchor = { x: 10, y: y - 8 }; align = "left"; }
+        } else if (d.type === "vline") {
+          const x = ts.logicalToCoordinate(ptToLogical(d.p1));
+          if (x != null) anchor = { x: x + 8, y: 16 };
+        } else if (d.type === "hray") {
+          const y = series.priceToCoordinate(d.p1.price);
+          const x = ts.logicalToCoordinate(ptToLogical(d.p1));
+          if (x != null && y != null) anchor = { x: x + 8, y: y + 16 };
+        } else if (d.type === "crossline") {
+          const y = series.priceToCoordinate(d.p1.price);
+          const x = ts.logicalToCoordinate(ptToLogical(d.p1));
+          if (x != null && y != null) anchor = { x: x + 8, y: y + 16 };
+        } else if (d.p1 && d.p2) {
+          const a = toXY(d.p1), b = toXY(d.p2);
+          if (a.x != null && b.x != null) anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 };
+        }
+        if (!anchor || anchor.x == null || anchor.y == null) continue;
+        ctx.save();
+        ctx.font = `${style.textItalic ? "italic " : ""}${style.textBold ? "bold " : ""}${style.textSize || 12}px sans-serif`;
+        ctx.fillStyle = style.textColor || style.color || GOLD_LIGHT;
+        ctx.textAlign = align;
+        ctx.fillText(d.text, anchor.x, anchor.y);
+        ctx.restore();
+      } else if (AREA_TEXT_TYPES.has(d.type)) {
+        let pts = [];
+        if (d.points) pts = d.points.map((p) => toXY(p));
+        else if (d.p1 && d.p2) pts = [toXY(d.p1), toXY(d.p2)];
+        pts = pts.filter((p) => p.x != null && p.y != null);
+        if (!pts.length) continue;
+        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
+        const bx = Math.min(...xs), by = Math.min(...ys);
+        const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
+        drawShapeText(ctx, d.text, bx, by, bw, bh, style);
+      }
+    }
+
     /* ===== مقابض تحديد مرئية (Handles) على الرسمة المحددة، بستايل تريدنغ فيو:
        دوائر زرقاء صغيرة عالنقاط/الزوايا، ومربعات صغيرة بمنتصف أضلاع المستطيل،
        عشان يبين وضوح إنه في إمكانية سحب/تمديد كل نقطة لحالها ===== */
     const selectedForHandles = selectedIdRef.current != null
       ? drawingsRef.current.find((d) => d.id === selectedIdRef.current)
       : null;
-    if (selectedForHandles && !selectedForHandles.locked) {
-      const handles = getHandlePoints(selectedForHandles);
+    const hoveredForHandles = hoveredIdRef.current != null && hoveredIdRef.current !== selectedIdRef.current
+      ? drawingsRef.current.find((d) => d.id === hoveredIdRef.current)
+      : null;
+    for (const drawingForHandles of [selectedForHandles, hoveredForHandles]) {
+      if (!drawingForHandles || drawingForHandles.locked) continue;
+      const handles = getHandlePoints(drawingForHandles);
       for (const h of handles) {
         const xy = toXY(h.p);
         if (xy.x == null || xy.y == null) continue;
@@ -2989,25 +3048,25 @@
     }
     setTextPopoverOpen(false);
   }
-  /* تثبيت محرر النص المضمّن: نص فاضي (بعد trim) بيلغي العملية بالكامل (رسمة
-     جديدة ما بتنخزّن أصلاً، ورسمة موجودة عم نعدّلها بتنحذف - بالظبط زي
-     تريدنغ فيو: مسح كل النص من رسمة نص = حذفها). غير هيك، منحفظ التعديل
-     كخطوة تراجع/إعادة وحدة سواء كانت رسمة جديدة أو تعديل قائمة. */
+  /* تثبيت محرر النص المضمّن: نص فاضي (بعد trim) عالرسمة النصية القائمة بحالها
+     (type: "text") بيلغي العملية بالكامل وبيحذفها - بالظبط زي تريدنغ فيو: مسح
+     كل النص من رسمة نص = حذفها. أما لما يكون النص مضمّن جوا شكل (مستطيل...)
+     فالرسمة نفسها بتضل موجودة حتى لو انمسح نصها بالكامل - النص هون مجرد
+     "كابشن" اختياري فوق شكل قائم، مش الرسمة نفسها. */
   function commitTextEditor() {
     const ed = textEditorRef.current;
     if (!ed) return;
     const value = (ed.value || "").trim();
     if (ed.editingId != null) {
-      if (!value) {
+      const idx = drawingsRef.current.findIndex((d) => d.id === ed.editingId);
+      const targetDrawing = idx !== -1 ? drawingsRef.current[idx] : null;
+      if (!value && targetDrawing?.type === "text") {
         pushHistory();
         drawingsRef.current = drawingsRef.current.filter((d) => d.id !== ed.editingId);
         clearSelection();
-      } else {
-        const idx = drawingsRef.current.findIndex((d) => d.id === ed.editingId);
-        if (idx !== -1 && drawingsRef.current[idx].text !== value) {
-          pushHistory();
-          drawingsRef.current[idx] = { ...drawingsRef.current[idx], text: value };
-        }
+      } else if (idx !== -1 && targetDrawing.text !== value) {
+        pushHistory();
+        drawingsRef.current[idx] = { ...targetDrawing, text: value };
       }
     } else if (value) {
       pushHistory();
@@ -3106,6 +3165,14 @@
       const storedPts = pts.map((p) => ptFromLogical(p.logical, p.price));
       drawingsRef.current.push({ id: newId, type: tool, points: storedPts, style: styleForNewDrawing(tool) });
       selectDrawing(newId); // نقاط التحكم تظهر تلقائياً فوراً بعد إنشاء الأداة متعددة النقاط
+      if (tool === "triangle" || tool === "path" || tool === "parallelchannel") {
+        const avgLogical = storedPts.reduce((s, p) => s + ptToLogical(p), 0) / storedPts.length;
+        const avgPrice = storedPts.reduce((s, p) => s + p.price, 0) / storedPts.length;
+        const centerXY = logicalPriceToXY({ logical: avgLogical, price: avgPrice });
+        if (centerXY.x != null && centerXY.y != null) {
+          setTextEditor({ x: centerXY.x, y: centerXY.y, editingId: newId, value: "", centered: true });
+        }
+      }
     }
     pathPointsRef.current = [];
     liveCursorRef.current = null;
@@ -3807,6 +3874,7 @@
           drawingsRef.current.push({ id: newId, type: tool, p1: ptFromLogical(logical, snapped), style: styleForNewDrawing(tool) });
           setActiveTool("cursor");
           selectDrawing(newId); // نقاط التحكم تظهر تلقائياً فوراً بعد إنشاء الأداة
+          setTextEditor({ x, y, editingId: newId, value: "", centered: true });
           scheduleDraw();
           return;
         }
@@ -3842,6 +3910,18 @@
             });
             setActiveTool("cursor");
             selectDrawing(newId); // نقاط التحكم (Anchors) تظهر تلقائياً فوراً بعد إنشاء الرسمة
+            // رسمة جديدة بنقطتين (مستطيل/دائرة/خط اتجاه/شعاع/خط ممتد/سهم): منفتح
+            // محرر النص المضمّن فوراً بمنتصفها (بدون فتح لوحة الإعدادات) - بالظبط
+            // متل تريدنغ فيو: "إضافة نص" جاهزة للكتابة على طول، وإذا ما كتبتي إشي
+            // وطلعتي منها بتضل الرسمة موجودة بلا نص.
+            if (["rectangle", "circle", "trendline", "ray", "extendedline", "arrow"].includes(d.type)) {
+              const midLogical = (d.p1.logical + d.p2.logical) / 2;
+              const midPrice = (d.p1.price + d.p2.price) / 2;
+              const centerXY = logicalPriceToXY({ logical: midLogical, price: midPrice });
+              if (centerXY.x != null && centerXY.y != null) {
+                setTextEditor({ x: centerXY.x, y: centerXY.y, editingId: newId, value: "", centered: true });
+              }
+            }
           } else {
             setActiveTool("cursor");
           }
@@ -3855,6 +3935,10 @@
       function onMouseMove(e) {
         // وضع المؤشر: تلوين مؤشر الفأرة لما يكون فوق رسمة (يد) عشان يبين إنها قابلة للسحب،
         // وتحديث موقع الرسمة إذا كان في سحب جاري حالياً
+        if (activeToolRef.current !== "cursor" && hoveredIdRef.current != null) {
+          hoveredIdRef.current = null;
+          scheduleDraw();
+        }
         if (activeToolRef.current === "cursor") {
           if (cutMode) return; // أداة القص عم تتحكم بمؤشر الفأرة والتفاعل بنفسها (شوفي useEffect الخاص فيها تحت)
           if (dragStateRef.current) {
@@ -3879,8 +3963,11 @@
           }
           const { x, y } = getLogicalPrice(e.clientX, e.clientY);
           if (x != null && y != null && chartContainerRef.current) {
-            const hit = findHandleAt(x, y) || (findDrawingAt(x, y) ? { key: "body" } : null);
-            chartContainerRef.current.style.cursor = hit ? "move" : "default";
+            const handleHitHover = findHandleAt(x, y);
+            const bodyHitHover = handleHitHover ? null : findDrawingAt(x, y);
+            const hoverDrawing = handleHitHover ? handleHitHover.drawing : bodyHitHover;
+            hoveredIdRef.current = hoverDrawing ? hoverDrawing.id : null;
+            chartContainerRef.current.style.cursor = hoverDrawing ? "move" : "default";
           }
           // منجدول رسمة overlay كمان مع أي حركة فأرة عادية (مش بس مع حدث تغيير
           // المدى المرئي تبع المكتبة) - أثناء سحب/بان الشارت الأصلي بالماوس
@@ -4097,8 +4184,15 @@
       }
       function onWindowMouseUpForPan() { panDrag = null; }
 
+      function onContainerMouseLeaveClearHover() {
+        if (hoveredIdRef.current != null) {
+          hoveredIdRef.current = null;
+          scheduleDraw();
+        }
+      }
       const overlayEl = overlayCanvasRef.current;
       const containerEl = chartContainerRef.current;
+      containerEl?.addEventListener("mouseleave", onContainerMouseLeaveClearHover);
       overlayEl?.addEventListener("wheel", onOverlayWheel, { passive: false });
       overlayEl?.addEventListener("mousedown", onOverlayAuxDown);
       window.addEventListener("mousemove", onWindowMouseMoveForPan);
@@ -4277,6 +4371,7 @@
       chart.__cleanup = () => {
         window.removeEventListener("resize", handleResize);
         document.removeEventListener("fullscreenchange", handleFsChange);
+        containerEl?.removeEventListener("mouseleave", onContainerMouseLeaveClearHover);
         overlayEl?.removeEventListener("wheel", onOverlayWheel);
         overlayEl?.removeEventListener("mousedown", onOverlayAuxDown);
         window.removeEventListener("mousemove", onWindowMouseMoveForPan);
@@ -6194,12 +6289,61 @@
               {row("النمط", dashSelect(style.dash, (v) => updateStyle({ dash: v })))}
             </>
           )}
+          {type === "arrow" && (
+            <>
+              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
+              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
+            </>
+          )}
+          {(type === "trendline" || type === "ray" || type === "extendedline" || type === "arrow"
+            || type === "hline" || type === "hray" || type === "vline" || type === "crossline") && (
+            <>
+              <div style={{ fontSize: 12, color: "#999", padding: "10px 0 4px" }}>نص (كابشن) على الأداة</div>
+              <textarea
+                value={editDraft.text || ""}
+                onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
+                placeholder="إضافة نص..."
+                rows={2}
+                style={{
+                  width: "100%", background: "#1c1f27", border: "1px solid #333", borderRadius: 8,
+                  color: "#eee", padding: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box",
+                }}
+              />
+              {row("حجم الخط", (
+                <select value={style.textSize || 12} onChange={(e) => updateStyle({ textSize: Number(e.target.value) })} style={selectStyle}>
+                  {[10, 12, 13, 15, 18, 22].map((s) => (<option key={s} value={s}>{s}</option>))}
+                </select>
+              ))}
+              {row("لون النص", colorInput(style.textColor, (v) => updateStyle({ textColor: v })))}
+              {row("عريض", checkbox(style.textBold, (v) => updateStyle({ textBold: v })))}
+              {row("مائل", checkbox(style.textItalic, (v) => updateStyle({ textItalic: v })))}
+            </>
+          )}
           {type === "parallelchannel" && (
             <>
               {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
               {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
               {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
               {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
+              <div style={{ fontSize: 12, color: "#999", padding: "10px 0 4px" }}>النص داخل القناة</div>
+              <textarea
+                value={editDraft.text || ""}
+                onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
+                placeholder="إضافة نص..."
+                rows={2}
+                style={{
+                  width: "100%", background: "#1c1f27", border: "1px solid #333", borderRadius: 8,
+                  color: "#eee", padding: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box",
+                }}
+              />
+              {row("حجم الخط", (
+                <select value={style.textSize || 13} onChange={(e) => updateStyle({ textSize: Number(e.target.value) })} style={selectStyle}>
+                  {[10, 12, 13, 15, 18, 22].map((s) => (<option key={s} value={s}>{s}</option>))}
+                </select>
+              ))}
+              {row("لون النص", colorInput(style.textColor, (v) => updateStyle({ textColor: v })))}
+              {row("عريض", checkbox(style.textBold, (v) => updateStyle({ textBold: v })))}
+              {row("مائل", checkbox(style.textItalic, (v) => updateStyle({ textItalic: v })))}
             </>
           )}
           {(type === "fibtimezone" || type === "gannfan" || type === "pitchfork") && (
@@ -6219,9 +6363,9 @@
               {type === "rectangle" && row("خط المنتصف (50%)", checkbox(style.midline, (v) => updateStyle({ midline: v })))}
               {type === "rectangle" && style.midline && row("لون خط 50%", colorInput(style.midlineColor, (v) => updateStyle({ midlineColor: v })))}
               {type === "rectangle" && style.midline && row("خط متقطع", checkbox(style.midlineDash !== false, (v) => updateStyle({ midlineDash: v })))}
-              {type === "rectangle" && (
+              {(
                 <>
-                  <div style={{ fontSize: 12, color: "#999", padding: "10px 0 4px" }}>النص داخل المستطيل</div>
+                  <div style={{ fontSize: 12, color: "#999", padding: "10px 0 4px" }}>النص داخل الشكل</div>
                   <textarea
                     value={editDraft.text || ""}
                     onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
@@ -6782,7 +6926,11 @@
      منه (blur) بيثبّت النص، Escape بيلغي العملية بالكامل. */
   function renderInlineTextEditor() {
     if (!textEditor) return null;
-    const size = 13;
+    const targetDrawing = textEditor.editingId != null
+      ? drawingsRef.current.find((d) => d.id === textEditor.editingId)
+      : null;
+    const centered = !!textEditor.centered;
+    const size = centered ? (targetDrawing?.style?.textSize || 13) : 13;
     return (
       <input
         key={textEditor.editingId || "new"}
@@ -6802,8 +6950,28 @@
         }}
         onMouseDown={(e) => e.stopPropagation()}
         onClick={(e) => e.stopPropagation()}
-        placeholder="اكتبي هون..."
-        style={{
+        placeholder={centered ? "إضافة نص" : "اكتبي هون..."}
+        style={centered ? {
+          // مضمّن جوا شكل (مستطيل...): متمركز تماماً حوالين نقطة المنتصف،
+          // بخلفية شبه شفافة بتنسجم فوق تعبئة الشكل - بالظبط متل تريدنغ فيو
+          position: "absolute",
+          left: textEditor.x,
+          top: textEditor.y,
+          transform: "translate(-50%, -50%)",
+          zIndex: 25,
+          width: 160,
+          textAlign: "center",
+          background: "transparent",
+          border: "none",
+          borderRadius: 4,
+          color: targetDrawing?.style?.textColor || "#eee",
+          fontSize: size,
+          fontFamily: "sans-serif",
+          fontWeight: targetDrawing?.style?.textBold ? 700 : 400,
+          fontStyle: targetDrawing?.style?.textItalic ? "italic" : "normal",
+          padding: "2px 4px",
+          outline: "none",
+        } : {
           position: "absolute",
           left: textEditor.x + 5,
           top: textEditor.y - 5 - size - 6,
