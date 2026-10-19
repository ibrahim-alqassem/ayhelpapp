/* ===== لوحة الإدارة: إضافة الأنشطة، الاستيراد من Excel، قائمة الإرسال، التوثيق =====
   تعمل فقط لحساب المدير، وكل العمليات محمية في قاعدة البيانات بدالة is_app_admin. */
let adminTab = "add", admList = [], admVerify = [], admEdit = null, admFilter = "new", admImport = null;

TITLES.admin = "لوحة الإدارة";
PAGES.admin = () => {
  if (!isAdmin) return `<div class="empty">${ico("shield")}<b>${t("هذه الصفحة لإدارة التطبيق فقط")}</b></div>`;
  const tb = (k, l, n) => `<button role="tab" data-at="${k}" aria-selected="${adminTab === k}">${t(l)}${n ? " (" + num(n) + ")" : ""}</button>`;
  return `<div class="tabs adm" role="tablist">${tb("add", admEdit ? "تعديل" : "إضافة")}${tb("list", "القائمة")}${tb("import", "استيراد")}${tb("verify", "التوثيق", admVerify.length)}</div><div id="admBody"><p class="center muted pad">${t("لحظة…")}</p></div>`;
};
BIND.admin = async v => {
  if (!isAdmin) return;
  v.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { adminTab = b.dataset.at; renderPage(); });
  const body = v.querySelector("#admBody");
  if (adminTab === "add") return admAddView(body);
  if (adminTab === "list") { await admLoad(); return admListView(body); }
  if (adminTab === "import") return admImportView(body);
  if (adminTab === "verify") { await admLoadVerify(); return admVerifyView(body); }
};
async function admLoad() { const { data } = await sb.rpc("admin_listings"); admList = data || []; }
async function admLoadVerify() {
  const { data } = await sb.rpc("admin_verify_list"); const n = admVerify.length; admVerify = data || [];
  if (n !== admVerify.length) { const x = document.querySelector('[data-at="verify"]'); if (x) x.textContent = t("التوثيق") + (admVerify.length ? " (" + num(admVerify.length) + ")" : ""); }
}

/* ---------- أدوات مشتركة ---------- */
const STL = { new: ["لم يُرسل", ""], sent: ["أُرسل", "new"], claimed: ["تمت المطالبة", "done"] };
const claimUrl = l => `${location.origin}/?claim=${l.claim_token}`;
const claimMsg = l => t("السلام عليكم {name}،\nأضفنا نشاطك في تطبيق «{app}» لخدمات الطريق والمنزل، ليصلك العملاء القريبون منك مجاناً وبدون عمولة.\nلتأكيد ملكيتك وإدارة بياناتك افتح الرابط:\n{url}\nوإن لم ترغب بالظهور ردّ بكلمة «إزالة» ونحذفه فوراً.", { name: l.name, app: APP, url: claimUrl(l) });
function parseMapLink(s) {
  s = toEn(String(s || "")).trim(); let m;
  if ((m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/))) return [+m[1], +m[2]];
  if ((m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))) return [+m[1], +m[2]];
  if ((m = s.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:%2C|,)\+?(-?\d+\.\d+)/))) return [+m[1], +m[2]];
  if ((m = s.match(/^\s*(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)\s*$/))) return [+m[1], +m[2]];
  return null;
}
const inKSA = p => p && p[0] > 16 && p[0] < 33 && p[1] > 34 && p[1] < 56.5;
async function resolveMapLink(s) {
  const p = parseMapLink(s); if (inKSA(p)) return p;
  if (!/^https?:\/\//i.test(String(s).trim())) return null;
  const { data } = await sb.rpc("admin_resolve_map", { u: String(s).trim() });
  const r = data?.ok ? [data.lat, data.lng] : null;
  return inKSA(r) ? r : null;   // نتجاهل أي موقع خارج المملكة (قد يكون موقعاً افتراضياً لصفحة لم تُفتح)
}
const SVC_WORDS = [["كهرباء سيارات", "check"], ["سطح", "tow"], ["سحب", "tow"], ["ونش", "tow"], ["بطاري", "battery"], ["بنزين", "fuel"], ["وقود", "fuel"], ["ديزل", "fuel"],
  ["إطار", "tire"], ["اطار", "tire"], ["كفر", "tire"], ["بنشر", "tire"], ["فتح", "lock"], ["مفتاح", "lock"], ["فحص", "check"], ["ميكاني", "check"], ["توصيل", "delivery"], ["مشاوير", "delivery"],
  ["سباك", "plumbing"], ["كهرب", "electric"], ["تكييف", "ac"], ["مكيف", "ac"], ["تنظيف", "cleaning"], ["نقل عفش", "moving"], ["عفش", "moving"], ["دهان", "paint"], ["صباغ", "paint"],
  ["نجار", "carpentry"], ["حشر", "pest"], ["مكافحة", "pest"]];
function parseServices(s) {
  const out = new Set();
  String(s || "").split(/[،,;\/|+\n]/).map(x => x.trim()).filter(Boolean).forEach(w => {
    const byId = SERVICES.find(x => x.id === w.toLowerCase() || x.name === w || t(x.name).toLowerCase() === w.toLowerCase());
    if (byId) return out.add(byId.id);
    const hit = SVC_WORDS.find(([k]) => w.includes(k)); if (hit) out.add(hit[1]);
  });
  return [...out];
}
function svcChecks(name, sel) {
  return CATS.map(c => `<div class="grp">${ico(c.icon)}${t(c.name)}</div><div class="checks">${SERVICES.filter(s => s.cat === c.id).map(s => `<label><input type="checkbox" name="${name}" value="${s.id}" ${(sel || []).includes(s.id) ? "checked" : ""}><span>${ico(s.icon)}${t(s.name)}</span></label>`).join("")}</div>`).join("");
}
function loadScript(src) {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}

/* ---------- إضافة / تعديل نشاط ---------- */
let admMapObj = null, admSat = false;
function admAddView(el) {
  const l = admEdit || {};
  const is24 = !l.hours || l.hours === "24", [hf, ht] = is24 ? ["08:00", "22:00"] : l.hours.split("-");
  el.innerHTML = `<div class="pad form">
    <div class="minimap admmap"><div id="admMap"></div><div class="center-pin">${ico("pin")}</div>
      <div class="admtools"><button type="button" id="aSat">${t("قمر صناعي")}</button><button type="button" id="aGps">${ico("gps")}</button></div></div>
    <div class="hint">${t("حرّك الخريطة حتى يقع الدبوس على مكان النشاط.")}</div>
    <div class="row2"><input id="aSearch" placeholder="${t("ابحث عن حي أو شارع أو معلم")}"><button type="button" class="btn sm" id="aSearchB">${ico("search")}</button></div>
    <div class="row2"><input id="aLink" class="ltr" placeholder="${t("الصق رابط قوقل ماب أو الإحداثيات")}"><button type="button" class="btn sm ghost" id="aLinkB">${ico("pin")}</button></div>
    <div class="in"><label for="lName">${t("اسم النشاط")}</label><input id="lName" value="${esc(l.name || "")}" placeholder="${t("مثال: سطحة أبو فهد")}"></div>
    <div class="in"><label for="lPhone">${t("رقم الجوال")}</label><div class="phone"><span>+966</span><input id="lPhone" inputmode="numeric" maxlength="10" placeholder="5XXXXXXXX" value="${esc(l.phone || "")}"></div></div>
    <div class="in"><label>${t("الخدمات")}</label>${svcChecks("lsv", l.services)}</div>
    <div class="in"><label for="lDist">${t("المدينة والحي")}</label><input id="lDist" value="${esc(l.district || "")}" placeholder="${t("مثال: الرياض — حي المونسية")}"></div>
    <div class="in"><label>${t("ساعات العمل")}</label>
      <div class="seg2"><label><input type="radio" name="lhrs" value="24" ${is24 ? "checked" : ""}><span>${ico("clock")}${t("٢٤ ساعة")}</span></label><label><input type="radio" name="lhrs" value="custom" ${is24 ? "" : "checked"}><span>${t("وقت محدد")}</span></label></div>
      <div class="timepair" id="lTimes" ${is24 ? "hidden" : ""}><label>${t("من")}<input type="time" id="lFrom" value="${hf}"></label><label>${t("إلى")}<input type="time" id="lTo" value="${ht}"></label></div></div>
    <div class="in"><label for="lPrice">${t("السعر التقريبي")} <span class="opt">${t("(اختياري)")}</span></label><input id="lPrice" value="${esc(l.price_note || "")}"></div>
    <div class="in"><label for="lBio">${t("نبذة")} <span class="opt">${t("(اختياري)")}</span></label><input id="lBio" maxlength="120" value="${esc(l.bio || "")}"></div>
    <label class="check"><input type="checkbox" id="lConsent" ${l.consent ? "checked" : ""}> ${t("أخذت موافقة صاحب النشاط على إضافته")}</label>
    <div class="err" id="lErr" role="alert"></div>
    <button class="btn" id="lSave">${admEdit ? t("حفظ التعديل") : t("أضف النشاط")}</button>
    ${admEdit ? `<button class="btn ghost" id="lCancel">${t("إلغاء التعديل")}</button>` : ""}
  </div>`;
  const q = s => el.querySelector(s), err = q("#lErr");
  const start = l.lat != null ? [l.lat, l.lng] : (myPos || (map ? [map.getCenter().lat, map.getCenter().lng] : [24.7136, 46.6753]));
  admMapObj = L.map(q("#admMap"), { zoomControl: true, attributionControl: true }).setView(start, l.lat != null ? 18 : 15);
  admMapObj.attributionControl.setPrefix(false);
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: isDark() ? "tiles-dark" : "", attribution: "© OpenStreetMap" });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagery © Esri" });
  const lbl = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
  const setBase = () => { [osm, sat, lbl].forEach(x => admMapObj.removeLayer(x)); if (admSat) { sat.addTo(admMapObj); lbl.addTo(admMapObj); } else osm.addTo(admMapObj); q("#aSat").textContent = admSat ? t("خريطة") : t("قمر صناعي"); };
  setBase(); setTimeout(() => admMapObj.invalidateSize(), 250);
  q("#aSat").onclick = () => { admSat = !admSat; setBase(); };
  q("#aGps").onclick = () => navigator.geolocation?.getCurrentPosition(g => admMapObj.setView([g.coords.latitude, g.coords.longitude], 18), () => toast(t("اسمح للموقع بالوصول لموقعك من إعدادات المتصفح")), { enableHighAccuracy: true });
  const doSearch = async () => {
    const s = q("#aSearch").value.trim(); if (!s) return;
    try {
      const c = admMapObj.getCenter(), vb = [c.lng - 0.6, c.lat + 0.6, c.lng + 0.6, c.lat - 0.6].join(",");
      const tries = [...new Set([s, s.replace(/(^|\s)(حي|شارع|طريق)\s+/g, " ").trim()])];
      let hit = null;
      for (const q of tries) {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sa&accept-language=ar&viewbox=${vb}&q=${encodeURIComponent(q)}`).then(x => x.json());
        if (r[0]) { hit = r[0]; break; }
      }
      if (hit) admMapObj.setView([+hit.lat, +hit.lon], 16); else toast(t("لم نجد هذا المكان، جرّب اسماً آخر"));
    } catch (x) { toast(t("تعذّر البحث الآن")); }
  };
  q("#aSearchB").onclick = doSearch; q("#aSearch").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } };
  q("#aLinkB").onclick = async () => {
    const b = q("#aLinkB"); b.disabled = true;
    const p = await resolveMapLink(q("#aLink").value); b.disabled = false;
    if (p) { admMapObj.setView(p, 18); toast(t("وضعنا الدبوس على الموقع")); }
    else toast(t("لم نستخرج الموقع من الرابط. افتح الرابط وانسخ الإحداثيات بدلاً منه."));
  };
  el.querySelectorAll("input[name=lhrs]").forEach(r => r.onchange = () => q("#lTimes").hidden = el.querySelector("input[name=lhrs]:checked").value === "24");
  q("#lPhone").oninput = e => e.target.value = toEn(e.target.value).replace(/\D/g, "").slice(0, 10);
  q("#lCancel")?.addEventListener("click", () => { admEdit = null; adminTab = "list"; renderPage(); });
  q("#lSave").onclick = async () => {
    err.className = "err"; err.textContent = "";
    const name = q("#lName").value.trim(), phone = normPhone(q("#lPhone").value);
    const services = [...el.querySelectorAll("input[name=lsv]:checked")].map(x => x.value);
    if (name.length < 2) return err.textContent = t("اكتب اسم النشاط.");
    if (!/^5\d{8}$/.test(phone)) return err.textContent = t("رقم الجوال يبدأ بـ 5 ويتكون من ٩ أرقام.");
    if (!services.length) return err.textContent = t("اختر خدمة واحدة على الأقل.");
    let hours = "24";
    if (el.querySelector("input[name=lhrs]:checked").value !== "24") {
      const f = q("#lFrom").value, to = q("#lTo").value;
      if (!f || !to || f === to) return err.textContent = t("حدد وقت البداية والنهاية لساعات العمل.");
      hours = f + "-" + to;
    }
    const c = admMapObj.getCenter();
    const row = { id: admEdit?.id ?? null, name, phone, services, hours, district: q("#lDist").value.trim() || null, price_note: q("#lPrice").value.trim() || null,
      bio: q("#lBio").value.trim() || null, lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), consent: q("#lConsent").checked };
    q("#lSave").disabled = true;
    const { data, error } = await sb.rpc("admin_save_listing", { j: row });
    q("#lSave").disabled = false;
    if (error || !data?.ok) {
      const R = { registered: "هذا الرقم مسجّل في التطبيق كمقدم خدمة أو كحساب بالفعل.", duplicate: "يوجد نشاط مضاف بنفس الرقم.", phone: "رقم الجوال غير صحيح." };
      return err.textContent = t(R[data?.reason] || "تعذّر الحفظ. حاول مرة أخرى.");
    }
    toast(admEdit ? t("تم حفظ التعديل") : t("أُضيف النشاط على الخريطة"));
    admEdit = null; loadProviders(); renderPage();
  };
}

/* ---------- القائمة وقائمة الإرسال ---------- */
function admListView(el) {
  const cnt = s => admList.filter(l => s === "all" || l.status === s).length;
  const list = admList.filter(l => admFilter === "all" || l.status === admFilter);
  const fb = (k, l) => `<button class="chipbtn" data-f="${k}" aria-pressed="${admFilter === k}">${t(l)} (${num(cnt(k))})</button>`;
  el.innerHTML = `<div class="pad form">
    <div class="chiprow">${fb("new", "لم يُرسل")}${fb("sent", "أُرسل")}${fb("claimed", "تمت المطالبة")}${fb("all", "الكل")}</div>
    ${cnt("new") ? `<button class="btn wa" id="qStart">${ico("wa")}${t("قائمة الإرسال السريعة ({n})", { n: num(cnt("new")) })}</button>` : ""}
    ${list.length ? `<div class="list admlist">${list.map(l => `<div class="row lrow">
      <span class="t"><b>${esc(l.name)} <span class="pill ${STL[l.status]?.[1] || ""}">${t(STL[l.status]?.[0] || l.status)}</span>${l.consent ? ` <span class="pill done">${t("موافق")}</span>` : ""}</b>
      <span>${phoneHtml(l.phone)} · ${(l.services || []).map(sName).join(t("، "))}${l.district ? " · " + esc(l.district) : ""}</span></span>
      <span class="acts">${l.status !== "claimed" ? `<a class="iconbtn wa-i" data-send="${l.id}" target="_blank" rel="noopener" href="${waLink(intl(l.phone), claimMsg(l))}" aria-label="${t("إرسال رابط المطالبة")}">${ico("wa")}</a>
        <button class="iconbtn" data-copy-l="${l.id}" aria-label="${t("نسخ الرابط")}">${ico("copy")}</button>
        <button class="iconbtn" data-edit="${l.id}" aria-label="${t("تعديل")}">${ico("edit")}</button>
        <button class="iconbtn dangerc" data-del="${l.id}" aria-label="${t("حذف")}">${ico("trash")}</button>` : ""}</span></div>`).join("")}</div>`
      : `<p class="center muted">${t("لا توجد أنشطة هنا بعد.")}</p>`}
  </div>`;
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { admFilter = b.dataset.f; admListView(el); });
  el.querySelector("#qStart")?.addEventListener("click", sendQueue);
  el.querySelectorAll("[data-send]").forEach(a => a.addEventListener("click", async () => {
    const l = admList.find(x => x.id == a.dataset.send); if (l.status === "new") { await sb.rpc("admin_listing_status", { lid: l.id, st: "sent" }); l.status = "sent"; setTimeout(() => admListView(el), 800); }
  }));
  el.querySelectorAll("[data-copy-l]").forEach(b => b.onclick = () => copy(claimUrl(admList.find(x => x.id == b.dataset.copyL))));
  el.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { admEdit = admList.find(x => x.id == b.dataset.edit); adminTab = "add"; renderPage(); });
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const l = admList.find(x => x.id == b.dataset.del);
    confirmBox(t("حذف النشاط"), t("سيُحذف «{name}» من الخريطة ويتوقف رابط المطالبة الخاص به.", { name: l.name }), t("حذف"), async () => {
      await sb.rpc("admin_listing_status", { lid: l.id, st: "removed" }); admList = admList.filter(x => x !== l); admListView(el); loadProviders(); toast(t("حُذف النشاط"));
    }, true);
  });
}
function sendQueue() {
  const queue = admList.filter(l => l.status === "new"); let i = 0, done = 0;
  const show = () => {
    if (i >= queue.length) {
      modal(`<h3 class="okc">${ico("check")}${t("انتهت القائمة")}</h3><p class="lead">${t("أرسلت {n} رسالة. تابع الردود في واتساب، وسيظهر لك من يستلم نشاطه في «تمت المطالبة».", { n: num(done) })}</p><div class="form"><button class="btn" data-close>${t("تم")}</button></div>`);
      if (tab === "admin") renderPage(); return;
    }
    const l = queue[i];
    modal(`<h3>${ico("wa")}${t("الإرسال {i} من {n}", { i: num(i + 1), n: num(queue.length) })}</h3>
      <p class="lead"><b>${esc(l.name)}</b> · ${phoneHtml(l.phone)}</p>
      <pre class="msgprev">${esc(claimMsg(l))}</pre>
      <div class="form"><a class="btn wa" id="qSend" target="_blank" rel="noopener" href="${waLink(intl(l.phone), claimMsg(l))}">${ico("wa")}${t("افتح واتساب وأرسل")}</a>
        <div class="btns"><button class="btn ghost sm" id="qSkip">${t("تخطّي")}</button><button class="btn ghost sm" data-close>${t("إيقاف")}</button></div></div>
      <p class="small muted center">${t("بعد الإرسال ارجع للتطبيق، وسيظهر التالي تلقائياً. أرسل دفعات صغيرة (٣٠–٥٠ يومياً) حتى لا يحظر واتساب رقمك.")}</p>`, m => {
      m.querySelector("#qSend").addEventListener("click", async () => {
        await sb.rpc("admin_listing_status", { lid: l.id, st: "sent" }); l.status = "sent"; done++; i++;
        const next = () => { document.removeEventListener("visibilitychange", vis); show(); };
        const vis = () => { if (document.visibilityState === "visible") setTimeout(next, 400); };
        document.addEventListener("visibilitychange", vis);
        setTimeout(() => { if (document.visibilityState === "visible") next(); }, 2500);
      });
      m.querySelector("#qSkip").onclick = () => { i++; show(); };
    });
  };
  show();
}

/* ---------- الاستيراد من Excel ---------- */
const COLS = { name: /اسم|name/i, phone: /جوال|هاتف|رقم|phone|mobile/i, services: /خدم|نشاط|service/i, district: /حي|مدينة|district|city/i,
  loc: /موقع|رابط|إحداث|احداث|location|map|link/i, hours: /ساع|hours/i, price: /سعر|price/i, bio: /نبذة|وصف|bio/i, consent: /موافق|consent/i };
function admImportView(el) {
  el.innerHTML = `<div class="pad form">
    <p class="muted m0">${t("رتّب الملف بأعمدة: الاسم، الجوال، الخدمات، الحي، الموقع (رابط قوقل ماب أو إحداثيات)، ساعات العمل، السعر، نبذة، الموافقة. الصف الأول للعناوين.")}</p>
    <a class="btn ghost sm" href="admin/ayhelp-template.xlsx" download>${ico("copy")}${t("تحميل قالب Excel")}</a>
    <label class="btn">${ico("plus")}${t("اختر ملف Excel أو CSV")}<input type="file" id="xFile" accept=".xlsx,.xls,.csv" hidden></label>
    <div id="xOut"></div>
  </div>`;
  el.querySelector("#xFile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const out = el.querySelector("#xOut"); out.innerHTML = `<p class="center muted">${t("نقرأ الملف…")}</p>`;
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      if (!rows.length) { out.innerHTML = `<p class="err">${t("الملف فارغ.")}</p>`; return; }
      const heads = Object.keys(rows[0]), col = {};
      Object.entries(COLS).forEach(([k, re]) => col[k] = heads.find(h => re.test(h) && !Object.values(col).includes(h)));
      const items = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], g = k => col[k] ? String(r[col[k]] ?? "").trim() : "";
        if (!g("name") && !g("phone")) continue;
        const hrs = toEn(g("hours")).replace(/\s/g, "");
        const it = { n: i + 2, name: g("name"), phone: normPhone(g("phone")), services: parseServices(g("services")), district: g("district") || null,
          loc: g("loc"), hours: /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(hrs) ? hrs.replace(/\b(\d):/g, "0$1:") : "24", price_note: g("price") || null, bio: g("bio") || null,
          consent: /نعم|yes|true|1|✓/i.test(g("consent")), lat: null, lng: null, err: "" };
        const p = parseMapLink(it.loc); if (inKSA(p)) [it.lat, it.lng] = p;
        items.push(it);
      }
      const pend = items.filter(x => x.lat == null && /^https?:/i.test(x.loc));
      for (let k = 0; k < pend.length; k++) {
        out.innerHTML = `<p class="center muted">${t("نستخرج المواقع من الروابط… {i} من {n}", { i: num(k + 1), n: num(pend.length) })}</p>`;
        const p = await resolveMapLink(pend[k].loc); if (p) [pend[k].lat, pend[k].lng] = p;
      }
      const seen = new Set();
      items.forEach(x => {
        x.err = x.name.length < 2 ? t("الاسم ناقص") : !/^5\d{8}$/.test(x.phone) ? t("رقم غير صحيح") : !x.services.length ? t("الخدمة غير معروفة")
          : x.lat == null ? t("الموقع ناقص") : seen.has(x.phone) ? t("رقم مكرر في الملف") : "";
        seen.add(x.phone);
      });
      admImport = items; admImportPreview(out);
    } catch (x) { out.innerHTML = `<p class="err">${t("تعذّر قراءة الملف. تأكد أنه Excel أو CSV.")}</p>`; }
  };
}
function admImportPreview(out) {
  const ok = admImport.filter(x => !x.err), bad = admImport.filter(x => x.err);
  out.innerHTML = `<div class="card"><b>${t("{a} صف جاهز للاستيراد", { a: num(ok.length) })}</b>${bad.length ? `<span class="muted">${t("و{b} صف فيه مشكلة ولن يُستورد:", { b: num(bad.length) })}</span>` : ""}</div>
    ${bad.length ? `<ul class="replist">${bad.slice(0, 50).map(x => `<li>${t("صف {n}", { n: num(x.n) })}: ${esc(x.name || "—")} — <span class="dangerc">${x.err}</span></li>`).join("")}</ul>` : ""}
    ${ok.length ? `<div class="xprev">${ok.slice(0, 30).map(x => `<div><b>${esc(x.name)}</b> <span class="muted">${phoneHtml(x.phone)} · ${x.services.map(sName).join(t("، "))}</span></div>`).join("")}${ok.length > 30 ? `<div class="muted">${t("و{n} غيرها…", { n: num(ok.length - 30) })}</div>` : ""}</div>
    <button class="btn" id="xGo">${t("استيراد {n} نشاط", { n: num(ok.length) })}</button>` : ""}`;
  out.querySelector("#xGo")?.addEventListener("click", async e => {
    const b = e.currentTarget; b.disabled = true; let ins = 0, skip = 0;
    for (let i = 0; i < ok.length; i += 100) {
      b.textContent = t("نستورد… {i} من {n}", { i: num(Math.min(i + 100, ok.length)), n: num(ok.length) });
      const chunk = ok.slice(i, i + 100).map(({ name, phone, services, district, hours, price_note, bio, consent, lat, lng }) => ({ name, phone, services, district, hours, price_note, bio, consent, lat, lng }));
      const { data, error } = await sb.rpc("admin_import_listings", { rows: chunk });
      if (error) { toast(t("تعذّر الاستيراد، حاول مرة أخرى")); b.disabled = false; return; }
      ins += data.inserted; skip += data.skipped;
    }
    admImport = null; loadProviders();
    out.innerHTML = `<div class="card brand"><b>${t("أُضيف {a} نشاط على الخريطة", { a: num(ins) })}</b>${skip ? `<span class="muted">${t("وتُرك {b} لأن أرقامها مسجّلة من قبل.", { b: num(skip) })}</span>` : ""}<button class="btn sm" id="xList">${t("افتح قائمة الإرسال")}</button></div>`;
    out.querySelector("#xList").onclick = () => { adminTab = "list"; admFilter = "new"; renderPage(); };
  });
}

/* ---------- طلبات التوثيق والمطالبة ---------- */
function admVerifyView(el) {
  if (!admVerify.length) { el.innerHTML = `<div class="empty">${ico("shield")}<b>${t("لا توجد طلبات توثيق")}</b><span>${t("عندما يطلب أحد توثيق رقمه أو ملكية نشاط يظهر هنا، ويصلك إشعار.")}</span></div>`; return; }
  el.innerHTML = `<div class="pad form">${admVerify.map(v => {
    const exp = v.listing_id ? v.listing_phone : v.contact_phone;
    return `<div class="card vcard">
      <b>${v.listing_id ? t("ملكية نشاط: {n}", { n: esc(v.listing_name || "") }) : t("توثيق رقم")}</b>
      <span>${t("الحساب")}: ${esc(v.user_name || "—")}${v.login_phone ? " · " + phoneHtml(v.login_phone) : ""}</span>
      <div class="codebig sm" dir="ltr">${num(v.code)}</div>
      <span class="small">${t("اعتمد فقط إذا وصلتك رسالة واتساب من الرقم {p} وفيها هذا الرمز.", { p: phoneHtml(exp || "") })}</span>
      <div class="btns"><button class="btn sm" data-ok="${v.id}">${ico("check")}${t("اعتماد")}</button><button class="btn ghost sm" data-no="${v.id}">${t("رفض")}</button>
      ${exp ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(intl(exp))}">${ico("wa")}</a>` : ""}</div></div>`;
  }).join("")}</div>`;
  const decide = async (id, approve) => {
    const { error } = await sb.rpc("admin_verify_decide", { rid: +id, approve });
    if (error) return toast(t("تعذّر تنفيذ الإجراء"));
    admVerify = admVerify.filter(x => x.id != id); toast(approve ? t("تم الاعتماد وأُبلغ صاحبه") : t("رُفض الطلب")); loadProviders(); renderPage();
  };
  el.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => decide(b.dataset.ok, true));
  el.querySelectorAll("[data-no]").forEach(b => b.onclick = () => decide(b.dataset.no, false));
}
