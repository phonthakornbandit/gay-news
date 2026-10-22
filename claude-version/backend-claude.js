/* =================== หลังบ้านสำหรับ claude.ai: Claude + ที่เก็บข้อมูลของหน้า + Parallel Search =================== */
(() => {
const U = { user: "jo", prefs: null };

const DEFAULT_PREFS = { name:"", topics:["เศรษฐกิจ","ไอที"], customTopics:[], length:"mid", period:"1d", theme:"auto", uiLang:"th", sumLang:"th", newsCount:20, fontSize:"m", styles:{ news:"", recommend:"", story:"", video:"" } };
let DB = null, SAMPLE = null;
const MEM = {};
const caps = (async () => {
  try { DB = await window.claude?.use?.("db"); } catch(e){ DB = null; }
  try { SAMPLE = await window.claude?.use?.("sample"); } catch(e){ SAMPLE = null; }
})();
function h32(s){ let x = 5381; for (const c of String(s)) x = ((x << 5) + x + c.codePointAt(0)) >>> 0; return x.toString(36); }
const P = (k) => `gn/${U.user}/${k}`;
async function dget(path, fb){
  await caps;
  if (DB){ try { const s = await DB.doc(path).get(); if (s.exists){ const d = s.data(); return d && "v" in d ? d.v : fb; } return fb; } catch(e){ return MEM[path] ?? fb; } }
  return MEM[path] ?? fb;
}
async function dset(path, v){
  MEM[path] = v; await caps;
  if (DB){ try { await DB.doc(path).set({ v }); } catch(e){ console.warn("db write failed", e); } }
}
async function ddel(path){ delete MEM[path]; await caps; if (DB){ try { await DB.doc(path).delete(); } catch(e){} } }
const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, n);
function fitBytes(s, max){
  const enc = new TextEncoder(); s = String(s || "");
  if (enc.encode(s).length <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi){ const m = (lo + hi + 1) >> 1; if (enc.encode(s.slice(0, m)).length <= max) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + "\n…(ตัดส่วนที่เกินออก)";
}
function langLine(p){ return p.sumLang === "en" ? "Write every text value in English." : "เขียนข้อความทั้งหมดเป็นภาษาไทย"; }
function styleLine(p, k){ const s = clip(p.styles && p.styles[k], 1500); return s ? `\n\nสไตล์เพิ่มเติมที่ผู้ใช้กำหนด (ใช้กับน้ำเสียงและการเรียบเรียงเท่านั้น ห้ามเปลี่ยนรูปแบบ JSON):\n${s}` : ""; }
async function ai(prompt, tier){
  await caps;
  if (!SAMPLE) throw new Error("ต้องเปิดหน้านี้ใน claude.ai เพื่อใช้ Claude");
  try { return await SAMPLE.json(fitBytes(prompt, 60000), { modelTier: tier || "default" }); }
  catch(e){
    const c = e && e.code;
    if (c === "not_granted") throw new Error("ยังไม่ได้อนุญาตให้หน้านี้ใช้ Claude กดลองใหม่แล้วกดอนุญาต");
    if (c === "rate_limited") throw new Error("ใช้ Claude ถี่เกินไป รอสักครู่แล้วลองใหม่");
    if (c === "prompt_too_large") throw new Error("ข้อความยาวเกินไป ลองวางทีละส่วน");
    if (c === "invalid_json") throw new Error("Claude ตอบกลับไม่ครบ กดลองใหม่อีกครั้ง หรือวางข้อความให้สั้นลง");
    throw new Error((e && e.message) || "เรียก Claude ไม่สำเร็จ");
  }
}
let MCP = null;
const mcpP = (async () => { try { MCP = await window.claude?.use?.("mcp"); } catch(e){ MCP = null; } })();
const SEARCH_SERVER = "Parallel Search";
const SID = "gay-news-artifact-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function todayTh(){ const d = new Date(); return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }
function monthTh(){ const d = new Date(); return `${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }
const PERIOD_TH = { "1d": "24 ชั่วโมงที่ผ่านมา", "3d": "3 วันที่ผ่านมา", "7d": "7 วันที่ผ่านมา" };
function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./, ""); } catch(e){ return ""; } }
async function webSearch(objective, queries){
  await mcpP;
  if (!MCP) throw new Error("หน้านี้ค้นเว็บไม่ได้ในตอนนี้ (ต้องเปิดใน claude.ai และเชื่อม Parallel Search ใน Settings › Connectors)");
  try {
    const r = await MCP.callTool(SEARCH_SERVER, "web_search", { objective, search_queries: queries.slice(0, 3), session_id: SID, model_name: "claude-artifact-gay-news" }, { cache: { staleTime: 300000 } });
    const pl = r && r.payload;
    const res = (pl && Array.isArray(pl.results)) ? pl.results : [];
    return res.map(x => ({ title: clip(x.title, 200), url: String(x.url || ""), date: clip(x.publish_date || "", 30), text: clip((x.excerpts || []).join(" "), 1500) }))
      .filter(x => /^https?:\/\//.test(x.url));
  } catch(e){
    const c = e && e.code;
    if (c === "server_not_connected" || c === "server_not_found") throw new Error("ยังไม่ได้เชื่อม Parallel Search: ไปที่ claude.ai › Settings › Connectors แล้วเพิ่ม Parallel Search");
    if (c === "not_in_manifest") throw new Error("ยังไม่ได้อนุญาตให้หน้านี้ใช้ Parallel Search เปิดหน้านี้ใหม่แล้วกดอนุญาต");
    if (c === "needs_reauth") throw new Error("Parallel Search ต้องเชื่อมใหม่: claude.ai › Settings › Connectors");
    if (c === "selection_required") throw new Error("มี Parallel Search มากกว่า 1 ตัว ให้เลือกตัวที่จะใช้ในหน้าต่างที่ขึ้นมา");
    if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed") throw new Error("หน้านี้ค้นเว็บไม่ได้ในตอนนี้ (ต้องเปิดใน claude.ai และเชื่อม Parallel Search ใน Settings › Connectors)");
    if (c === "tool_error") throw new Error("Parallel Search ตอบกลับผิดพลาด: " + (e.message || ""));
    throw new Error("ค้นข่าวไม่สำเร็จชั่วคราว ลองใหม่อีกครั้ง");
  }
}
function freshEnough(x, period){
  const t = Date.parse(x.date); if (!x.date || !t) return true;
  const days = { "1d": 1.5, "3d": 3.5, "7d": 7.5 }[period] || 8;
  return Date.now() - t <= days * 86400e3;
}
// ---- อ่านฟีดข่าว (Bing News / Google News RSS) ผ่าน Parallel web_fetch ----
const FEED_PERIOD = { "1d": { bing: "7", g: "1d" }, "3d": { bing: "8", g: "3d" }, "7d": { bing: "8", g: "7d" } };
function parseFeedMarkdown(md, kind){
  const out = [];
  for (const block of String(md || "").split(/\n-{3,}\s*\n/)){
    const t = block.match(/^##\s+(.+)$/m), m = block.match(/Published:\s*([^\n·]+?)\s*·\s*Link:\s*(\S+)/);
    if (!t || !m) continue;
    let title = t[1].trim(), link = m[2].trim(), source = "";
    if (kind === "bing"){ try { const real = new URL(link).searchParams.get("url"); if (real) link = real; } catch(e){} source = hostOf(link); }
    else { const k = title.lastIndexOf(" - "); if (k > 0){ source = title.slice(k + 3).trim(); title = title.slice(0, k).trim(); } }
    if (!/^https?:\/\//.test(link)) continue;
    const text = block.slice(block.indexOf(m[0]) + m[0].length).replace(/&nbsp;/g, " ").replace(/-{3,}\s*$/, "").replace(/\s+/g, " ").trim();
    out.push({ title: clip(title, 220), url: link, date: m[1].trim(), source: clip(source, 60), text: clip(text, 600) });
  }
  return out;
}
async function fetchFeed(url, kind){
  await mcpP;
  if (!MCP) throw new Error("หน้านี้ดึงข่าวไม่ได้ในตอนนี้ (ต้องเปิดใน claude.ai และเชื่อม Parallel Search ใน Settings › Connectors)");
  try {
    const r = await MCP.callTool(SEARCH_SERVER, "web_fetch", { urls: [url], objective: "รายการหัวข่าวล่าสุด พร้อมลิงก์ วันที่ และชื่อสำนักข่าว", full_content: true, session_id: SID, model_name: "claude-artifact-gay-news" }, { cache: { staleTime: 300000 } });
    const pl = r && r.payload, res = pl && Array.isArray(pl.results) ? pl.results[0] : null;
    return parseFeedMarkdown(res && (res.full_content || (res.excerpts || []).join("\n---\n")), kind).slice(0, 25);
  } catch(e){ return mcpError(e); }
}
function mcpError(e){
  const c = e && e.code;
  if (c === "server_not_connected" || c === "server_not_found") throw new Error("ยังไม่ได้เชื่อม Parallel Search: ไปที่ claude.ai › Settings › Connectors แล้วเพิ่ม Parallel Search");
  if (c === "not_in_manifest") throw new Error("ยังไม่ได้อนุญาตให้หน้านี้ใช้ Parallel Search เปิดหน้านี้ใหม่แล้วกดอนุญาต");
  if (c === "needs_reauth") throw new Error("Parallel Search ต้องเชื่อมใหม่: claude.ai › Settings › Connectors");
  if (c === "selection_required") throw new Error("มี Parallel Search มากกว่า 1 ตัว ให้เลือกตัวที่จะใช้ในหน้าต่างที่ขึ้นมา");
  if (c === "tool_error") throw new Error("Parallel Search ตอบกลับผิดพลาด: " + (e.message || ""));
  throw new Error("ดึงข่าวไม่สำเร็จชั่วคราว ลองใหม่อีกครั้ง");
}
async function newsForTerm(t, period){
  const P2 = FEED_PERIOD[period] || FEED_PERIOD["1d"];
  const bing = `https://www.bing.com/news/search?q=${encodeURIComponent(t)}&format=rss&setmkt=th-TH&setlang=th-TH&qft=${encodeURIComponent(`interval="${P2.bing}"`)}`;
  const goog = `https://news.google.com/rss/search?q=${encodeURIComponent(`${t} when:${P2.g}`)}&hl=th&gl=TH&ceid=TH:th`;
  let items = [];
  try { items = await fetchFeed(bing, "bing"); } catch(e){ if (/เชื่อม|อนุญาต|ดึงข่าวไม่ได้/.test(e.message)) throw e; }
  if (items.length < 4){ try { items = items.concat(await fetchFeed(goog, "google")); } catch(e){ if (!items.length) throw e; } }
  if (!items.length){ // ทางสุดท้าย: ค้นเว็บทั่วไป
    items = (await webSearch(`ข่าวล่าสุดเกี่ยวกับ "${t}" (วันนี้คือ ${todayTh()})`, [`ข่าว ${t} ล่าสุด`, `${t} ${monthTh()}`])).map(x => ({ ...x, source: hostOf(x.url) }));
  }
  return items.map(x => ({ ...x, topic: t }));
}
async function searchNews(terms, period){
  let firstErr = null;
  const lists = await Promise.all(terms.slice(0, 6).map(t => newsForTerm(t, period).catch(e => { firstErr = firstErr || e; return []; })));
  const seen = new Set(), out = [];
  for (const list of lists) for (const x of list){
    const k = x.title.slice(0, 50);
    if (seen.has(x.url) || seen.has(k) || !freshEnough(x, period)) continue;
    seen.add(x.url); seen.add(k); out.push(x);
  }
  if (!out.length && firstErr) throw firstErr;
  return out;
}
function resultsToText(list){
  return list.map((x, i) => `[${i + 1}] ${x.title}\nหัวข้อที่ค้น: ${x.topic || "-"}\nURL: ${x.url}\nวันที่เผยแพร่: ${x.date || "ไม่ระบุ"}\nสำนัก: ${x.source || hostOf(x.url)}\n${x.text}`).join("\n\n");
}
const LENGTH_RULE = { short:"points มี 1 ข้อ สั้นมาก", mid:"points มี 2-3 ข้อ", long:"points มี 4-5 ข้อ แต่ละข้ออธิบายให้เข้าใจ" };

async function api(path, data = {}){
  const p = U.prefs || DEFAULT_PREFS;
  switch (path){
    case "/login": {
      const saved = await dget(P("prefs"), {});
      return { prefs: { ...DEFAULT_PREFS, ...saved, styles: { ...DEFAULT_PREFS.styles, ...(saved.styles || {}) } } };
    }
    case "/prefs/save": await dset(P("prefs"), data.prefs); return { prefs: data.prefs };
    case "/news": {
      let text = String(data.text || "").trim();
      let topics = (data.topics || []).slice(0, 12);
      const period = ["1d","3d","7d"].includes(data.period) ? data.period : "1d";
      let fromSearch = false;
      if (!text || (text.length < 60 && !/https?:\/\//.test(text) && !text.includes("\n"))){
        const terms = text ? [text] : topics;
        if (!terms.length) throw new Error("เลือกหัวข้อ หรือพิมพ์คำค้นก่อน");
        if (text) topics = [text, ...topics];
        const found = await searchNews(terms, period);
        if (!found.length) throw new Error("ไม่พบข่าวใหม่ในช่วงเวลานี้ ลองเลือกช่วงเวลาให้ยาวขึ้น หรือเปลี่ยนคำค้น");
        text = resultsToText(found.slice(0, 40));
        fromSearch = true;
      }
      const total = [10,20,30].includes(Number(p.newsCount)) ? Number(p.newsCount) : 20;
      const prompt = `คุณคือบรรณาธิการข่าวที่เป็นกลาง ผู้ใช้วางข้อความด้านล่าง ซึ่งอาจมีข่าวหลายชิ้น หัวข่าว ลิงก์ หรือโพสต์ปนกัน
งานของคุณ: แยกเป็นข่าวทีละเรื่อง (สูงสุด ${total} เรื่อง) รวมข่าวซ้ำเรื่องเดียวกันเป็นเรื่องเดียว แล้วสรุปแต่ละเรื่อง
ใช้เฉพาะข้อมูลในข้อความที่วาง ห้ามแต่งข้อเท็จจริง ตัวเลข ชื่อ หรือวันที่ที่ไม่มีในข้อความ${fromSearch ? `
ข้อความนี้เป็นรายการข่าวจากฟีดข่าว (กรองช่วงเวลาแล้ว) วันนี้คือ ${todayTh()} — ตัดเฉพาะรายการที่ไม่ใช่ข่าว (เช่น โพสต์โฆษณา หน้ารวมแท็ก) ห้ามตัดข่าวทิ้งทั้งหมด
link ให้ใช้ URL ของรายการนั้น source ให้ใช้ชื่อสำนักที่ระบุ date ให้ใช้วันที่เผยแพร่` : ""}
หัวข้อที่ผู้ใช้สนใจ: ${topics.join(", ") || "-"} — ใส่ topic เป็นหนึ่งในหัวข้อนี้ ถ้าไม่เข้ากับหัวข้อไหนให้ใส่ "อื่นๆ"
${langLine(p)}
ตอบเป็น JSON เท่านั้น:
{"overview":"ภาพรวมข่าวทั้งหมด 2-3 ประโยค",
 "items":[{"topic":"...","headline":"หัวข่าวเรียบเรียงใหม่ เป็นกลาง ไม่เรียกคลิก","points":["..."],"category":"หมวดสั้นๆ","tone":"บวก|กลาง|ลบ","source":"ชื่อสำนักถ้ามีในข้อความ ไม่มีให้เว้นว่าง","link":"URL ถ้ามีในข้อความ ไม่มีให้เว้นว่าง","date":"วันที่ถ้ามีในข้อความ"}]}
กติกา: ${LENGTH_RULE[data.length] || LENGTH_RULE.mid}${styleLine(p, "news")}

ข้อความที่ผู้ใช้วาง:
<<<
${fitBytes(text, 48000)}
>>>`;
      const r = await ai(prompt, "default");
      const items = (Array.isArray(r.items) ? r.items : []).slice(0, total).map((x, i) => ({
        id: i, topic: clip(x.topic || "อื่นๆ", 40), headline: clip(x.headline, 220),
        points: (Array.isArray(x.points) ? x.points : []).map(s => clip(s, 400)).slice(0, 6),
        category: clip(x.category || x.topic, 30), tone: ["บวก","กลาง","ลบ"].includes(x.tone) ? x.tone : "กลาง",
        source: clip(x.source || hostOf(x.link), 60), link: /^https?:\/\//.test(x.link || "") ? x.link : "", date: clip(x.date, 60), sources: 1,
      })).filter(x => x.headline);
      if (!items.length) throw new Error(fromSearch ? "ไม่พบข่าวใหม่ที่ตรงกับช่วงเวลานี้ ลองเลือกช่วงเวลาให้ยาวขึ้น" : "ไม่พบข่าวในข้อความที่วาง");
      const out = { overview: clip(r.overview, 800), items, created: new Date().toISOString() };
      await dset(P("feed"), out);
      return out;
    }
    case "/edition": {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date || "") ? data.date : "";
      const slot = data.slot === "pm" ? "pm" : "am";
      const key = P("ed_" + date + "_" + slot);
      if (!data.refresh){ const saved = await dget(key, null); if (saved) return saved; if (!data.current) throw new Error("ไม่มีฉบับนี้ในคลัง"); }
      const feed = await api("/news", { topics: p.topics, period: "1d", length: p.length });
      const out = { ...feed, date, slot, created: new Date().toISOString() };
      await dset(key, out);
      const list = (await dget(P("edlist"), [])).filter(x => x.key !== date + ":" + slot);
      list.unshift({ key: date + ":" + slot, created: out.created, count: out.items.length });
      await dset(P("edlist"), list.slice(0, 30));
      for (const old of list.slice(30)) await ddel(P("ed_" + old.key.replace(":", "_")));
      return out;
    }
    case "/edition/list": return { editions: await dget(P("edlist"), []) };
    case "/feed/last": return await dget(P("feed"), null);
    case "/follow/list": return { follows: await dget(P("follows"), []) };
    case "/follow/add": {
      const q = clip(data.q, 60); if (!q) throw new Error("พิมพ์ชื่อเรื่องก่อน");
      const list = await dget(P("follows"), []);
      if (!list.some(f => f.q === q)) list.unshift({ q, added: new Date().toISOString() });
      await dset(P("follows"), list.slice(0, 30));
      if (data.seed){ const key = P("story_" + h32(q)); const st = await dget(key, { q, texts: [], result: null }); st.texts.push({ text: clip(data.seed, 8000), added: new Date().toISOString() }); await dset(key, st); }
      return { follows: list.slice(0, 30) };
    }
    case "/follow/remove": {
      const list = (await dget(P("follows"), [])).filter(f => f.q !== data.q);
      await dset(P("follows"), list); await ddel(P("story_" + h32(data.q)));
      return { follows: list };
    }
    case "/story": {
      const key = P("story_" + h32(data.q));
      const st = await dget(key, { q: data.q, texts: [], result: null });
      if (data.add){ st.texts.push({ text: clip(data.add, 8000), added: new Date().toISOString() }); st.texts = st.texts.slice(-15); }
      if (!data.add && (data.refresh || !st.texts.length)){
        try {
          const found = await searchNews([data.q], "7d");
          const seen = new Set(st.urls || []);
          const fresh = found.filter(x => !seen.has(x.url)).slice(0, 12);
          if (fresh.length){
            st.texts.push({ text: resultsToText(fresh), added: new Date().toISOString() });
            st.urls = [...seen, ...fresh.map(x => x.url)].slice(-300);
            st.texts = st.texts.slice(-15);
            st.result = null;
          }
        } catch(e){ if (!st.texts.length) throw e; }
      }
      if (!st.texts.length) return { empty: true };
      if (st.result && !data.add && !data.refresh) return st.result;
      const prompt = `คุณคือนักข่าวที่เป็นกลาง ด้านล่างคือข่าวทั้งหมดที่ผู้ใช้รวบรวมไว้ของเรื่อง "${data.q}" (เรียงตามลำดับที่เพิ่ม)
วันนี้คือ ${todayTh()} บางชิ้นเป็นผลค้นหาเว็บ ให้ข้ามหน้าที่ไม่ใช่ข่าวและข่าวที่ไม่เกี่ยวกับเรื่องนี้
รวมเป็นเรื่องเดียว ใช้เฉพาะข้อมูลที่ให้มา ถ้าไม่มีข้อมูลส่วนใดให้ใส่ "ยังไม่มีข้อมูล" ห้ามเดา
ถ้าแต่ละแหล่งรายงานตัวเลขหรือข้อเท็จจริงไม่ตรงกัน ให้ใส่ใน conflicts ${langLine(p)}
ตอบเป็น JSON เท่านั้น:
{"title":"ชื่อเรื่อง","status":"กำลังพัฒนา|คลี่คลาย|จบแล้ว",
 "w":{"who":"","what":"","where":"","when":"","why":"","how":""},
 "story":"เล่าเรื่อง 2-3 ย่อหน้า ภาษาง่าย","analogy":"ตัวอย่างเปรียบเทียบให้เข้าใจง่าย",
 "timeline":[{"when":"วันที่/เวลา","what":"เกิดอะไรขึ้น","sources":["ชื่อสำนักถ้ามี"]}],
 "sides":[{"name":"ฝ่าย","stance":"จุดยืน"}],"conflicts":["..."],"watch":["สิ่งที่ต้องจับตาต่อ"],
 "sources":[{"title":"หัวข่าวของแต่ละชิ้น","source":"สำนักถ้ามี","link":"URL ถ้ามีในข้อความ","date":"วันที่ถ้ามี"}]}
timeline เรียงจากเก่าไปใหม่${styleLine(p, "story")}

ข่าว:
${st.texts.map((x, i) => `--- ชิ้นที่ ${i + 1} (เพิ่มเมื่อ ${x.added}) ---\n${x.text}`).join("\n\n")}`;
      const r = await ai(prompt, "default");
      const arr = (v, n, f) => (Array.isArray(v) ? v : []).slice(0, n).map(f);
      st.result = {
        q: data.q, title: clip(r.title || data.q, 120), status: clip(r.status, 20) || "กำลังพัฒนา",
        w: Object.fromEntries(["who","what","where","when","why","how"].map(k => [k, clip(r.w && r.w[k], 300)])),
        story: clip(r.story, 3000), analogy: clip(r.analogy, 600),
        timeline: arr(r.timeline, 15, t => ({ when: clip(t.when, 60), what: clip(t.what, 300), sources: arr(t.sources, 4, s => clip(s, 60)).filter(Boolean) })),
        sides: arr(r.sides, 5, s => ({ name: clip(s.name, 60), stance: clip(s.stance, 400) })),
        conflicts: arr(r.conflicts, 5, c => clip(c, 300)), watch: arr(r.watch, 5, c => clip(c, 300)),
        sources: arr(r.sources, 20, s => ({ title: clip(s.title, 200), source: clip(s.source, 60), link: /^https?:\/\//.test(s.link || "") ? s.link : "", date: clip(s.date, 60) })),
        created: new Date().toISOString(), count: st.texts.length,
      };
      await dset(key, st);
      return st.result;
    }
    case "/story/ask": {
      const st = await dget(P("story_" + h32(data.q)), null);
      if (!st || !st.result) throw new Error("ยังไม่มีสรุปของเรื่องนี้");
      const s = st.result;
      const r = await ai(`ตอบคำถามของผู้ใช้เกี่ยวกับเรื่อง "${s.title}" โดยใช้เฉพาะข้อมูลด้านล่าง ถ้าข้อมูลไม่พอให้บอกตรงๆ ว่ายังไม่มีข้อมูล ${langLine(p)}
ตอบเป็น JSON: {"answer":"..."}
คำถาม: ${clip(data.question, 300)}

สรุปเรื่อง: ${s.story}
ไทม์ไลน์: ${s.timeline.map(t => `${t.when}: ${t.what}`).join(" / ")}
ข่าวต้นทาง:
${st.texts.map(x => x.text).join("\n---\n")}`, "quick");
      return { answer: clip(r.answer, 2000) };
    }
    case "/video": {
      const text = String(data.text || "").trim();
      if (text.length < 40) throw new Error("วางคำบรรยายของคลิปก่อน (เช่น คัดลอกจาก YouTube › แสดงข้อความถอดเสียง)");
      const mode = data.mode === "full" ? "full" : "sum";
      const prompt = mode === "sum"
        ? `ด้านล่างคือคำบรรยาย/transcript ของคลิปวิดีโอ${data.title ? ` (ชื่อหรือลิงก์: ${clip(data.title, 200)})` : ""} สรุปอย่างเป็นกลาง ใช้เฉพาะข้อมูลในข้อความ ${langLine(p)}
ตอบเป็น JSON เท่านั้น:
{"headline":"ชื่อเรื่อง 1 บรรทัด","channel":"ชื่อช่อง/รายการ ถ้ามีในข้อความ","summary":["ประเด็นสำคัญ 3-6 ข้อ"],
 "key_moments":[{"time":"mm:ss ถ้ามีเวลาในข้อความ ไม่มีให้เว้นว่าง","point":"..."}],"category":"หมวด","sentiment":"บวก|กลาง|ลบ"}${styleLine(p, "video")}

คำบรรยาย:
<<<
${fitBytes(text, 50000)}
>>>`
        : `ด้านล่างคือคำบรรยาย/transcript ของคลิปวิดีโอ จัดเป็นช่วงตามหัวข้อที่เปลี่ยน แก้คำผิดและเว้นวรรคให้อ่านง่าย คงเนื้อหาเดิมไว้ทั้งหมด ห้ามสรุปย่อหรือแต่งเพิ่ม
ระบุผู้พูดถ้าเดาได้จากบริบท ไม่แน่ใจให้ใช้ "ผู้พูด"
ตอบเป็น JSON เท่านั้น:
{"headline":"ชื่อเรื่อง","channel":"","speakers":["..."],
 "sections":[{"start":"mm:ss ถ้ามี","end":"","title":"หัวข้อช่วง","lines":[{"speaker":"...","text":"..."}]}]}

คำบรรยาย:
<<<
${fitBytes(text, 30000)}
>>>`;
      const r = await ai(prompt, mode === "full" ? "complex" : "default");
      const link = /^https?:\/\//.test(data.title || "") ? data.title : "";
      const item = { id: h32(text.slice(0, 2000) + mode), mode, url: link, headline: clip(r.headline, 220), channel: clip(r.channel, 100), created: new Date().toISOString() };
      if (mode === "sum"){
        item.summary = (r.summary || []).map(s => clip(s, 500)).slice(0, 8);
        item.key_moments = (r.key_moments || []).slice(0, 12).map(k => ({ time: clip(k.time, 10), point: clip(k.point, 300) }));
        item.category = clip(r.category, 30); item.sentiment = clip(r.sentiment, 10);
      } else {
        item.sections = (r.sections || []).slice(0, 60).map(s => ({ start: clip(s.start, 10), end: clip(s.end, 10), title: clip(s.title, 200),
          lines: (s.lines || []).slice(0, 150).map(l => ({ speaker: clip(l.speaker, 60), text: clip(l.text, 2000) })) }));
      }
      const hist = (await dget(P("vh"), [])).filter(x => x.id !== item.id);
      hist.unshift(item);
      await dset(P("vh"), JSON.parse(JSON.stringify(hist.slice(0, 8))));
      return item;
    }
    case "/video/history": return { history: await dget(P("vh"), []) };
    case "/saved/list": return { saved: await dget(P("saved"), []) };
    case "/saved/toggle": {
      const list = await dget(P("saved"), []), it = data.item;
      const key = it.link || it.headline;
      const i = list.findIndex(x => (x.link || x.headline) === key);
      if (i >= 0) list.splice(i, 1); else list.unshift({ headline: it.headline, link: it.link, source: it.source, points: it.points, saved: new Date().toISOString() });
      await dset(P("saved"), list.slice(0, 200));
      return { saved: list.slice(0, 200) };
    }
  }
  throw new Error("unknown " + path);
}

window.GN_BACKEND = {
  features: { images: false, recommend: false, quota: false, video: "transcript" },
  async call(path, data){ U.user = data.user === "u2" ? "u2" : "jo"; U.prefs = data._prefs || U.prefs; return api(path, data); }
};
})();
