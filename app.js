/* أي هلب — منطق التطبيق */
"use strict";
const C = window.CONFIG;
const store = {
  get(k, d) { try { const v = localStorage.getItem("ak-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ak-" + k, JSON.stringify(v)); } catch (e) {} }
};

/* ===== اللغة ===== */
const LANG = store.get("lang", "ar") === "en" ? "en" : "ar";
const EN = LANG === "en";
document.documentElement.lang = LANG;
document.documentElement.dir = EN ? "ltr" : "rtl";
const DICT = window.I18N_EN || {};
function t(s, v) { let r = EN && DICT[s] != null ? DICT[s] : s; if (v) r = r.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ""); return r; }
const num = n => EN ? String(n) : String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const LOC = EN ? "en-GB" : "ar-SA-u-ca-gregory-nu-arab";
const fmtDate = x => new Date(x).toLocaleString(LOC, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const APP = t(C.appName), TAG = t(C.tagline);
document.title = APP;

const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });

/* ===== الخدمات ===== */
const CATS = [
  { id: "road", name: "خدمات الطريق", icon: "car" },
  { id: "home", name: "خدمات المنزل", icon: "home" }
];
const SERVICES = [
  { id: "delivery", cat: "road", name: "توصيل", desc: "توصيل أغراض وطلبات", icon: "car" },
  { id: "battery", cat: "road", name: "اشتراك بطارية", desc: "اشتراك أو تبديل بطارية", icon: "battery" },
  { id: "fuel", cat: "road", name: "تزويد البنزين", desc: "توصيل وقود ٩١ أو ٩٥ أو ديزل", icon: "fuel" },
  { id: "tire", cat: "road", name: "تبديل الإطار", desc: "تركيب الاحتياطي أو رقعة", icon: "tire" },
  { id: "tow", cat: "road", name: "خدمة سحب", desc: "سطحة لنقل السيارة", icon: "tow" },
  { id: "lock", cat: "road", name: "فتح سيارة مقفلة", desc: "المفتاح داخل السيارة", icon: "key" },
  { id: "check", cat: "road", name: "فحص وإصلاح سريع", desc: "فني متنقل يشخّص العطل", icon: "wrench" },
  { id: "plumbing", cat: "home", name: "سباكة", desc: "تسربات، تمديدات، سخانات", icon: "drop" },
  { id: "electric", cat: "home", name: "كهرباء", desc: "أعطال، تمديدات، إنارة", icon: "bolt" },
  { id: "ac", cat: "home", name: "تكييف", desc: "صيانة وتنظيف وتعبئة فريون", icon: "snow" },
  { id: "cleaning", cat: "home", name: "تنظيف", desc: "منازل، كنب، سجاد، خزانات", icon: "sparkle" },
  { id: "moving", cat: "home", name: "نقل عفش", desc: "فك وتركيب ونقل", icon: "box" },
  { id: "paint", cat: "home", name: "دهانات", desc: "دهان داخلي وخارجي", icon: "roller" },
  { id: "carpentry", cat: "home", name: "نجارة", desc: "أبواب، مطابخ، غرف نوم", icon: "hammer" },
  { id: "pest", cat: "home", name: "مكافحة حشرات", desc: "رش ومكافحة", icon: "bug" }
];
const svc = id => SERVICES.find(s => s.id === id) || { id, cat: "road", name: id, desc: "", icon: "wrench" };
const sName = id => t(svc(id).name);
function askFor(id) {
  const s = svc(id);
  if (s.id === "delivery") return { label: t("تفاصيل التوصيل"), ph: t("من أين إلى أين، وما المطلوب توصيله") };
  if (s.cat === "home") return { label: t("وصف العمل"), ph: t("مثال: تسريب تحت المغسلة") };
  return { label: t("السيارة"), ph: t("مثال: كامري ٢٠٢٠ بيضاء") };
}
const KIND = { new: "طلب جديد", accepted: "تم قبول طلبك", done: "تم تنفيذ طلبك", declined: "اعتذر مقدم الخدمة عن طلبك", cancelled: "ألغى العميل الطلب" };
const noteTitle = n => n.kind && KIND[n.kind] ? t(KIND[n.kind]) + " #" + num(n.request_id) : n.title;

/* ===== أيقونات ===== */
const IC = {
  menu: '<path d="M4 7h16M8 12h12M11 17h9"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  gps: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/><path d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2"/>',
  car: '<path d="M3 16v-4l2.5-5h13L21 12v4h-1.5"/><path d="M4 12h16M9.5 16h5"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/>',
  battery: '<rect x="3" y="7" width="16" height="11" rx="2"/><path d="M7 5v2M15 5v2M7 12.5h3M13 12.5h3M14.5 11v3"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12M6 9h6"/><path d="M14 11h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>',
  tow: '<path d="M2 17h12V9h4l4 4v4h-2"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M2 13 9 6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3"/><path d="M14.7 6.3 9 1"/><path d="M3 21l6-6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  snow: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  sparkle: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  roller: '<rect x="3" y="3" width="15" height="6" rx="1.5"/><path d="M18 6h2v5h-8v3"/><rect x="10.5" y="14" width="3" height="7" rx="1"/>',
  hammer: '<path d="m14 7-9 9a2 2 0 0 0 3 3l9-9"/><path d="m12 5 3-3 7 7-3 3z"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7v13M9 3.5l1.5 3.5M15 3.5 13.5 7M3 11h4M17 11h4M3 17h4M17 17h4"/>',
  chev: '<path d="m15 6-6 6 6 6"/>', back: '<path d="m9 6 6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  orders: '<path d="M4 7h16l-1.5 12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z"/><path d="M8 7a4 4 0 0 1 8 0"/>',
  store: '<path d="M3 9 5 4h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9h18M9 20v-6h6v6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4.5A8 8 0 1 1 21 12z"/>',
  heart: '<path d="M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z"/>',
  lang: '<path d="M3 5h10M8 3v2M5 9c1 3 4 5 6 6M11 5c-1 5-4 8-7 9"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
  check: '<path d="m5 12 5 5 9-10"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.7M6.1 7.6C3.9 9.2 3 12 3 12s4 6 9 6c1.3 0 2.5-.3 3.6-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  plus: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"/>',
  wa: '<path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a5 5 0 0 1-2.8-2.8l.8-1-1-2z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const ico = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ""}</svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toEn = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const $ = id => document.getElementById(id);
const waLink = (n, msg) => `https://wa.me/${String(n || "").replace(/\D/g, "")}${msg ? "?text=" + encodeURIComponent(msg) : ""}`;
const intl = p => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("966") ? d : "966" + d.replace(/^0/, ""); };
const phoneTxt = p => { const d = intl(p); return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`; };
const phoneHtml = p => `<bdi dir="ltr" class="nowrap">${phoneTxt(p)}</bdi>`;

/* ===== ساعات العمل ===== */
const mins = s => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
function fmtTime(s) { const d = new Date(2000, 0, 1, ...String(s).split(":").map(Number)); return d.toLocaleTimeString(LOC, { hour: "numeric", minute: "2-digit" }); }
function hoursText(h) {
  if (!h) return "";
  if (h === "24") return t("متوفر ٢٤ ساعة");
  const [a, b] = h.split("-");
  return t("من {a} إلى {b}", { a: fmtTime(a), b: fmtTime(b) });
}
function openNow(h) {
  if (!h) return null;
  if (h === "24") return true;
  const [a, b] = h.split("-").map(mins), d = new Date(), n = d.getHours() * 60 + d.getMinutes();
  return a <= b ? (n >= a && n < b) : (n >= a || n < b);
}
const openPill = h => { const o = openNow(h); return o === null ? "" : `<span class="pill ${o ? "done" : "bad"}">${o ? t("متوفر الآن") : t("غير متوفر الآن")}</span>`; };
const priceHint = () => `<p class="pricehint">${ico("tag")}<span>${t("السعر يُتفق عليه مباشرة مع مقدم الخدمة حسب الموقع والمسافة ونوع العمل.")}</span></p>`;

/* ===== الحالة ===== */
const app = $("app");
let session = null, me = null;
let providers = [], myReqs = [], inReqs = [], notes = [], isAdmin = false;
let tab = "home", sheetState = 0, cat = store.get("cat", "road"), filter = null, ordersTab = "mine";
let map = null, markers = null, meMarker = null, tiles = null, myPos = store.get("pos", null), channel = null;
let theme = store.get("theme", "system"), notifyOn = store.get("notify", true), deferredInstall = null;
applyTheme();

function isDark() { return theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches); }
function applyTheme() {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark() ? "#0F1719" : "#0E5E63");
  if (map) setTiles();
}

/* ===== زر الرجوع في الجوال =====
   نضع خطوة واحدة في سجل المتصفح ما دام هناك شيء مفتوح (نافذة، قائمة، صفحة، قائمة الخدمات)،
   فيغلق زر الرجوع أعلى شيء مفتوح بدل الخروج من الموقع. */
let trap = false, ignorePop = false, syncT = null;
function hasOpen() {
  return !!(app.querySelector(".modal") || app.querySelector(".authlayer") || $("drawer")?.classList.contains("on") || tab !== "home" || filter || sheetState > 0);
}
function closeTopmost() {
  const m = app.querySelector(".modal"); if (m) { m.remove(); return; }
  const a = app.querySelector(".authlayer"); if (a) { a.remove(); return; }
  if ($("drawer")?.classList.contains("on")) { closeDrawer(); return; }
  if (tab !== "home") { go("home"); return; }
  if (filter) { filter = null; drawMarkers(); renderSheet(); return; }
  if (sheetState > 0) { sheetState--; renderSheet(); }
}
function sync() {
  clearTimeout(syncT);
  if (hasOpen()) { if (!trap) { history.pushState({ ak: 1 }, ""); trap = true; } }
  else if (trap) syncT = setTimeout(() => { if (!hasOpen() && trap) { trap = false; ignorePop = true; history.back(); } }, 300);
}
addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; return; }
  trap = false; closeTopmost(); sync();
});
function goBack() { if (trap) history.back(); else { closeTopmost(); sync(); } }
new MutationObserver(() => sync()).observe(app, { childList: true });

/* ===== البداية ===== */
async function boot() {
  claimFromUrl();
  startShell();
  maybeInstallPrompt();
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) await afterLogin(); else processClaim().catch(e => console.warn(e));
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === "PASSWORD_RECOVERY") { session = s; newPasswordBox(); return; }
    if (ev === "SIGNED_OUT") { session = null; me = null; cleanupRealtime(); return; }
    if (ev === "TOKEN_REFRESHED" || ev === "USER_UPDATED") session = s;
  });
}
async function afterLogin() {
  await loadMe();
  try { isAdmin = (await sb.rpc("is_app_admin")).data === true; } catch (e) { isAdmin = false; }
  try { await processClaim(); } catch (e) { console.warn(e); }
  renderDrawer(); renderNav(); renderTop();
  if (tab !== "home") renderPage();
  loadRequests(); loadNotes(); subscribe();
  pushLogin(); setTimeout(maybePushPrompt, 2500);
  openDeepLink();
}
/* فتح الطلب أو البلاغ مباشرة عند الضغط على الإشعار */
function openDeepLink() {
  const q = new URLSearchParams(location.search), r = +q.get("report"), id = +q.get("req");
  if (!r && !id) return;
  history.replaceState(history.state, "", location.pathname);
  setTimeout(async () => { if (r) adminReport(r); else { await loadRequests(); reqDetails(id); } }, 600);
}
async function loadMe() {
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  me = data;
  if (!me) {
    const md = session.user.user_metadata || {};
    const ins = await sb.from("profiles").insert({ id: session.user.id, name: md.name || "", phone: md.phone || "" }).select().maybeSingle();
    me = ins.data || { id: session.user.id, name: md.name || "", phone: md.phone || "", is_provider: false, services: [] };
  }
}
async function loadProviders() {
  const [a, b] = await Promise.all([
    sb.from("profiles").select("id,name,phone,services,bio,district,lat,lng,active,is_provider,hours,price_note,avatar_url,verified").eq("is_provider", true).eq("active", true).eq("suspended", false),
    sb.from("listings").select("id,name,phone,services,district,bio,hours,price_note,lat,lng,status")
  ]);
  if (a.error) return;
  const own = new Set((a.data || []).map(p => p.phone));
  providers = (a.data || []).concat((b.data || []).filter(l => !own.has(l.phone)).map(l => ({ ...l, id: "L" + l.id, lid: l.id, listing: true })));
  drawMarkers(); if (tab === "home") renderSheet();
}
async function loadRequests() {
  if (!session) return;
  const uid = session.user.id;
  const { data } = await sb.from("requests").select("*").or(`customer_id.eq.${uid},provider_id.eq.${uid}`).order("created_at", { ascending: false });
  myReqs = (data || []).filter(r => r.customer_id === uid);
  inReqs = (data || []).filter(r => r.provider_id === uid);
  if (tab === "orders" || tab === "account") renderPage();
}
async function loadNotes() {
  if (!session) return;
  const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  notes = data || []; renderNav(); if (tab === "notes" || tab === "account") renderPage();
}
function subscribe() {
  cleanupRealtime();
  channel = sb.channel("u-" + session.user.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` }, p => {
      notes.unshift(p.new); renderNav(); if (tab === "notes") renderPage();
      toast(noteTitle(p.new)); loadRequests(); refreshAll();
    }).subscribe();
}
/* تحديث تلقائي: عند الرجوع للتطبيق، وكل دقيقة ما دام مفتوحاً، وعند وصول إشعار */
let lastRefresh = Date.now();
async function refreshAll() {
  lastRefresh = Date.now();
  await loadProviders();
  if (!session) return;
  await loadMe(); renderDrawer();
  loadRequests(); loadNotes();
  if (tab === "admin" && typeof admLoad === "function" && ["list", "verify"].includes(adminTab)) renderPage();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - lastRefresh > 5000 && typeof sb !== "undefined") refreshAll().catch(() => {}); });
setInterval(() => { if (document.visibilityState === "visible" && !app.querySelector(".modal") && !app.querySelector(".authlayer")) refreshAll().catch(() => {}); }, 60000);
function cleanupRealtime() { if (channel) { sb.removeChannel(channel); channel = null; } }
const unread = () => notes.filter(n => !n.read).length;
function needLogin(why, then, role) {
  if (session) return false;
  openAuth("signup", { why, then, role });
  return true;
}

/* ===== التسجيل والدخول (طبقة فوق الموقع) ===== */
let authOpts = {};
/* الدخول برقم الجوال: يُحفظ الرقم داخلياً كبريد مخفي (بدون رسائل تحقق) */
const PHONE_DOMAIN = "u.ayhelpapp.com";
const normPhone = v => { let d = toEn(String(v || "")).replace(/\D/g, ""); d = d.replace(/^00966/, "").replace(/^966/, "").replace(/^0/, ""); return d; };
const phoneEmail = p => `966${p}@${PHONE_DOMAIN}`;
const isPhoneAcct = () => (session?.user?.email || "").endsWith("@" + PHONE_DOMAIN);
const loginId = () => isPhoneAcct() ? "+966 " + session.user.email.split("@")[0].replace(/^966/, "").replace(/^(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3") : (session?.user?.email || "");
function openAuth(mode = "signup", opts = {}) {
  authOpts = opts; closeDrawer();
  app.querySelector(".modal")?.remove();
  let el = app.querySelector(".authlayer");
  if (!el) { el = document.createElement("div"); el.className = "authlayer"; app.appendChild(el); }
  renderAuth(el, mode);
}
function renderAuth(el, mode) {
  const signup = mode === "signup", o = authOpts, role = o.role || "customer";
  el.innerHTML = `
  <header class="top"><button class="iconbtn" id="aBack" aria-label="${t("رجوع")}">${ico("back", "i flip")}</button><h1>${signup ? t("حساب جديد") : t("تسجيل الدخول")}</h1><span class="sp"></span></header>
  <div class="auth${signup ? " compact" : ""}">
    ${signup ? "" : `<div class="brandmark"><img class="logoimg" src="icon-192.png" alt=""><div><h1>${APP}</h1><p>${TAG}</p></div></div>`}
    ${o.why && !signup ? `<div class="notebox">${ico("info")}<span>${esc(o.why)}</span></div>` : ""}
    <h2>${signup ? t("أنشئ حسابك مجاناً") : t("مرحباً بعودتك!")}</h2>
    <p class="sub${o.why && signup ? " why" : ""}">${o.why && signup ? esc(o.why) : signup ? t("سجّل برقم جوالك وكلمة مرور خلال ثوانٍ") : t("ادخل برقم جوالك وكلمة المرور")}</p>
    <form class="form" id="aForm" novalidate>
      ${signup ? `<div class="in"><div class="seg2 box" role="radiogroup" aria-label="${t("أريد أن")}">
        <label><input type="radio" name="role" value="customer" ${role === "customer" ? "checked" : ""}><span>${ico("search")}${t("أطلب خدمة")}</span></label>
        <label><input type="radio" name="role" value="provider" ${role === "provider" ? "checked" : ""}><span>${ico("store")}${t("أقدّم خدمة")}</span></label></div>
</div>
      <div class="in"><label for="aName">${t("الاسم")}</label><input id="aName" autocomplete="name" placeholder="${t("اسمك أو اسم نشاطك")}" value="${esc(o.name || "")}"></div>` : ""}
      <div class="in" id="phoneIn"><label for="aPhone">${t("رقم الجوال")}</label><div class="phone"><span id="aCC">+966</span><input id="aPhone" inputmode="numeric" ${signup ? 'maxlength="10"' : ""} placeholder="5XXXXXXXX" autocomplete="${signup ? "tel-national" : "username"}" value="${esc(o.phone || "")}" ${o.phone ? "readonly" : ""}></div></div>
      <div class="in"><label for="aPass">${t("كلمة المرور")}</label><div class="passw"><input id="aPass" type="password" class="ltr" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? t("٦ أحرف أو أرقام على الأقل") : t("كلمة المرور")}"><button type="button" class="eye" id="aEye">${t("إظهار")}</button></div></div>
      <div class="err" id="aErr" role="alert"></div>
      ${signup ? `<p class="terms">${t("بالمتابعة، أوافق على")} <button type="button" id="aTerms">${t("الشروط والأحكام وسياسة الخصوصية")}</button></p>` : ""}
      <button class="btn" type="submit" id="aBtn">${signup ? t("إنشاء الحساب") : t("دخول")}</button>
      ${signup ? "" : `<button type="button" class="textlink center" id="aForgot">${t("نسيت كلمة المرور؟")}</button>`}
    </form>
    <p class="alt">${signup ? t("لديك حساب؟") : t("ليس لديك حساب؟")} <button type="button" class="textlink" id="aSwitch">${signup ? t("تسجيل الدخول") : t("أنشئ حساباً مجاناً")}</button></p>
  </div>`;
  const q = s => el.querySelector(s), err = q("#aErr");
  q("#aBack").onclick = goBack;
  q("#aSwitch").onclick = () => renderAuth(el, signup ? "login" : "signup");
  if (q("#aTerms")) q("#aTerms").onclick = termsBox;
  q("#aEye").onclick = () => { const p = q("#aPass"), show = p.type === "password"; p.type = show ? "text" : "password"; q("#aEye").textContent = show ? t("إخفاء") : t("إظهار"); };
  /* دخول خفي بالبريد (للمدير والمراجع): خانة الجوال تقبل البريد إذا كُتب أو لُصق فيها «@»،
     والضغط المطوّل على +966 يفتح لوحة مفاتيح البريد */
  let byEmail = false;
  const ph = q("#aPhone"), cc = q("#aCC");
  const mailMode = on => { byEmail = on; cc.hidden = on; ph.classList.toggle("ltr", on); ph.inputMode = on ? "email" : "numeric"; };
  if (signup) ph.addEventListener("input", () => { ph.value = toEn(ph.value).replace(/\D/g, "").slice(0, 10); });
  else {
    let forced = false;
    ph.addEventListener("input", () => {
      if (!ph.value) forced = false;
      const m = forced || /[A-Za-z@]/.test(ph.value);
      if (m !== byEmail) mailMode(m);
    });
    let lp = null;
    const lpEnd = () => clearTimeout(lp);
    cc.addEventListener("pointerdown", () => { lp = setTimeout(() => { forced = true; mailMode(true); ph.blur(); setTimeout(() => ph.focus(), 50); }, 700); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => cc.addEventListener(ev, lpEnd));
  }
  if (!signup && !o.phone) {
    const last = store.get("lastLogin", "");
    if (last) { ph.value = last; if (last.includes("@")) mailMode(true); }
    if (window.PasswordCredential && navigator.credentials) navigator.credentials.get({ password: true, mediation: "optional" }).then(c => {
      if (!c || !c.password || !el.isConnected) return;
      ph.value = c.id.includes("@") ? c.id : "0" + normPhone(c.id); mailMode(c.id.includes("@")); q("#aPass").value = c.password;
    }).catch(() => {});
  }
  if (q("#aForgot")) q("#aForgot").onclick = async () => {
    if (!byEmail) {
      const p = normPhone(q("#aPhone").value);
      err.className = "err ok";
      err.innerHTML = `${t("لاستعادة كلمة المرور راسلنا واتساب من رقمك المسجّل، ونعيد ضبطها لك.")} <a href="${waLink(C.supportWhatsapp, t("السلام عليكم، نسيت كلمة المرور لحسابي في {app}. رقمي: {p}", { app: APP, p: p ? "0" + p : "" }))}" target="_blank" rel="noopener">${t("راسلنا الآن")}</a>`;
      return;
    }
    const email = ph.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = t("اكتب بريدك أولاً ثم اضغط «نسيت كلمة المرور»."); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    err.className = error ? "err" : "err ok";
    err.textContent = error ? t("تعذّر إرسال رابط الاستعادة الآن. تواصل معنا لنساعدك.") : t("أرسلنا رابط تغيير كلمة المرور إلى بريدك.");
  };
  q("#aForm").onsubmit = async e => {
    e.preventDefault(); err.className = "err"; err.textContent = "";
    const pass = q("#aPass").value, btn = q("#aBtn"), label = btn.textContent;
    const phone = normPhone(q("#aPhone").value);
    let email;
    if (byEmail) {
      email = ph.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = t("اكتب بريداً إلكترونياً صحيحاً.");
    } else {
      if (!/^5\d{8}$/.test(phone)) return err.textContent = t("رقم الجوال يبدأ بـ 5 ويتكون من ٩ أرقام.");
      email = phoneEmail(phone);
    }
    if (pass.length < 6) return err.textContent = t("كلمة المرور ٦ أحرف أو أرقام على الأقل.");
    let res, chosen = "customer";
    if (signup) {
      const name = q("#aName").value.trim();
      chosen = el.querySelector("input[name=role]:checked")?.value || "customer";
      if (name.length < 2) return err.textContent = t("اكتب اسمك.");
      btn.disabled = true; btn.textContent = t("لحظة…");
      res = await sb.auth.signUp({ email, password: pass, options: { data: { name, phone } } });
    } else {
      btn.disabled = true; btn.textContent = t("لحظة…");
      res = await sb.auth.signInWithPassword({ email, password: pass });
    }
    btn.disabled = false; btn.textContent = label;
    if (res.error) {
      const m = res.error.message || "";
      err.textContent = /Invalid login/i.test(m) ? (byEmail ? t("البريد أو كلمة المرور غير صحيحة.") : t("رقم الجوال أو كلمة المرور غير صحيحة."))
        : /registered|exists/i.test(m) ? (byEmail ? t("هذا البريد مسجّل من قبل. سجّل الدخول بدلاً من ذلك.") : t("هذا الرقم مسجّل من قبل. سجّل الدخول بدلاً من ذلك."))
        : /rate|too many/i.test(m) ? t("محاولات كثيرة. انتظر دقيقة ثم حاول.")
        : /confirm/i.test(m) ? t("فعّل حسابك من الرابط المرسل لبريدك أولاً.")
        : t("تعذّر الإكمال: ") + m;
      return;
    }
    if (!res.data.session) { err.className = "err ok"; err.textContent = t("أرسلنا رابط التفعيل لبريدك. افتحه ثم سجّل الدخول."); return; }
    session = res.data.session; el.remove();
    const loginName = byEmail ? email : "0" + phone;
    store.set("lastLogin", loginName);
    try { if (window.PasswordCredential) navigator.credentials.store(new PasswordCredential({ id: loginName, password: pass, name: signup ? q("#aName").value.trim() : loginName })).catch(() => {}); } catch (e) {}
    await afterLogin();
    toast(signup ? t("أهلاً {name}! حسابك جاهز", { name: me?.name || "" }) : t("أهلاً بعودتك"));
    if (chosen === "provider" && !me?.is_provider) providerSetup();
    else if (typeof o.then === "function") o.then();
  };
}

/* ===== الهيكل ===== */
function startShell() {
  app.innerHTML = `
    <header class="top"><span id="topStart"></span><h1 id="title"></h1><span id="topEnd"></span></header>
    <main class="view map" id="mapView">
      <div id="map" aria-label="${t("خريطة مقدمي الخدمات")}"></div>
      <div class="mapbar"><div class="chip grow" id="filterChip" hidden></div><span class="grow" id="spacer"></span><button class="fab locbtn" id="locBtn" aria-label="${t("موقعي")}">${ico("gps")}</button></div>
      <section class="sheet closed" id="sheet" aria-label="${t("الخدمات")}"></section>
    </main>
    <main class="view" id="pageView" hidden></main>
    <nav class="nav" id="nav" aria-label="${t("التنقل")}"></nav>
    <div class="dscrim" id="dscrim"></div>
    <aside class="drawer" id="drawer" aria-label="${t("القائمة الجانبية")}"></aside>`;
  $("dscrim").onclick = goBack;
  $("locBtn").onclick = () => locate(true);
  initMap(); loadProviders(); go("home");
  if (myPos) placeMe(); else locate(false);
}
const TITLES = { home: "اطلب خدمة", notes: "الإشعارات", account: "حسابي", settings: "الإعدادات", orders: "الطلبات", contact: "تواصل معنا", about: "عن الموقع", admin: "لوحة الإدارة" };
const SUBPAGES = ["orders", "contact", "about", "admin"];
function go(tb) {
  tab = tb; closeDrawer();
  $("title").textContent = t(TITLES[tb]);
  const isMap = tb === "home";
  $("mapView").hidden = !isMap; $("pageView").hidden = isMap;
  if (isMap) { setTimeout(() => map && map.invalidateSize(), 50); renderSheet(); }
  else { $("pageView").scrollTop = 0; renderPage(); }
  renderTop(); renderNav(); renderDrawer(); sync();
}
function renderTop() {
  const st = $("topStart"), end = $("topEnd"); if (!st) return;
  if (SUBPAGES.includes(tab)) { st.innerHTML = `<button class="iconbtn" id="backBtn" aria-label="${t("رجوع")}">${ico("back", "i flip")}</button>`; $("backBtn").onclick = goBack; }
  else { st.innerHTML = `<button class="iconbtn" id="menuBtn" aria-label="${t("القائمة")}">${ico("menu")}</button>`; $("menuBtn").onclick = openDrawer; }
  if (tab === "notes" && unread()) { end.innerHTML = `<button class="link" id="readAll">${t("قراءة الكل")}</button>`; $("readAll").onclick = markAllRead; }
  else if (tab === "home") { end.innerHTML = `<button class="iconbtn" id="searchBtn" aria-label="${t("بحث")}">${ico("search")}</button>`; $("searchBtn").onclick = searchBox; }
  else end.innerHTML = `<span class="sp"></span>`;
}
function renderNav() {
  const nav = $("nav"); if (!nav) return;
  const b = (k, i, l, n) => `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ""}>${n ? `<span class="badge">${num(n)}</span>` : ""}${ico(i)}<span>${t(l)}</span></button>`;
  nav.innerHTML = b("home", "home", "الرئيسية") + b("notes", "bell", "الإشعارات", unread()) + b("account", "user", "حسابي") + b("settings", "gear", "الإعدادات");
  nav.querySelectorAll("[data-tab]").forEach(x => x.onclick = () => go(x.dataset.tab));
}
const initial = u => esc(((u?.name || "").trim()[0]) || "؟");
const avatarHtml = (u, edit) => `<${edit ? 'button type="button"' : "div"} class="avatar${edit ? " edit" : ""}" ${edit ? `data-avatar aria-label="${t("صورة الحساب")}"` : ""}>${u?.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="">` : initial(u)}${edit ? `<span class="cam">${ico("camera")}</span>` : ""}</${edit ? "button" : "div"}>`;
const guestHtml = (icon, title, text) => `<div class="empty">${ico(icon)}<b>${title}</b><span>${text}</span><div class="w240 form"><button class="btn" id="toSignup">${t("إنشاء حساب")}</button><button class="btn ghost" id="toLogin">${t("لديّ حساب — تسجيل الدخول")}</button></div></div>`;
function renderDrawer() {
  const d = $("drawer"); if (!d) return;
  const name = me?.name || t("زائر"), sub = session ? loginId() : t("تصفح بدون حساب");
  d.innerHTML = `<button class="iconbtn" id="closeDrawer" aria-label="${t("إغلاق")}" style="color:inherit">${ico("x")}</button>
    <div class="who">${avatarHtml(me, !!session)}<b>${esc(name)}</b><span>${session ? `<bdi dir="ltr">${esc(sub)}</bdi>` : esc(sub)}</span></div>
    <nav>
      <button data-go="home">${ico("home")}<span>${t("الرئيسية")}</span></button>
      <button data-go="orders">${ico("orders")}<span>${t("الطلبات")}</span></button>
      <button data-go="mystore">${ico("store")}<span>${me?.is_provider ? t("خدمتي") : t("سجّل خدمتك")}</span></button>
      <button data-go="share">${ico("share")}<span>${t("شارك الموقع")}</span></button>
      <button data-go="contact">${ico("chat")}<span>${t("تواصل معنا")}</span></button>
      <button data-go="about">${ico("heart")}<span>${t("عن الموقع")}</span></button>
      ${isAdmin ? `<button data-go="admin">${ico("shield")}<span>${t("لوحة الإدارة")}</span></button>` : ""}
    </nav>
    <div class="foot"><button data-go="install">${t("أضف للشاشة الرئيسية")}</button>${session ? `<button id="logout">${t("تسجيل الخروج")}</button>` : `<button id="loginD">${t("حساب جديد / تسجيل الدخول")}</button>`}</div>`;
  d.querySelector("#closeDrawer").onclick = goBack;
  d.querySelectorAll("[data-go]").forEach(x => x.onclick = () => action(x.dataset.go));
  d.querySelector("#logout")?.addEventListener("click", () => { closeDrawer(); confirmBox(t("تسجيل الخروج"), t("يمكنك الدخول مرة أخرى برقم جوالك وكلمة المرور."), t("تسجيل الخروج"), logout); });
  d.querySelector("#loginD")?.addEventListener("click", () => go("account"));
  d.querySelector("[data-avatar]")?.addEventListener("click", avatarBox);
}
function openDrawer() { $("drawer").classList.add("on"); $("dscrim").classList.add("on"); sync(); }
function closeDrawer() { $("drawer")?.classList.remove("on"); $("dscrim")?.classList.remove("on"); }
function action(a) {
  closeDrawer();
  if (TITLES[a]) return go(a);
  if (a === "mystore") return providerSetup();
  if (a === "install") return installBox(false);
  if (a === "terms") return termsBox();
  if (a === "share") return shareBox();
  if (a === "lang") return langBox();
  sync();
}
async function logout() {
  cleanupRealtime(); pushLogout(); await sb.auth.signOut();
  session = null; me = null; notes = []; myReqs = []; inReqs = []; isAdmin = false;
  go("home"); toast(t("تم تسجيل الخروج"));
}

/* ===== الخريطة ===== */
function setTiles() {
  if (tiles) map.removeLayer(tiles);
  tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, className: isDark() ? "tiles-dark" : "", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
}
function initMap() {
  map = L.map("map", { zoomControl: false, attributionControl: true });
  map.setView(myPos || [24.7136, 46.6753], myPos ? 14 : 12);
  map.attributionControl.setPrefix(false);
  setTiles();
  markers = L.layerGroup().addTo(map);
}
function mkIcon(name, off, unv) { return L.divIcon({ className: "", html: `<div class="mk ${off ? "off" : ""} ${unv ? "unv" : ""}">${ico(name)}</div>`, iconSize: [40, 40], iconAnchor: [4, 40] }); }
function drawMarkers() {
  if (!markers) return;
  markers.clearLayers();
  shownProviders().forEach(p => {
    const first = filter || (p.services || []).find(s => svc(s).cat === cat) || p.services?.[0] || "wrench";
    L.marker([p.lat, p.lng], { icon: mkIcon(svc(first).icon, openNow(p.hours) === false, p.listing), title: p.name }).on("click", () => providerBox(p.id)).addTo(markers);
  });
}
let hiddenProv = store.get("hidden", []);
function shownProviders() {
  const list = providers.filter(p => p.lat != null && !hiddenProv.includes(p.id) && (!filter || (p.services || []).includes(filter)));
  const ref = myPos || (map ? [map.getCenter().lat, map.getCenter().lng] : [24.7, 46.7]);
  return list.map(p => ({ ...p, dist: dist(ref, [p.lat, p.lng]), open: openNow(p.hours) !== false }))
    .sort((a, b) => (b.open - a.open) || (a.dist - b.dist));
}
function dist(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const km = d => d < 1 ? t("{n} م", { n: num(Math.round(d * 1000)) }) : t("{n} كم", { n: num(d < 10 ? d.toFixed(1) : Math.round(d)) });
function locate(user) {
  if (!navigator.geolocation) { if (user) toast(t("المتصفح لا يدعم تحديد الموقع")); return; }
  navigator.geolocation.getCurrentPosition(p => {
    myPos = [p.coords.latitude, p.coords.longitude]; store.set("pos", myPos); placeMe();
    if (map) map.setView(myPos, 14); drawMarkers(); if (tab === "home") renderSheet();
  }, () => { if (user) toast(t("اسمح للموقع بالوصول لموقعك من إعدادات المتصفح")); }, { enableHighAccuracy: true, timeout: 10000 });
}
function placeMe() {
  if (!map || !myPos) return;
  if (meMarker) meMarker.setLatLng(myPos);
  else meMarker = L.marker(myPos, { icon: L.divIcon({ className: "", html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(map);
}

/* ===== قائمة الخدمات المنبثقة =====
   0 مغلقة ← 1 زرّا خدمات الطريق/المنزل ← 2 خدمات القسم ← (filter) مقدمو الخدمة */
function renderSheet() {
  const s = $("sheet"); if (!s) return;
  const chip = $("filterChip"), spacer = $("spacer");
  chip.hidden = !filter; spacer.hidden = !!filter;
  if (filter) {
    chip.innerHTML = `${ico(svc(filter).icon)}<span class="grow">${sName(filter)}</span><button class="x" id="clearF" aria-label="${t("إلغاء التصفية")}">${ico("x")}</button>`;
    chip.querySelector("#clearF").onclick = () => { filter = null; drawMarkers(); renderSheet(); };
  }
  const count = id => providers.filter(p => p.lat != null && (p.services || []).includes(id)).length;
  const cats = `<div class="cats">${CATS.map(c => `<button class="cat" data-cat="${c.id}" aria-pressed="${sheetState === 2 && cat === c.id}">${ico(c.icon)}<span>${t(c.name)}</span></button>`).join("")}</div>`;
  const join = `<button class="svc join" data-act="join"><span class="ic">${ico("store")}</span><span class="t"><b>${me?.is_provider ? t("إدارة خدمتي") : t("تقدّم خدمة؟ سجّلها مجاناً")}</b><span>${t("اظهر على الخريطة لمن يحتاجك")}</span></span>${ico("chev", "i flip")}</button>`;
  let body = "", sub;
  if (filter) {
    const list = shownProviders();
    sub = list.length ? t("{n} مقدم خدمة قريب منك", { n: num(list.length) }) : t("لا يوجد مقدم لهذه الخدمة بعد");
    body = `<button class="back" id="sBack">${ico("back", "i flip")}${t(CATS.find(c => c.id === svc(filter).cat).name)}</button>`
      + (list.length ? list.map(p => `<button class="svc" data-p="${p.id}"><span class="ic">${ico(svc(filter).icon)}</span><span class="t"><b>${esc(p.name)}${p.verified ? vMark() : ""}</b><span>${[esc(p.district || ""), km(p.dist)].filter(Boolean).join(" · ")}${p.listing ? " · " + t("غير موثّق") : ""}</span></span>${openNow(p.hours) === null ? "" : `<span class="n ${p.open ? "" : "off"}">${p.open ? t("متوفر") : t("غير متوفر")}</span>`}${ico("chev", "i flip")}</button>`).join("")
        : `<p class="none">${t("شارك الموقع مع من يقدّم هذه الخدمة ليسجّل ويظهر هنا.")}</p>`)
      + priceHint();
  } else if (sheetState === 1) { sub = t("اختر نوع الخدمة"); body = cats + join; }
  else if (sheetState === 2) {
    sub = t("اختر الخدمة التي تحتاجها");
    body = cats + SERVICES.filter(x => x.cat === cat).map(x => `<button class="svc" data-svc="${x.id}"><span class="ic">${ico(x.icon)}</span><span class="t"><b>${t(x.name)}</b><span>${t(x.desc)}</span></span><span class="n">${num(count(x.id))}</span>${ico("chev", "i flip")}</button>`).join("") + join;
  } else sub = t("اضغط لعرض الخدمات");
  s.innerHTML = `<div class="grip"></div><button class="head" id="sHead" aria-expanded="${sheetState > 0}">${t("الخدمات")}<small>${sub}</small></button><div class="body">${body}</div>`;
  s.classList.toggle("closed", sheetState === 0 && !filter);
  s.querySelector("#sHead").onclick = () => { if (sheetState === 0) sheetState = 1; else { sheetState = 0; filter = null; drawMarkers(); } renderSheet(); };
  s.querySelector("#sBack")?.addEventListener("click", () => { filter = null; drawMarkers(); renderSheet(); });
  s.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { cat = b.dataset.cat; store.set("cat", cat); sheetState = 2; drawMarkers(); renderSheet(); });
  s.querySelectorAll("[data-svc]").forEach(b => b.onclick = () => setFilter(b.dataset.svc));
  s.querySelectorAll("[data-p]").forEach(b => b.onclick = () => providerBox(b.dataset.p));
  s.querySelectorAll("[data-act]").forEach(b => b.onclick = () => providerSetup());
  let y0 = null;
  s.ontouchstart = e => y0 = e.touches[0].clientY;
  s.ontouchend = e => {
    if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (dy < -50 && sheetState === 0) { sheetState = 1; renderSheet(); }
    else if (dy > 60 && s.querySelector(".body").scrollTop <= 0 && (sheetState > 0 || filter)) { sheetState = 0; filter = null; drawMarkers(); renderSheet(); }
  };
  sync();
}
function setFilter(id) {
  filter = id; cat = svc(id).cat; if (sheetState < 2) sheetState = 2;
  drawMarkers(); renderSheet();
  const list = shownProviders();
  if (list.length && map) map.fitBounds(L.latLngBounds(list.slice(0, 10).map(p => [p.lat, p.lng]).concat(myPos ? [myPos] : [])), { padding: [60, 60], maxZoom: 15 });
}

/* ===== مقدم الخدمة ===== */
function providerBox(id) {
  const p = providers.find(x => x.id === id); if (!p) return;
  const d = myPos ? km(dist(myPos, [p.lat, p.lng])) : null;
  const self = session && session.user.id === p.id;
  modal(`<h3>${p.avatar_url ? `<img class="pav" src="${esc(p.avatar_url)}" alt="">` : ico("store")}${esc(p.name)}${p.verified ? vMark() : ""}</h3>
    ${p.listing ? `<p class="unvnote">${ico("info")}<span>${t("أضافته إدارة التطبيق من بيانات معلنة، ولم يؤكده صاحبه بعد.")}</span></p>` : ""}
    <p class="lead">${[esc(p.district || ""), d ? t("يبعد {d}", { d }) : ""].filter(Boolean).join(" · ")}</p>
    ${p.hours ? `<p class="meta">${ico("clock")}<span>${hoursText(p.hours)}</span>${openPill(p.hours)}</p>` : ""}
    ${p.price_note ? `<p class="meta">${ico("tag")}<span>${esc(p.price_note)}</span></p>` : ""}
    <div class="tags">${(p.services || []).map(s => `<span class="pill">${sName(s)}</span>`).join("")}</div>
    ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
    <div class="form">
      ${self ? `<button class="btn ghost" id="pEdit">${t("تعديل خدمتي")}</button>` : p.listing ? "" : `<button class="btn" id="pReq">${t("اطلب الخدمة")}</button>`}
      <div class="btns">
        <a class="btn wa sm" href="${waLink(intl(p.phone), t("السلام عليكم، وصلت لك من موقع {app}", { app: APP }))}" target="_blank" rel="noopener">${ico("wa")}${t("واتساب")}</a>
        <a class="btn ghost sm" href="tel:+${intl(p.phone)}">${ico("phone")}${t("اتصال")}</a>
      </div>
      ${priceHint()}
      ${p.listing ? `<button type="button" class="btn ghost sm" id="pClaim">${ico("shield")}${t("هل تملك هذا النشاط؟")}</button>
        <div class="linkrow"><a class="linkbtn" target="_blank" rel="noopener" href="${waLink(C.supportWhatsapp, t("السلام عليكم، أطلب إزالة نشاط «{name}» (رقم {id}) من {app}.", { name: p.name, id: p.id, app: APP }))}">${ico("trash")}${t("اطلب إزالة هذا النشاط")}</a><button type="button" class="linkbtn" id="pHide">${ico("eyeoff")}${t("إخفاء من الخريطة")}</button></div>`
      : self ? "" : `<div class="linkrow"><button type="button" class="linkbtn" id="pReport">${ico("flag")}${t("إبلاغ عن مقدم الخدمة")}</button><button type="button" class="linkbtn" id="pHide">${ico("eyeoff")}${t("إخفاء من الخريطة")}</button></div>`}
    </div>`, m => {
    m.querySelector("#pReport")?.addEventListener("click", () => {
      if (needLogin(t("سجّل دخولك لترسل البلاغ، حتى نتأكد أن البلاغات حقيقية."))) return;
      reportBox(p);
    });
    m.querySelector("#pHide")?.addEventListener("click", () => {
      if (!hiddenProv.includes(p.id)) hiddenProv.push(p.id);
      store.set("hidden", hiddenProv); m.remove(); drawMarkers(); renderSheet();
      toast(t("أخفينا مقدم الخدمة من خريطتك. تستطيع إظهاره من الإعدادات."));
    });
    m.querySelector("#pReq")?.addEventListener("click", () => {
      if (needLogin(t("سجّل حساباً مجانياً لترسل الطلب وتتابع حالته في الإشعارات. ويمكنك التواصل مع مقدم الخدمة مباشرة بدون حساب."), () => requestForm(p))) return;
      requestForm(p);
    });
    m.querySelector("#pEdit")?.addEventListener("click", () => providerSetup());
    m.querySelector("#pClaim")?.addEventListener("click", () => verifyBox(p));
  });
}
const REPORT_REASONS = ["معلومات أو رقم غير صحيح", "احتيال أو طلب مبالغ مقدماً", "سلوك أو ألفاظ مسيئة", "محتوى غير لائق", "لم يعد يقدّم الخدمة", "سبب آخر"];
function reportBox(p) {
  modal(`<h3>${ico("flag")}${t("إبلاغ عن {name}", { name: esc(p.name) })}</h3>
    <p class="lead">${t("يصل البلاغ لإدارة التطبيق وتتم مراجعته. لا يرى مقدم الخدمة اسمك.")}</p>
    <div class="form">
      <div class="reasons">${REPORT_REASONS.map((r, i) => `<label class="reason"><input type="radio" name="rr" value="${r}" ${i === 0 ? "checked" : ""}><span>${t(r)}</span></label>`).join("")}</div>
      <div class="in"><label for="rpDet">${t("تفاصيل")} <span class="opt">${t("(اختياري)")}</span></label><textarea id="rpDet" maxlength="300" rows="3" placeholder="${t("اكتب ما حدث باختصار")}"></textarea></div>
      <div class="err" id="rpErr" role="alert"></div>
      <button class="btn" id="rpSend">${ico("flag")}${t("إرسال البلاغ")}</button>
      <button class="btn ghost" data-close>${t("إلغاء")}</button>
    </div>`, m => {
    m.querySelector("#rpSend").onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      const reason = m.querySelector("input[name=rr]:checked").value;
      const details = m.querySelector("#rpDet").value.trim() || null;
      const { error } = await sb.from("reports").insert({ provider_id: p.id, reason, details });
      b.disabled = false;
      if (error && !/duplicate|unique/i.test(error.message)) { m.querySelector("#rpErr").textContent = t("تعذّر إرسال البلاغ، حاول مرة أخرى."); return; }
      m.remove();
      toast(error ? t("سبق أن أبلغت عن مقدم الخدمة هذا، وبلاغك قيد المراجعة.") : t("شكراً لك، وصل البلاغ وسنراجعه."));
    };
  });
}
/* ===== مراجعة البلاغات (للإدارة فقط) ===== */
async function adminReport(rid) {
  const { data, error } = await sb.rpc("admin_report", { rid });
  if (error || !data) { toast(t("هذا البلاغ متاح لإدارة التطبيق فقط.")); return; }
  const r = data.report, p = data.provider || {}, all = data.reports || [];
  const ST = { open: "قيد المراجعة", dismissed: "مغلق — لا مخالفة", actioned: "تم اتخاذ إجراء" };
  modal(`<h3>${ico("flag")}${t("بلاغ عن {name}", { name: esc(p.name || "—") })}</h3>
    <p class="lead">${fmtDate(r.created_at)} · ${t(ST[r.status] || r.status)}</p>
    <div class="repcard"><b>${t("السبب")}</b><span>${esc(t(r.reason))}</span>
      <b>${t("التفاصيل")}</b><span>${r.details ? esc(r.details) : `<i class="muted">${t("لم يكتب المُبلِّغ تفاصيل")}</i>`}</span>
      <b>${t("المُبلِّغ")}</b><span>${esc(data.reporter || "—")}</span>
      <b>${t("مقدم الخدمة")}</b><span>${esc(p.name || "")} · ${phoneHtml(p.phone || "")}${p.district ? " · " + esc(p.district) : ""}</span>
      <b>${t("الحالة على الخريطة")}</b><span>${p.suspended ? `<span class="pill off">${t("مخفي")}</span>` : `<span class="pill on">${t("ظاهر")}</span>`}</span>
    </div>
    ${all.length > 1 ? `<p class="small muted">${t("كل البلاغات عنه ({n}):", { n: all.length })}</p><ul class="replist">${all.map(x => `<li>${esc(t(x.reason))}${x.details ? " — " + esc(x.details) : ""} <span class="muted">(${t(ST[x.status] || x.status)})</span></li>`).join("")}</ul>` : ""}
    <div class="form">
      ${p.suspended ? `<button class="btn" id="arShow">${ico("check")}${t("إعادة إظهاره على الخريطة")}</button>` : `<button class="btn danger" id="arHide">${ico("eyeoff")}${t("إخفاؤه من الخريطة")}</button>`}
      ${r.status === "open" ? `<button class="btn ghost" id="arDismiss">${t("إغلاق البلاغ — لا توجد مخالفة")}</button>` : ""}
      ${p.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(intl(p.phone), t("السلام عليكم، معك إدارة {app} بخصوص بلاغ عن خدمتك.", { app: APP }))}">${ico("wa")}${t("تواصل معه واتساب")}</a>` : ""}
    </div>`, m => {
    const act = async (fn, args, msg) => {
      const { error } = await sb.rpc(fn, args);
      if (error) { toast(t("تعذّر تنفيذ الإجراء")); return; }
      m.remove(); toast(msg); loadProviders();
    };
    m.querySelector("#arHide")?.addEventListener("click", () => act("admin_set_suspended", { pid: p.id, val: true, rid }, t("أُخفي مقدم الخدمة من الخريطة")));
    m.querySelector("#arShow")?.addEventListener("click", () => act("admin_set_suspended", { pid: p.id, val: false, rid }, t("عاد مقدم الخدمة للظهور على الخريطة")));
    m.querySelector("#arDismiss")?.addEventListener("click", () => act("admin_close_report", { rid, st: "dismissed" }, t("أُغلق البلاغ")));
  });
}
function requestForm(p) {
  const first = (p.services || []).includes(filter) ? filter : p.services?.[0];
  const opts = (p.services || []).map(s => `<option value="${s}" ${s === first ? "selected" : ""}>${sName(s)}</option>`).join("");
  const a = askFor(first);
  modal(`<h3>${ico("orders")}${t("طلب من {name}", { name: esc(p.name) })}</h3><p class="lead">${t("يصل الطلب لمقدم الخدمة فوراً، وتتابع حالته في الإشعارات.")}</p>
    <form class="form" id="rForm" novalidate>
      <div class="in"><label for="rSvc">${t("الخدمة")}</label><select id="rSvc">${opts}</select></div>
      <div class="in"><label for="rLoc">${t("موقعك")}</label><input id="rLoc" value="${esc(store.get("addr", ""))}" placeholder="${t("الحي، الشارع، علامة قريبة")}">
        <label class="check"><input type="checkbox" id="rPos" ${myPos ? "checked" : ""}> ${t("أرفق موقعي على الخريطة")}</label></div>
      <div class="in"><label for="rCar" id="rCarL">${a.label}</label><input id="rCar" placeholder="${a.ph}"></div>
      <div class="in"><label for="rNote">${t("ملاحظات")} <span class="opt">${t("(اختياري)")}</span></label><input id="rNote" placeholder="${t("أي تفاصيل تساعد مقدم الخدمة")}"></div>
      ${priceHint()}
      <div class="err" id="rErr" role="alert"></div>
      <button class="btn" type="submit" id="rBtn">${t("أرسل الطلب")}</button>
    </form>`, m => {
    const sel = m.querySelector("#rSvc"), car = m.querySelector("#rCar");
    const fill = () => { const x = askFor(sel.value); m.querySelector("#rCarL").textContent = x.label; car.placeholder = x.ph; const s = svc(sel.value); car.value = s.cat === "road" && s.id !== "delivery" ? store.get("car", "") : ""; };
    sel.onchange = fill; fill();
    m.querySelector("#rForm").onsubmit = async e => {
      e.preventDefault();
      const q = s => m.querySelector(s), err = q("#rErr");
      const loc = q("#rLoc").value.trim(), det = car.value.trim(), sId = sel.value;
      if (!loc) return err.textContent = t("اكتب موقعك ليصلك مقدم الخدمة.");
      if (!det) return err.textContent = t("اكتب {what}.", { what: askFor(sId).label });
      const usePos = q("#rPos").checked;
      if (usePos && !myPos) { locate(true); return err.textContent = t("نحدد موقعك الآن… اضغط «أرسل» مرة أخرى بعد ثوانٍ."); }
      q("#rBtn").disabled = true;
      store.set("addr", loc); if (svc(sId).cat === "road" && sId !== "delivery") store.set("car", det);
      const row = { provider_id: p.id, service: sId, customer_name: me?.name, customer_phone: me?.phone, location: loc, car: det, note: q("#rNote").value.trim() || null,
        lat: usePos ? myPos[0] : null, lng: usePos ? myPos[1] : null };
      const { data, error } = await sb.from("requests").insert(row).select().single();
      if (error) { q("#rBtn").disabled = false; return err.textContent = t("تعذّر إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى."); }
      myReqs.unshift(data);
      modal(`<h3 class="okc">${ico("shield")}${t("وصل طلبك رقم {n}", { n: num(data.id) })}</h3>
        <p class="lead">${t("أُبلغ {name} بطلبك. سيصلك إشعار عند قبوله. للاستعجال راسله مباشرة:", { name: esc(p.name) })}</p>
        <div class="form"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(intl(p.phone), reqMsg(data))}">${ico("wa")}${t("أرسل التفاصيل على واتساب")}</a>
        <button class="btn ghost" data-close>${t("تم")}</button></div>`);
    };
  });
}
function reqMsg(r) {
  return [t("طلب #{n} — {app}", { n: r.id, app: APP }), t("الخدمة: ") + sName(r.service), t("الموقع: ") + r.location,
    r.lat ? `https://maps.google.com/?q=${r.lat},${r.lng}` : "", askFor(r.service).label + ": " + r.car, r.note ? t("ملاحظات: ") + r.note : "",
    t("الاسم: ") + (r.customer_name || ""), r.customer_phone ? t("الجوال: ") + phoneTxt(r.customer_phone) : ""].filter(Boolean).join("\n");
}

function providerSetup() {
  if (needLogin(t("سجّل حساباً مجانياً لتعرض خدمتك على الخريطة وتصلك الطلبات."), () => providerSetup(), "provider")) return;
  const p = me || {};
  const pos = (p.lat != null) ? [p.lat, p.lng] : (myPos || (map ? [map.getCenter().lat, map.getCenter().lng] : [24.7136, 46.6753]));
  const is24 = !p.hours || p.hours === "24";
  const [hf, ht] = is24 ? ["08:00", "22:00"] : p.hours.split("-");
  const group = c => `<div class="grp">${ico(c.icon)}${t(c.name)}</div><div class="checks">${SERVICES.filter(s => s.cat === c.id).map(s => `<label><input type="checkbox" name="sv" value="${s.id}" ${(p.services || []).includes(s.id) ? "checked" : ""}><span>${ico(s.icon)}${t(s.name)}</span></label>`).join("")}</div>`;
  modal(`<h3>${ico("store")}${p.is_provider ? t("خدمتي") : t("سجّل خدمتك")}</h3>
    <p class="lead">${t("تظهر للناس على الخريطة ويتواصلون معك على جوالك")} ${phoneHtml(p.phone)}</p>
    <form class="form" id="sForm" novalidate>
      <div class="in"><label>${t("الخدمات التي تقدّمها")}</label>${CATS.map(group).join("")}</div>
      <div class="in"><label for="sDist">${t("المدينة والحي")}</label><input id="sDist" value="${esc(p.district || "")}" placeholder="${t("مثال: الرياض — حي المونسية")}"></div>
      <div class="in"><label>${t("ساعات العمل")}</label>
        <div class="seg2"><label><input type="radio" name="hrs" value="24" ${is24 ? "checked" : ""}><span>${ico("clock")}${t("٢٤ ساعة")}</span></label><label><input type="radio" name="hrs" value="custom" ${is24 ? "" : "checked"}><span>${t("وقت محدد")}</span></label></div>
        <div class="timepair" id="sTimes" ${is24 ? "hidden" : ""}><label>${t("من")}<input type="time" id="sFrom" value="${hf}"></label><label>${t("إلى")}<input type="time" id="sTo" value="${ht}"></label></div></div>
      <div class="in"><label for="sBio">${t("نبذة")} <span class="opt">${t("(اختياري)")}</span></label><input id="sBio" maxlength="120" value="${esc(p.bio || "")}" placeholder="${t("مثال: سطحة هيدروليك، خبرة ١٠ سنوات")}"></div>
      <div class="in"><label for="sPrice">${t("السعر التقريبي")} <span class="opt">${t("(اختياري)")}</span></label><input id="sPrice" maxlength="60" value="${esc(p.price_note || "")}" placeholder="${t("مثال: يبدأ من ٥٠ ريال")}"><div class="hint">${t("السعر النهائي تتفق عليه مع العميل حسب الموقع ونوع العمل.")}</div></div>
      <div class="in"><label>${t("موقعك على الخريطة")}</label><div class="minimap"><div id="mini"></div><div class="center-pin">${ico("pin")}</div></div>
        <div class="hint">${t("حرّك الخريطة حتى يقع الدبوس على مكانك.")} <button type="button" class="textlink" id="sGps">${t("استخدم موقعي الحالي")}</button></div></div>
      ${p.is_provider ? `<div class="row boxed"><span class="t"><b>${t("ظاهر على الخريطة")}</b><span>${t("أطفئه عند عدم التوفر")}</span></span><button type="button" class="sw" role="switch" id="sActive" aria-checked="${p.active !== false}" aria-label="${t("ظاهر على الخريطة")}"></button></div>` : ""}
      <div class="err" id="sErr" role="alert"></div>
      <button class="btn" type="submit" id="sBtn">${p.is_provider ? t("حفظ") : t("اعرض خدمتي على الخريطة")}</button>
      ${p.is_provider ? `<button type="button" class="btn ghost danger-o" id="sStop">${t("إيقاف عرض خدمتي نهائياً")}</button>` : ""}
    </form>`, m => {
    const mini = L.map(m.querySelector("#mini"), { zoomControl: true, attributionControl: false }).setView(pos, 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: isDark() ? "tiles-dark" : "" }).addTo(mini);
    setTimeout(() => mini.invalidateSize(), 300);
    m.querySelectorAll("input[name=hrs]").forEach(r => r.onchange = () => m.querySelector("#sTimes").hidden = m.querySelector("input[name=hrs]:checked").value === "24");
    m.querySelector("#sGps").onclick = () => navigator.geolocation?.getCurrentPosition(g => { myPos = [g.coords.latitude, g.coords.longitude]; store.set("pos", myPos); mini.setView(myPos, 16); }, () => toast(t("اسمح للموقع بالوصول لموقعك من إعدادات المتصفح")));
    const act = m.querySelector("#sActive"); if (act) act.onclick = () => act.setAttribute("aria-checked", act.getAttribute("aria-checked") !== "true");
    m.querySelector("#sStop")?.addEventListener("click", async () => {
      await sb.from("profiles").update({ is_provider: false }).eq("id", me.id); me.is_provider = false;
      m.remove(); toast(t("أوقفنا عرض خدمتك")); loadProviders(); renderDrawer(); if (tab === "account") renderPage();
    });
    m.querySelector("#sForm").onsubmit = async e => {
      e.preventDefault();
      const q = s => m.querySelector(s), err = q("#sErr");
      const services = [...m.querySelectorAll("input[name=sv]:checked")].map(x => x.value);
      if (!services.length) return err.textContent = t("اختر خدمة واحدة على الأقل.");
      let hours = "24";
      if (q("input[name=hrs]:checked").value !== "24") {
        const f = q("#sFrom").value, to = q("#sTo").value;
        if (!f || !to || f === to) return err.textContent = t("حدد وقت البداية والنهاية لساعات العمل.");
        hours = f + "-" + to;
      }
      const c = mini.getCenter();
      const upd = { is_provider: true, services, hours, district: q("#sDist").value.trim() || null, bio: q("#sBio").value.trim() || null, price_note: q("#sPrice").value.trim() || null,
        lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), active: act ? act.getAttribute("aria-checked") === "true" : true, updated_at: new Date().toISOString() };
      q("#sBtn").disabled = true;
      const { error } = await sb.from("profiles").update(upd).eq("id", me.id);
      if (error) { q("#sBtn").disabled = false; return err.textContent = t("تعذّر الحفظ. حاول مرة أخرى."); }
      Object.assign(me, upd); m.remove();
      toast(upd.active ? t("خدمتك ظاهرة الآن على الخريطة") : t("تم الحفظ — خدمتك مخفية حالياً"));
      await loadProviders(); renderDrawer(); if (tab === "account") renderPage();
    };
  });
}

/* ===== الصفحات ===== */
const ST = { new: ["جديد", "new"], accepted: ["مقبول", ""], done: ["مكتمل", "done"], declined: ["معتذر", "bad"], cancelled: ["ملغي", "bad"] };
const stPill = s => `<span class="pill ${ST[s][1]}">${t(ST[s][0])}</span>`;
function renderPage() {
  const v = $("pageView"); if (!v || tab === "home") return;
  v.innerHTML = PAGES[tab]();
  v.querySelectorAll("[data-tab]").forEach(x => x.onclick = () => go(x.dataset.tab));
  v.querySelectorAll("[data-go]").forEach(x => x.onclick = () => action(x.dataset.go));
  v.querySelectorAll("[data-copy]").forEach(x => x.onclick = () => copy(x.dataset.copy));
  v.querySelector("#toSignup")?.addEventListener("click", () => openAuth("signup"));
  v.querySelector("#toLogin")?.addEventListener("click", () => openAuth("login"));
  v.querySelector("[data-avatar]")?.addEventListener("click", avatarBox);
  v.querySelector("#verifyMe")?.addEventListener("click", () => verifyBox(null));
  (BIND[tab] || (() => {}))(v);
}
const copyRow = (l, v) => `<div class="copyrow"><span class="t"><span>${l}</span><bdi dir="ltr">${esc(v)}</bdi></span><button data-copy="${esc(v)}">${ico("copy")}${t("نسخ")}</button></div>`;
const PAGES = {
  notes() {
    if (!session) return guestHtml("bell", t("سجّل لتصلك الإشعارات"), t("أنشئ حساباً مجاناً لتصلك إشعارات طلباتك فوراً، حتى والجوال مقفل."));
    if (!notes.length) return `<div class="empty">${ico("bell")}<b>${t("لا توجد إشعارات بعد")}</b><span>${t("ستظهر هنا الطلبات الجديدة وتحديثاتها")}</span></div>`;
    return `<p class="swipehint">${t("اسحب الإشعار يميناً أو يساراً، أو اضغط عليه مطوّلاً لحذفه")}</p>
    <div class="list">${notes.map(n => `<div class="swipe" data-nid="${n.id}"><button class="sdel l" aria-label="${t("حذف")}">${ico("trash")}</button><button class="sdel r" aria-label="${t("حذف")}">${ico("trash")}</button><button class="row ${n.read ? "" : "unread"}" data-req="${n.request_id || ""}" data-rep="${n.report_id || ""}" data-kind="${n.kind || ""}"><span class="ic">${ico("bell")}</span><span class="t"><b>${esc(noteTitle(n))}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}</span><span class="end">${fmtDate(n.created_at)}</span></button></div>`).join("")}</div>
    <div class="center"><button class="linkbtn" id="clearNotes">${ico("trash")}${t("مسح كل الإشعارات")}</button></div>`;
  },
  orders() {
    if (!session) return guestHtml("orders", t("سجّل لتتابع طلباتك"), t("أنشئ حساباً مجاناً لتطلب الخدمة من داخل الموقع وتتابع حالة طلباتك."));
    const isP = me?.is_provider || inReqs.length;
    const list = ordersTab === "in" ? inReqs : myReqs, nNew = inReqs.filter(r => r.status === "new").length;
    const tabs = isP ? `<div class="tabs" role="tablist"><button role="tab" data-ot="mine" aria-selected="${ordersTab === "mine"}">${t("طلباتي")}</button><button role="tab" data-ot="in" aria-selected="${ordersTab === "in"}">${t("الواردة")}${nNew ? " (" + num(nNew) + ")" : ""}</button></div>` : "";
    if (!list.length) return tabs + `<div class="empty">${ico("orders")}<b>${ordersTab === "in" ? t("لا توجد طلبات واردة بعد") : t("لا توجد طلبات بعد")}</b><span>${ordersTab === "in" ? t("تأكد أن خدمتك ظاهرة على الخريطة") : t("اختر خدمة من الرئيسية واطلبها من أقرب مقدم")}</span>${ordersTab === "in" ? "" : `<div class="w200"><button class="btn" data-tab="home">${t("اطلب خدمة")}</button></div>`}</div>`;
    return tabs + `<div class="list">${list.map(r => `<button class="row" data-req="${r.id}"><span class="ic">${ico(svc(r.service).icon)}</span><span class="t"><b>${sName(r.service)} ${stPill(r.status)}</b><span>#${num(r.id)} · ${ordersTab === "in" ? esc(r.customer_name || "") + " · " : ""}${fmtDate(r.created_at)}</span></span>${ico("chev", "i flip")}</button>`).join("")}</div>`;
  },
  account() {
    if (!session) return guestHtml("user", t("أنت تتصفح بدون حساب"), t("تصفح الخدمات وتواصل مع مقدميها بدون حساب. سجّل مجاناً لتطلب من داخل الموقع أو تعرض خدمتك."));
    const u = me || {};
    return `<div class="hero">${avatarHtml(u, true)}<h2>${esc(u.name)}</h2><div class="ph">${phoneHtml(u.phone)}</div></div>
      <div class="stats">
        <button class="stat" data-go="mystore">${ico("store")}<span>${t("العضوية")}</span><b>${u.is_provider ? t("مقدم خدمة") : t("عميل")}</b></button>
        <button class="stat" data-tab="orders">${ico("orders")}<span>${t("الطلبات")}</span><b>${num(myReqs.length + inReqs.length)}</b></button>
        <button class="stat" data-tab="notes">${ico("bell")}<span>${t("الإشعارات")}</span><b>${num(unread())}</b></button>
      </div>
      <div class="field"><label>${t("الاسم")}</label><div class="v">${ico("user")}<span>${esc(u.name)}</span></div></div>
      <div class="field"><label>${t("الجوال")}</label><div class="v">${ico("phone")}<span>${phoneHtml(u.phone)}</span></div></div>
      <div class="field"><label>${isPhoneAcct() ? t("رقم الدخول") : t("البريد الإلكتروني")}</label><div class="v">${ico(isPhoneAcct() ? "phone" : "mail")}<span dir="ltr">${esc(loginId())}</span></div></div>
      <div class="pad form">
        <div class="card brand"><b>${u.is_provider ? (u.active !== false ? t("خدمتك ظاهرة على الخريطة") : t("خدمتك مخفية حالياً")) : t("تقدّم خدمة؟")}</b><span class="muted">${u.is_provider ? (u.services || []).map(sName).join(t("، ")) + (u.hours ? " · " + hoursText(u.hours) : "") : t("سجّلها مجاناً وتظهر لمن يحتاجها قريباً منك.")}</span><button class="btn sm" data-go="mystore">${u.is_provider ? t("إدارة خدمتي") : t("سجّل خدمتك")}</button>
          ${u.is_provider ? (u.verified ? `<span class="pill done vpill">${ico("shield")}${t("حسابك موثّق")}</span>` : `<button class="btn ghost sm" id="verifyMe">${ico("shield")}${t("وثّق رقمك واحصل على علامة موثّق")}</button>`) : ""}</div>
        <button class="btn ghost" id="editProfile">${t("تعديل بياناتي")}</button>
      </div>`;
  },
  settings() {
    const th = { system: "تلقائي", light: "فاتح", dark: "داكن" }[theme];
    return `<div class="list">
      <button class="row" data-go="lang"><span class="ic">${ico("lang")}</span><span class="t"><b>${t("اللغة")}</b></span><span class="end accent">${EN ? "English" : "العربية"}</span>${ico("chev", "i flip")}</button>
      <div class="row"><span class="ic">${ico("bell")}</span><span class="t"><b>${t("الإشعارات")}</b><span>${t("تصلك حتى والجوال مقفل")}</span></span><button class="sw" role="switch" aria-checked="${pushOn()}" id="notifySw" aria-label="${t("الإشعارات")}"></button></div>
      <button class="row" id="themeBtn"><span class="ic">${ico("moon")}</span><span class="t"><b>${t("المظهر")}</b></span><span class="end">${t(th)}</span></button>
      <button class="row" data-go="install"><span class="ic">${ico("plus")}</span><span class="t"><b>${t("أضف للشاشة الرئيسية")}</b><span>${t("افتح الموقع كتطبيق بضغطة")}</span></span>${ico("chev", "i flip")}</button>
      <button class="row" data-go="share"><span class="ic">${ico("share")}</span><span class="t"><b>${t("شارك الموقع")}</b><span>${t("أرسل نبذة ورابط الموقع لمن تعرف")}</span></span>${ico("chev", "i flip")}</button>
      ${hiddenProv.length ? `<button class="row" id="unhideBtn"><span class="ic">${ico("eyeoff")}</span><span class="t"><b>${t("إظهار من أخفيتهم")}</b><span>${t("{n} مقدم خدمة مخفي من خريطتك", { n: hiddenProv.length })}</span></span>${ico("chev", "i flip")}</button>` : ""}
      <button class="row" data-go="terms"><span class="ic">${ico("shield")}</span><span class="t"><b>${t("الشروط والأحكام")}</b></span>${ico("chev", "i flip")}</button>
      <button class="row" data-tab="contact"><span class="ic">${ico("chat")}</span><span class="t"><b>${t("تواصل معنا")}</b></span>${ico("chev", "i flip")}</button>
      ${session ? `<button class="row" id="delBtn"><span class="ic dangerc">${ico("trash")}</span><span class="t"><b class="dangerc">${t("حذف الحساب")}</b></span>${ico("chev", "i flip")}</button>` : ""}
    </div>`;
  },
  contact() {
    const w = C.supportWhatsapp, ph = C.supportPhone, e = C.supportEmail;
    return `<div class="pad form">
      <p class="muted m0">${t("نسعد بتواصلك للاستفسار أو الاقتراح أو الإبلاغ عن مشكلة. واتساب أسرع وسيلة.")}</p>
      ${w ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(w, t("السلام عليكم، لدي استفسار عن {app}", { app: APP }))}">${ico("wa")}${t("راسلنا على واتساب")}</a>` : ""}
      <div class="btns">${ph ? `<a class="btn ghost sm" href="tel:+${intl(ph)}">${ico("phone")}${t("اتصال")}</a>` : ""}${e ? `<a class="btn ghost sm" href="mailto:${esc(e)}">${ico("mail")}${t("البريد")}</a>` : ""}</div>
      ${ph ? copyRow(t("الجوال"), phoneTxt(ph)) : ""}${e ? copyRow(t("البريد الإلكتروني"), e) : ""}
    </div>`;
  },
  about() {
    return `<div class="pad prose"><div class="brandmark mb"><img class="logoimg" src="icon-192.png" alt=""><div><h1>${APP}</h1><p>${TAG}</p></div></div>
      <p>${t("«{app}» يجمع مقدمي الخدمات على خريطة واحدة في كل مدن المملكة: خدمات الطريق مثل التوصيل والبطارية والوقود والإطار والسطحة، وخدمات المنزل مثل السباكة والكهرباء والتكييف والتنظيف.", { app: APP })}</p>
      <h4>${t("إذا كنت تحتاج خدمة")}</h4><p>${t("اختر الخدمة وسترى أقرب مقدميها. اطلب من داخل الموقع، أو تواصل معه مباشرة بالاتصال أو واتساب.")}</p>
      <h4>${t("إذا كنت تقدّم خدمة")}</h4><p>${t("سجّل برقم جوالك، ثم «سجّل خدمتك» وحدد مكانك وساعات عملك. تصلك الطلبات في الإشعارات.")}</p>
      <h4>${t("السعر")}</h4><p>${t("السعر يُتفق عليه مباشرة مع مقدم الخدمة حسب الموقع والمسافة ونوع العمل. الموقع لا يأخذ أي عمولة.")}</p>
      <p class="muted">${t("الإصدار {v}", { v: num("2.1") })}</p></div>`;
  }
};
const BIND = {
  notes(v) {
    v.querySelectorAll("[data-req]").forEach(b => b.onclick = () => {
      const w = b.closest(".swipe"); if (w && w.className.includes("open")) { w.className = "swipe"; return; }
      const r = +b.dataset.rep, id = +b.dataset.req; if (r) adminReport(r); else if (id) reqDetails(id);
      else if (b.dataset.kind === "verify" && isAdmin) { adminTab = "verify"; go("admin"); }
    });
    v.querySelectorAll(".swipe").forEach(w => {
      const row = w.querySelector(".row"); let x0 = null, y0 = 0, dx = 0, lp = null;
      const closeOthers = () => v.querySelectorAll(".swipe.open-l,.swipe.open-r").forEach(o => { if (o !== w) o.className = "swipe"; });
      row.addEventListener("touchstart", e => {
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; row.style.transition = "none";
        lp = setTimeout(() => { lp = null; x0 = null; row.style.transition = ""; row.style.transform = ""; closeOthers(); w.className = "swipe open-r"; navigator.vibrate?.(15); }, 550);
      }, { passive: true });
      row.addEventListener("touchmove", e => {
        if (x0 == null) return;
        dx = e.touches[0].clientX - x0; const dy = e.touches[0].clientY - y0;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { clearTimeout(lp); lp = null; }
        if (Math.abs(dy) > Math.abs(dx)) return;
        row.style.transform = `translateX(${Math.max(-110, Math.min(110, dx))}px)`;
      }, { passive: true });
      row.addEventListener("touchend", () => {
        clearTimeout(lp); lp = null; if (x0 == null) return; x0 = null;
        row.style.transition = ""; row.style.transform = "";
        if (dx > 60) { closeOthers(); w.className = "swipe open-r"; } else if (dx < -60) { closeOthers(); w.className = "swipe open-l"; }
      });
      row.addEventListener("contextmenu", e => { e.preventDefault(); closeOthers(); w.className = "swipe open-r"; });
      w.querySelectorAll(".sdel").forEach(d => d.onclick = () => deleteNote(+w.dataset.nid, w));
    });
    v.querySelector("#clearNotes")?.addEventListener("click", () => confirmBox(t("مسح كل الإشعارات؟"), t("ستُحذف كل إشعاراتك نهائياً، ولن تتأثر طلباتك."), t("مسح الكل"), async () => {
      const { error } = await sb.from("notifications").delete().eq("user_id", session.user.id);
      if (error) return toast(t("تعذّر الحذف، حاول مرة أخرى."));
      notes = []; renderNav(); renderTop(); renderPage(); toast(t("تم مسح الإشعارات"));
    }, true));
    if (unread()) setTimeout(markAllRead, 1500);
  },
  orders(v) {
    v.querySelectorAll("[data-ot]").forEach(b => b.onclick = () => { ordersTab = b.dataset.ot; renderPage(); });
    v.querySelectorAll("[data-req]").forEach(b => b.onclick = () => reqDetails(+b.dataset.req));
  },
  account(v) {
    v.querySelector("#editProfile")?.addEventListener("click", editProfile);
  },
  settings(v) {
    v.querySelector("#unhideBtn")?.addEventListener("click", () => { hiddenProv = []; store.set("hidden", []); drawMarkers(); renderPage(); toast(t("ظهر الجميع على الخريطة من جديد")); });
    // يعكس الحالة الفعلية للاشتراك في OneSignal (وليس إذن المتصفح فقط)
    OS(async OneSignal => { try { const s = v.querySelector("#notifySw"); if (s) s.setAttribute("aria-checked", pushOn() && !!OneSignal.User.PushSubscription.optedIn); } catch (x) {} });
    v.querySelector("#notifySw").onclick = async e => {
      const sw = e.currentTarget;
      if (sw.getAttribute("aria-checked") !== "true") {
        if (!session) { needLogin(t("سجّل دخولك لتصلك إشعارات طلباتك.")); return; }
        const ok = await enablePush();
        notifyOn = ok; store.set("notify", ok); sw.setAttribute("aria-checked", ok);
        if (ok) toast(t("الإشعارات مفعّلة"));
      } else {
        notifyOn = false; store.set("notify", false); sw.setAttribute("aria-checked", false);
        OS(async OneSignal => { try { await OneSignal.User.PushSubscription.optOut(); } catch (x) {} });
        toast(t("الإشعارات متوقفة"));
      }
    };
    v.querySelector("#themeBtn").onclick = () => { theme = { system: "light", light: "dark", dark: "system" }[theme]; store.set("theme", theme); applyTheme(); renderPage(); };
    v.querySelector("#delBtn")?.addEventListener("click", () => confirmBox(t("حذف الحساب"), t("سيُحذف حسابك وخدمتك وطلباتك وإشعاراتك نهائياً، ولا يمكن التراجع."), t("احذف حسابي نهائياً"), async () => {
      if (me?.avatar_url) await sb.storage.from("avatars").remove([`${session.user.id}/avatar.jpg`]).catch(() => {});
      const { error } = await sb.rpc("delete_my_account");
      if (error) return toast(t("تعذّر الحذف الآن، حاول لاحقاً"));
      await logout(); toast(t("حُذف حسابك"));
    }, true));
  }
};
async function markAllRead() {
  if (!session || !unread()) return;
  notes.forEach(n => n.read = true); renderNav(); renderTop(); if (tab === "notes") renderPage();
  await sb.from("notifications").update({ read: true }).eq("user_id", session.user.id).eq("read", false);
}

function reqDetails(id) {
  const r = myReqs.concat(inReqs).find(x => x.id === id); if (!r) { loadRequests(); return toast(t("لم نجد الطلب")); }
  const asP = session && r.provider_id === session.user.id;
  const prov = providers.find(p => p.id === r.provider_id);
  const otherPhone = asP ? r.customer_phone : prov?.phone;
  modal(`<h3>${ico(svc(r.service).icon)}${sName(r.service)} ${stPill(r.status)}</h3>
    <p class="lead">${t("طلب #{n}", { n: num(r.id) })} · ${fmtDate(r.created_at)}</p>
    <div class="kv">
      ${asP ? `<div class="r"><span>${t("العميل")}</span>${esc(r.customer_name)}</div>` : `<div class="r"><span>${t("مقدم الخدمة")}</span>${esc(prov?.name || "—")}</div>`}
      <div class="r"><span>${t("الموقع")}</span>${esc(r.location)}${r.lat ? ` · <a class="textlink" target="_blank" rel="noopener" href="https://maps.google.com/?q=${r.lat},${r.lng}">${t("افتح في الخرائط")}</a>` : ""}</div>
      <div class="r"><span>${askFor(r.service).label}</span>${esc(r.car)}</div>
      ${r.note ? `<div class="r"><span>${t("ملاحظات")}</span>${esc(r.note)}</div>` : ""}
    </div>
    <div class="form">
      ${otherPhone ? `<div class="btns"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(intl(otherPhone), asP ? t("السلام عليكم، بخصوص طلبك #{n} في {app}", { n: r.id, app: APP }) : reqMsg(r))}">${ico("wa")}${t("واتساب")}</a><a class="btn ghost sm" href="tel:+${intl(otherPhone)}">${ico("phone")}${t("اتصال")}</a></div>` : ""}
      ${asP && r.status === "new" ? `<div class="btns"><button class="btn" data-st="accepted">${t("قبول الطلب")}</button><button class="btn ghost danger-o" data-st="declined">${t("اعتذار")}</button></div>` : ""}
      ${asP && r.status === "accepted" ? `<button class="btn" data-st="done">${t("تم تنفيذ الخدمة")}</button>` : ""}
      ${!asP && ["new", "accepted"].includes(r.status) ? `<button class="btn ghost danger-o" data-st="cancelled">${t("إلغاء الطلب")}</button>` : ""}
      ${priceHint()}
    </div>`, m => {
    m.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb.from("requests").update({ status: b.dataset.st }).eq("id", r.id);
      if (error) { b.disabled = false; return toast(t("تعذّر التحديث، حاول مرة أخرى")); }
      r.status = b.dataset.st; m.remove(); toast(t("تم تحديث الطلب")); renderPage();
    });
  });
}
function editProfile() {
  const u = me;
  modal(`<h3>${ico("user")}${t("تعديل بياناتي")}</h3><form class="form" id="eForm" novalidate>
    <div class="in"><label for="eName">${t("الاسم")}</label><input id="eName" value="${esc(u.name)}"></div>
    <div class="in"><label for="ePhone">${t("رقم الجوال للتواصل")}</label><div class="phone"><span>+966</span><input id="ePhone" inputmode="numeric" maxlength="10" value="${esc(String(u.phone || "").replace(/^966/, ""))}" ${isPhoneAcct() ? "disabled" : ""}></div>${isPhoneAcct() ? `<div class="hint">${t("رقمك هو اسم الدخول. لتغييره تواصل معنا.")}</div>` : ""}</div>
    ${isPhoneAcct() ? "" : `<div class="in"><label>${t("البريد الإلكتروني")}</label><input value="${esc(session.user.email)}" class="ltr" disabled></div>`}
    <div class="err" id="eErr" role="alert"></div><button class="btn" type="submit">${t("حفظ")}</button></form>`, m => {
    m.querySelector("#eForm").onsubmit = async e => {
      e.preventDefault();
      const name = m.querySelector("#eName").value.trim(), phone = toEn(m.querySelector("#ePhone").value).replace(/\D/g, "").replace(/^0/, ""), err = m.querySelector("#eErr");
      if (name.length < 2) return err.textContent = t("اكتب اسمك.");
      if (!/^5\d{8}$/.test(phone)) return err.textContent = t("رقم الجوال يبدأ بـ 5 ويتكون من ٩ أرقام.");
      const { error } = await sb.from("profiles").update({ name, phone }).eq("id", me.id);
      if (error) return err.textContent = t("تعذّر الحفظ. حاول مرة أخرى.");
      Object.assign(me, { name, phone }); m.remove(); renderPage(); renderDrawer(); toast(t("حُفظت بياناتك"));
    };
  });
}

/* ===== نوافذ عامة ===== */
/* صورة الحساب: تُصغَّر على الجهاز (٣٢٠×٣٢٠) قبل الرفع */
function avatarBox() {
  if (!session) return;
  const has = !!me?.avatar_url;
  modal(`<h3>${ico("camera")}${t("صورة الحساب")}</h3>
    <div class="center avbig">${avatarHtml(me)}</div>
    <div class="form">
      <label class="btn">${ico("camera")}${has ? t("تغيير الصورة") : t("إضافة صورة")}<input type="file" id="avFile" accept="image/*" hidden></label>
      ${has ? `<button class="btn ghost dangerc" id="avDel">${ico("trash")}${t("حذف الصورة")}</button>` : ""}
      <p class="err" id="avErr"></p>
    </div>`, m => {
    const err = m.querySelector("#avErr");
    m.querySelector("#avFile").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      err.className = "err ok"; err.textContent = t("لحظة…");
      try {
        const blob = await squareImage(f, 320);
        const path = `${session.user.id}/avatar.jpg`;
        const up = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (up.error) throw up.error;
        const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
        const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
        if (error) throw error;
        me.avatar_url = url; afterAvatar(); toast(t("تم تحديث صورتك"));
      } catch (x) { err.className = "err"; err.textContent = t("تعذّر رفع الصورة، جرّب صورة أخرى."); }
    };
    m.querySelector("#avDel")?.addEventListener("click", async () => {
      await sb.storage.from("avatars").remove([`${session.user.id}/avatar.jpg`]).catch(() => {});
      const { error } = await sb.from("profiles").update({ avatar_url: null }).eq("id", session.user.id);
      if (error) { err.className = "err"; err.textContent = t("تعذّر الحذف، حاول مرة أخرى."); return; }
      me.avatar_url = null; afterAvatar(); toast(t("حُذفت الصورة"));
    });
  });
}
function afterAvatar() {
  goBack(); renderDrawer(); if (tab === "account") renderPage();
  const p = providers.find(x => x.id === session?.user.id); if (p) p.avatar_url = me.avatar_url;
}
function squareImage(file, size) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error("blob")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
/* ===== المطالبة بالنشاط والتوثيق ===== */
const vMark = () => `<span class="vmark" title="${t("موثّق")}">${ico("check")}</span>`;
function claimFromUrl() {
  const tok = new URLSearchParams(location.search).get("claim");
  if (tok) { store.set("claim", tok); history.replaceState(history.state, "", location.pathname); }
}
async function processClaim() {
  const tok = store.get("claim", null); if (!tok) return;
  const { data: info } = await sb.rpc("claim_info", { tok });
  if (!info || !["new", "sent"].includes(info.status)) {
    store.set("claim", null);
    toast(info ? t("هذا النشاط تمت المطالبة به من قبل.") : t("رابط المطالبة غير صحيح."));
    return;
  }
  if (!session) {
    openAuth("signup", { why: t("أنشئ حسابك برقم {p} لتستلم نشاط «{name}» وتديره بنفسك.", { p: "0" + info.phone, name: info.name }), role: "provider", phone: info.phone, name: info.name });
    return;
  }
  const { data } = await sb.rpc("claim_listing", { tok });
  if (data?.ok) {
    store.set("claim", null); await loadMe(); loadProviders(); renderDrawer();
    modal(`<h3 class="okc">${ico("shield")}${t("أصبح النشاط باسمك ✓")}</h3>
      <p class="lead">${t("نشاط «{name}» مرتبط الآن بحسابك ويظهر بعلامة «موثّق». راجع بياناته وعدّل ما تريد.", { name: esc(info.name) })}</p>
      <div class="form"><button class="btn" id="cEdit">${t("راجع بيانات خدمتك")}</button><button class="btn ghost" data-close>${t("لاحقاً")}</button></div>`,
      m => m.querySelector("#cEdit").onclick = () => providerSetup());
  } else if (data?.reason === "phone") {
    modal(`<h3>${ico("info")}${t("الرابط خاص برقم آخر")}</h3>
      <p class="lead">${t("هذا الرابط لنشاط مسجّل برقم {p}. سجّل خروجك ثم ادخل أو أنشئ حساباً بذلك الرقم.", { p: phoneHtml(data.phone) })}</p>
      <div class="form"><button class="btn" id="cOut">${t("تسجيل الخروج")}</button><button class="btn ghost" id="cCancel">${t("إلغاء")}</button></div>`, m => {
      m.querySelector("#cOut").onclick = async () => { m.remove(); await logout(); processClaim(); };
      m.querySelector("#cCancel").onclick = () => { store.set("claim", null); goBack(); };
    });
  }
}
async function verifyBox(p) {
  if (needLogin(p ? t("سجّل دخولك أولاً لتثبت ملكيتك للنشاط.") : t("سجّل دخولك أولاً."), () => verifyBox(p), "provider")) return;
  const { data: code, error } = await sb.rpc("request_verify", { lid: p ? p.lid : null });
  if (error || !code) return toast(t("تعذّر إنشاء الرمز، حاول لاحقاً"));
  const target = p ? p.phone : me?.phone;
  const msg = p ? t("طلب ملكية نشاط «{name}» (رقم {id}) في {app}.\nرمز التحقق: {code}", { name: p.name, id: p.id, app: APP, code })
    : t("طلب توثيق رقمي في {app}.\nالاسم: {name}\nرمز التحقق: {code}", { name: me?.name || "", app: APP, code });
  modal(`<h3>${ico("shield")}${p ? t("إثبات ملكية النشاط") : t("توثيق رقمك")}</h3>
    <p class="lead">${t("أرسل هذا الرمز عبر واتساب من الرقم {p}، لنتأكد أنه رقمك ونعتمد طلبك.", { p: phoneHtml(target || "") })}</p>
    <div class="codebig" dir="ltr">${num(code)}</div>
    <div class="form"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(C.supportWhatsapp, msg)}">${ico("wa")}${t("أرسل الرمز عبر واتساب")}</a>
    <button class="btn ghost" data-close>${t("لاحقاً")}</button></div>
    <p class="small muted center">${t("يجب أن تُرسل الرسالة من نفس الرقم، وإلا لن يُعتمد الطلب. يصلك إشعار عند الاعتماد.")}</p>`);
}
function modal(html, after) {
  app.querySelector(".modal")?.remove();
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><div class="mhead"><div class="grip"></div><button class="mclose" data-close aria-label="${t("إغلاق")}">${ico("x")}</button></div>${html}</div>`;
  m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) goBack(); };
  app.appendChild(m); after && after(m); return m;
}
async function deleteNote(id, el) {
  el?.classList.add("gone");
  const { error } = await sb.from("notifications").delete().eq("id", id);
  if (error) { el?.classList.remove("gone"); return toast(t("تعذّر الحذف، حاول مرة أخرى.")); }
  setTimeout(() => { notes = notes.filter(n => n.id !== id); renderNav(); renderTop(); if (tab === "notes") renderPage(); }, 220);
}
function confirmBox(title, body, label, fn, danger) {
  modal(`<h3>${title}</h3><p class="lead">${body}</p><div class="form"><button class="btn ${danger ? "danger" : ""}" id="okBtn">${label}</button><button class="btn ghost" data-close>${t("إلغاء")}</button></div>`,
    m => m.querySelector("#okBtn").onclick = () => { m.remove(); fn(); });
}
function termsBox() {
  modal(`<h3>${ico("shield")}${t("الشروط والأحكام")}</h3><div class="prose">
    <h4>${t("دور الموقع")}</h4><p>${t("«{app}» منصة تعرض مقدمي الخدمات وتوصلك بهم. الاتفاق على السعر والوقت وتنفيذ الخدمة بينك وبين مقدم الخدمة مباشرة، ولا يأخذ الموقع أي عمولة.", { app: APP })}</p>
    <h4>${t("مقدمو الخدمة")}</h4><p>${t("يلتزم مقدم الخدمة بصحة بياناته وموقعه وساعات عمله، وبإخفاء خدمته عند عدم توفره.")}</p>
    <h4>${t("البلاغات")}</h4><p>${t("تستطيع الإبلاغ عن أي مقدم خدمة من صفحته، أو إخفاءه من خريطتك. نراجع البلاغات، ويُخفى مقدم الخدمة تلقائياً عند تكرار البلاغات عنه حتى تتم مراجعته.")}</p>
    <h4>${t("الخصوصية")}</h4><p>${t("نحفظ بريدك واسمك وجوالك. جوال مقدم الخدمة ظاهر للجميع للتواصل. جوالك كعميل يظهر فقط لمقدم الخدمة الذي تطلب منه.")}</p>
    <h4>${t("حذف الحساب")}</h4><p>${t("تستطيع حذف حسابك وكل بياناتك من الإعدادات في أي وقت.")}</p>
    <p><a href="privacy.html" target="_blank" rel="noopener">${t("سياسة الخصوصية كاملة")}</a> · <a href="delete-account.html" target="_blank" rel="noopener">${t("حذف الحساب")}</a></p></div><br><button class="btn" data-close>${t("فهمت")}</button>`);
}
function installBox(auto) {
  const ios = isIOS(), android = /android/i.test(navigator.userAgent);
  const steps = ios
    ? `<ol class="steps"><li>${t("اضغط زر المشاركة")} <span class="kbd">${ico("share")}</span> ${t("أسفل الشاشة في Safari")}</li><li>${t("اختر «إضافة إلى الشاشة الرئيسية»")}</li><li>${t("اضغط «إضافة»")}</li></ol>`
    : android && !deferredInstall
      ? `<ol class="steps"><li>${t("اضغط النقاط الثلاث ⋮ أعلى المتصفح")}</li><li>${t("اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»")}</li></ol>`
      : deferredInstall ? "" : `<ol class="steps"><li>${t("في Chrome أو Edge اضغط أيقونة التثبيت في شريط العنوان")}</li></ol>`;
  modal(`<div class="installhead"><img class="logoimg" src="icon-192.png" alt=""><div><h3>${t("ثبّت «{app}» على جوالك", { app: APP })}</h3><p class="lead m0">${t("مساعدتك على الطريق وفي البيت، على بُعد لمسة.")}</p></div></div>
    <ul class="perks"><li>${ico("bolt")}<span>${t("يفتح فوراً من الشاشة الرئيسية مثل أي تطبيق")}</span></li><li>${ico("bell")}<span>${t("إشعار فوري بطلبك حتى والجوال مقفل")}</span></li><li>${ico("sparkle")}<span>${t("مجاني وخفيف، لا يحتاج متجراً ولا مساحة")}</span></li></ul>
    ${steps}
    <div class="form">${deferredInstall ? `<button class="btn" id="doInstall">${ico("plus")}${t("ثبّت التطبيق الآن")}</button>` : ""}
    <button class="btn ghost" data-close>${auto ? t("ليس الآن") : t("تم")}</button></div>`, m => {
    m.classList.add("installbox");
    m.querySelector("#doInstall")?.addEventListener("click", async () => {
      const ev = deferredInstall; deferredInstall = null;
      ev.prompt(); const r = await ev.userChoice.catch(() => null);
      if (r && r.outcome === "accepted") { store.set("installed", true); m.remove(); }
    });
  });
}
/* يطلب الإضافة للشاشة الرئيسية عند كل فتح، إلا إذا كان مضافاً */
async function alreadyInstalled() {
  if (isStandalone()) { store.set("installed", true); return true; }
  try { if (navigator.getInstalledRelatedApps) { const r = await navigator.getInstalledRelatedApps(); return r.length > 0; } } catch (e) {}
  return store.get("installed", false);
}
async function maybeInstallPrompt() {
  if (await alreadyInstalled()) { setTimeout(maybePushPrompt, 1500); return; }
  setTimeout(() => { if (!app.querySelector(".modal") && !app.querySelector(".authlayer")) installBox(true); }, 1800);
}

/* ===== الإشعارات الفورية (OneSignal) ===== */
const OS = fn => { window.OneSignalDeferred = window.OneSignalDeferred || []; window.OneSignalDeferred.push(fn); };
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pushSupported = () => "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
const pushOn = () => notifyOn && pushSupported() && Notification.permission === "granted";
function pushLogin() {
  if (!session) return;
  OS(async OneSignal => {
    try {
      await OneSignal.login(session.user.id);
      // إصلاح تلقائي: إذا كان الإذن ممنوحاً والمستخدم لم يُطفئ الإشعارات بنفسه، نعيد اشتراك الجهاز
      if (notifyOn && Notification.permission === "granted" && !OneSignal.User.PushSubscription.optedIn) await OneSignal.User.PushSubscription.optIn();
    } catch (e) {}
  });
}
function pushLogout() { OS(async OneSignal => { try { await OneSignal.logout(); } catch (e) {} }); }
function enablePush() {
  if (!pushSupported()) {
    toast(isIOS() && !isStandalone() ? t("على الآيفون: أضف التطبيق للشاشة الرئيسية أولاً، ثم فعّل الإشعارات من داخله.") : t("هذا المتصفح لا يدعم الإشعارات."));
    return Promise.resolve(false);
  }
  if (Notification.permission === "denied") { toast(t("الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح.")); return Promise.resolve(false); }
  return new Promise(res => {
    const done = setTimeout(() => res(Notification.permission === "granted"), 15000);
    OS(async OneSignal => {
      try {
        await OneSignal.Notifications.requestPermission();
        if (Notification.permission === "granted") { await OneSignal.User.PushSubscription.optIn(); pushLogin(); }
      } catch (e) {}
      clearTimeout(done); res(Notification.permission === "granted");
    });
  });
}
let pushAsked = false;
function maybePushPrompt() {
  if (pushAsked || !session || !pushSupported() || Notification.permission !== "default") return;
  if (app.querySelector(".modal") || app.querySelector(".authlayer")) return;
  pushAsked = true;
  modal(`<h3>${ico("bell")}${t("فعّل الإشعارات")}</h3><p class="lead">${t("ليصلك الطلب الجديد وتحديثات طلباتك فوراً، حتى والجوال مقفل.")}</p>
    <div class="form"><button class="btn" id="pushYes">${ico("bell")}${t("فعّل الإشعارات")}</button><button class="btn ghost" data-close>${t("لاحقاً")}</button></div>`, m => {
    m.querySelector("#pushYes").onclick = async () => { const ok = await enablePush(); notifyOn = ok; store.set("notify", ok); m.remove(); if (ok) toast(t("الإشعارات مفعّلة")); };
  });
}
function shareText() {
  const url = location.origin + location.pathname;
  return [t("{app} — كل خدماتك في مكان واحد", { app: APP }), "",
    t("اطلب خدمة أو اعرض خدمتك في أي مدينة بالمملكة:"),
    t("• خدمات الطريق: توصيل، بطارية، بنزين، تبديل إطار، سطحة"),
    t("• خدمات المنزل: سباكة، كهرباء، تكييف، تنظيف وغيرها"), "",
    t("مقدمو الخدمة على الخريطة قريبون منك، وتتواصل معهم مباشرة بالاتصال أو واتساب."),
    t("مجاني ويفتح من الرابط بدون تحميل:"), url].join("\n");
}
function shareBox() {
  const txt = shareText();
  modal(`<h3>${ico("share")}${t("شارك الموقع")}</h3><p class="lead">${t("هذه الرسالة التي ستُرسل:")}</p>
    <div class="sharecard">${esc(txt).replace(/\n/g, "<br>")}</div>
    <div class="form">
      <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">${ico("wa")}${t("شارك عبر واتساب")}</a>
      <div class="btns">${navigator.share ? `<button class="btn ghost sm" id="nShare">${ico("share")}${t("تطبيقات أخرى")}</button>` : ""}<button class="btn ghost sm" id="cShare">${ico("copy")}${t("نسخ النص")}</button></div>
    </div>`, m => {
    m.querySelector("#cShare").onclick = () => copy(txt);
    m.querySelector("#nShare")?.addEventListener("click", async () => { try { await navigator.share({ title: APP, text: txt }); } catch (e) {} });
  });
}
function langBox() {
  modal(`<h3>${ico("lang")}${t("اللغة")}</h3><div class="list rounded">
    <button class="row" data-l="ar"><span class="t"><b>العربية</b></span>${!EN ? `<span class="pill">✓</span>` : ""}</button>
    <button class="row" data-l="en"><span class="t"><b>English</b></span>${EN ? `<span class="pill">✓</span>` : ""}</button></div>`, m => {
    m.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { if (b.dataset.l === LANG) return goBack(); store.set("lang", b.dataset.l); location.replace(location.pathname); });
  });
}
function searchBox() {
  modal(`<h3>${ico("search")}${t("ابحث")}</h3><div class="in sbox"><input id="q" placeholder="${t("خدمة أو اسم مقدم خدمة أو حي")}"></div><div class="list rounded" id="qr"></div>`, m => {
    const q = m.querySelector("#q"), out = m.querySelector("#qr");
    const syn = { "سطح": "tow", "ونش": "tow", "وقود": "fuel", "بنزين": "fuel", "ديزل": "fuel", "كفر": "tire", "بنشر": "tire", "بطار": "battery", "مفتاح": "lock", "ميكانيك": "check",
      "توصيل": "delivery", "سباك": "plumbing", "موي": "plumbing", "ماء": "plumbing", "كهرب": "electric", "مكيف": "ac", "تكييف": "ac", "فريون": "ac",
      "نظاف": "cleaning", "تنظيف": "cleaning", "عفش": "moving", "اثاث": "moving", "أثاث": "moving", "دهان": "paint", "صبغ": "paint", "نجار": "carpentry", "حشرات": "pest", "رش": "pest" };
    const draw = () => {
      const v = q.value.trim(), vl = v.toLowerCase();
      const hit = s => !v || (t(s.name) + " " + t(s.desc)).toLowerCase().includes(vl) || (s.name + s.desc).includes(v) || Object.entries(syn).some(([k, id]) => v.includes(k) && id === s.id);
      const ss = SERVICES.filter(hit);
      const ps = v ? providers.filter(p => (p.name + " " + (p.district || "")).toLowerCase().includes(vl)) : [];
      out.innerHTML = ss.map(s => `<button class="row" data-s="${s.id}"><span class="ic">${ico(s.icon)}</span><span class="t"><b>${t(s.name)}</b><span>${t(s.desc)}</span></span></button>`).join("")
        + ps.map(p => `<button class="row" data-p="${p.id}"><span class="ic">${ico("store")}</span><span class="t"><b>${esc(p.name)}</b><span>${esc(p.district || "")}</span></span></button>`).join("")
        || `<p class="muted center">${t("لا توجد نتائج.")}</p>`;
      out.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { m.remove(); if (tab !== "home") go("home"); setFilter(b.dataset.s); });
      out.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { const p = providers.find(x => x.id === b.dataset.p); if (p && map) map.setView([p.lat, p.lng], 16); providerBox(b.dataset.p); });
    };
    q.oninput = draw; draw(); setTimeout(() => q.focus(), 60);
  });
}
function newPasswordBox() {
  modal(`<h3>${ico("shield")}${t("كلمة مرور جديدة")}</h3><form class="form" id="npForm" novalidate><div class="in"><label for="np">${t("كلمة المرور الجديدة")}</label><input id="np" type="password" class="ltr" autocomplete="new-password" placeholder="${t("٦ أحرف أو أرقام على الأقل")}"></div><div class="err" id="npErr"></div><button class="btn" type="submit">${t("حفظ")}</button></form>`, m => {
    m.querySelector("#npForm").onsubmit = async e => {
      e.preventDefault(); const v = m.querySelector("#np").value;
      if (v.length < 6) return m.querySelector("#npErr").textContent = t("كلمة المرور ٦ أحرف أو أرقام على الأقل.");
      const { error } = await sb.auth.updateUser({ password: v });
      if (error) return m.querySelector("#npErr").textContent = t("تعذّر الحفظ، اطلب رابطاً جديداً.");
      m.remove(); toast(t("تم تغيير كلمة المرور")); await afterLogin();
    };
  });
}
function copy(txt) {
  const ok = () => toast(t("تم النسخ"));
  try { navigator.clipboard.writeText(txt).then(ok, () => fallbackCopy(txt)); } catch (e) { fallbackCopy(txt); }
}
function fallbackCopy(txt) { const a = document.createElement("textarea"); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); toast(t("تم النسخ")); } catch (e) { toast(txt); } a.remove(); }
function toast(msg) { const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); }

addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; if (app.querySelector(".installbox")) installBox(true); });
addEventListener("appinstalled", () => { store.set("installed", true); deferredInstall = null; app.querySelector(".installbox")?.remove(); toast(t("تمت إضافة التطبيق للشاشة الرئيسية")); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => theme === "system" && applyTheme());

boot().catch(e => { console.error(e); toast(t("تعذّر الاتصال. تحقق من الإنترنت ثم أعد فتح الصفحة.")); });
