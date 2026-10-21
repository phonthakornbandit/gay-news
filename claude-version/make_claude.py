import re, sys
SRC = "/home/claude/gay-news/index.html"
OUT = sys.argv[1]
h = open(SRC, encoding="utf-8").read()

def rep(a, b, count=1):
    global h
    assert h.count(a) >= 1, "missing: " + a[:80]
    h = h.replace(a, b) if count == 0 else h.replace(a, b, count)

# ---- strip document skeleton (artifact wraps it) ----
head_start = h.index("<head>") + len("<head>")
head_end = h.index("</head>")
head = h[head_start:head_end]
body = h[h.index("<body>") + len("<body>"):h.index("</body>")]
head = re.sub(r'<meta charset="UTF-8">\s*', "", head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', "", head)
head = head.replace('<title>GAY News</title>', '<title>GAY News</title>\n<meta name="claude:viewport-fit-sides" content="cover">')
h = head + body

# ---- CSS: theme follows viewer + side gutter + app height ----
rep(':root[data-theme="dark"]{', '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-gn="light"]){--bg:#0F1115;--surface:#161920;--soft:#1C2029;--soft2:#232833;--line:#2C323E;--line2:#242A34;--ink:#ECEEF2;--ink2:#C5CAD3;--muted:#A3AAB6;--faint:#959DAA;--accent:#7FA2FF;--accent-soft:#1E2A4A;--on-accent:#0F1115;--hero:#1E2A4A;--hero-ink:#FFFFFF;--hero-sub:#B9C6F0;--warn-bg:#2E2412;--warn-ink:#F2C97A;--hot-bg:#3A1F17;--hot-ink:#FFB59E;--overlay:rgba(0,0,0,.6);color-scheme:dark}}\n:root[data-theme="dark"],:root[data-gn="dark"]{color-scheme:dark;')
rep('html,body{margin:0;height:100%}', 'html,body{margin:0;height:100%}\nbody{padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}')
rep('.app{max-width:560px;margin:0 auto;height:100dvh;', '.app{max-width:560px;margin:0 auto;height:100%;')
rep('main.view{flex:1;min-height:0;overflow-y:auto;padding:18px 16px 20px;', 'main.view{flex:1;min-height:0;overflow-y:auto;padding:18px max(16px,env(safe-area-inset-right,0px)) 20px max(16px,env(safe-area-inset-left,0px));')
rep('<meta name="theme-color" content="#FFFFFF">', '')
rep('''  document.querySelector('meta[name="theme-color"]').content = dark ? "#0F1115" : "#FFFFFF";\n''', '')
# page theme toggle uses its own attribute so it never fights the viewer's data-theme
rep('root.dataset.theme = dark ? "dark" : "light";', 'if (p.theme === "auto") delete root.dataset.gn; else root.dataset.gn = dark ? "dark" : "light";')

# ---- extra CSS ----
rep('.sr{position:absolute;', '''textarea.paste{min-height:120px}
.hint{font-size:12px;color:var(--faint);line-height:1.5}
.sr{position:absolute;''')

# ---- strings ----
rep('const WORKER_URL = "https://gay-news.phonthakornbandit.workers.dev"; // ← ใส่ที่อยู่ Worker ของคุณ\n', '')
rep('''    ok: "ตกลง", cancel: "ยกเลิก", retry: "ลองใหม่", setUrl: "ยังไม่ได้ตั้ง WORKER_URL ในไฟล์ index.html",''',
    '''    ok: "ตกลง", cancel: "ยกเลิก", retry: "ลองใหม่", setUrl: "",
    pasteNews: "วางข่าว ลิงก์ หรือบทความ", pasteNewsPh: "วางเนื้อข่าวหลายชิ้นได้ในครั้งเดียว เช่น คัดลอกจากเว็บข่าว แอปข่าว หรือโพสต์",
    pasteHint: "Claude จะแยกเป็นข่าวทีละชิ้น จัดตามหัวข้อที่เลือก และสรุปจากข้อความที่วางเท่านั้น",
    lastFeed: "ข่าวชุดล่าสุด", addToStory: "เพิ่มข่าวในเรื่องนี้", addToStoryPh: "วางข่าวใหม่ของเรื่องนี้ แล้ว Claude จะรวมเข้าไทม์ไลน์",
    storyEmpty: "ยังไม่มีข่าวในเรื่องนี้\\nวางข่าวด้านล่างเพื่อเริ่มสรุป", rebuild: "อัปเดตสรุป",
    transcript: "วางคำบรรยาย / transcript ของคลิป", transcriptPh: "เช่น คัดลอกจาก YouTube › แสดงข้อความถอดเสียง",
    clipTitle: "ชื่อคลิปหรือลิงก์ (ไม่บังคับ)", noAI: "ต้องเปิดหน้านี้ใน claude.ai เพื่อใช้ Claude",
    aiBy: "สรุปโดย Claude",''')
rep('''    ok: "OK", cancel: "Cancel", retry: "Retry", setUrl: "WORKER_URL is not set in index.html",''',
    '''    ok: "OK", cancel: "Cancel", retry: "Retry", setUrl: "",
    pasteNews: "Paste news, links or articles", pasteNewsPh: "Paste several articles at once, copied from news sites, apps or posts",
    pasteHint: "Claude splits them into stories, sorts them by your topics and summarizes only what you pasted",
    lastFeed: "Last batch", addToStory: "Add news to this story", addToStoryPh: "Paste new coverage and Claude will merge it into the timeline",
    storyEmpty: "No coverage in this story yet\\nPaste news below to start", rebuild: "Rebuild summary",
    transcript: "Paste the video's captions / transcript", transcriptPh: "e.g. copy from YouTube › Show transcript",
    clipTitle: "Video title or link (optional)", noAI: "Open this page in claude.ai to use Claude",
    aiBy: "Summarized by Claude",''')
rep('loadingNews: "กำลังดึงข่าวและให้ AI สรุป…\\nประมาณ 20–40 วินาที"', 'loadingNews: "Claude กำลังแยกและสรุปข่าว…\\nประมาณ 20–60 วินาที"')
rep('loadingNews: "Fetching news and summarizing…\\nabout 20–40 seconds"', 'loadingNews: "Claude is sorting and summarizing…\\nabout 20–60 seconds"')
rep('go: n => `ยืนยัน · จัดข่าวให้ฉัน ${n} หัวข้อ`', 'go: n => `ยืนยัน · ให้ Claude จัดข่าว ${n} หัวข้อ`')
rep('loadingVideo: "AI กำลังดูคลิป…\\nคลิปยาวอาจใช้เวลา 1–3 นาที"', 'loadingVideo: "Claude กำลังอ่านคำบรรยาย…"')
rep('goSum: "สรุปคลิปนี้", goFull: "ถอดคำพูดทั้งคลิป"', 'goSum: "สรุปคลิปนี้", goFull: "จัดคำบรรยายเป็นช่วง"')
rep('modeFull: "ถอดคำพูดเต็ม"', 'modeFull: "จัดคำบรรยาย"')
rep('goSum: "Summarize this video", goFull: "Transcribe the whole video"', 'goSum: "Summarize this video", goFull: "Organize the transcript"')
rep('modeFull: "Full transcript"', 'modeFull: "Organize transcript"')
rep('loadingStory: "AI กำลังรวบรวมข่าวทุกสำนัก…"', 'loadingStory: "Claude กำลังเรียบเรียงเรื่องนี้…"')

# ---- replace network api with page-side Claude + db ----
a = h.index("/* =================== API =================== */")
b = h.index("async function savePrefs(patch){")
h = h[:a] + r'''/* =================== Claude + ที่เก็บข้อมูล (ใน claude.ai) =================== */
const DEFAULT_PREFS = { name:"", topics:["เศรษฐกิจ","ไอที"], customTopics:[], length:"mid", period:"1d", theme:"auto", uiLang:"th", sumLang:"th", newsCount:20, fontSize:"m", styles:{ news:"", recommend:"", story:"", video:"" } };
let DB = null, SAMPLE = null;
const MEM = {};
const caps = (async () => {
  try { DB = await window.claude?.use?.("db"); } catch(e){ DB = null; }
  try { SAMPLE = await window.claude?.use?.("sample"); } catch(e){ SAMPLE = null; }
})();
function h32(s){ let x = 5381; for (const c of String(s)) x = ((x << 5) + x + c.codePointAt(0)) >>> 0; return x.toString(36); }
const P = (k) => `gn/${S.user}/${k}`;
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
  if (!SAMPLE) throw new Error(L().noAI);
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
const LENGTH_RULE = { short:"points มี 1 ข้อ สั้นมาก", mid:"points มี 2-3 ข้อ", long:"points มี 4-5 ข้อ แต่ละข้ออธิบายให้เข้าใจ" };

async function api(path, data = {}){
  const p = S.prefs || DEFAULT_PREFS;
  switch (path){
    case "/login": {
      const saved = await dget(P("prefs"), {});
      return { prefs: { ...DEFAULT_PREFS, ...saved, styles: { ...DEFAULT_PREFS.styles, ...(saved.styles || {}) } } };
    }
    case "/prefs/save": await dset(P("prefs"), data.prefs); return { prefs: data.prefs };
    case "/news": {
      const text = String(data.text || "").trim();
      if (!text) throw new Error(L().pasteNewsPh);
      const topics = (data.topics || []).slice(0, 12);
      const total = [10,20,30].includes(Number(p.newsCount)) ? Number(p.newsCount) : 20;
      const prompt = `คุณคือบรรณาธิการข่าวที่เป็นกลาง ผู้ใช้วางข้อความด้านล่าง ซึ่งอาจมีข่าวหลายชิ้น หัวข่าว ลิงก์ หรือโพสต์ปนกัน
งานของคุณ: แยกเป็นข่าวทีละเรื่อง (สูงสุด ${total} เรื่อง) รวมข่าวซ้ำเรื่องเดียวกันเป็นเรื่องเดียว แล้วสรุปแต่ละเรื่อง
ใช้เฉพาะข้อมูลในข้อความที่วาง ห้ามแต่งข้อเท็จจริง ตัวเลข ชื่อ หรือวันที่ที่ไม่มีในข้อความ
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
        source: clip(x.source, 60), link: /^https?:\/\//.test(x.link || "") ? x.link : "", date: clip(x.date, 60), sources: 1,
      })).filter(x => x.headline);
      if (!items.length) throw new Error("ไม่พบข่าวในข้อความที่วาง");
      const out = { overview: clip(r.overview, 800), items, created: new Date().toISOString() };
      await dset(P("feed"), out);
      return out;
    }
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
      if (!st.texts.length) return { empty: true };
      if (st.result && !data.add && !data.refresh) return st.result;
      const prompt = `คุณคือนักข่าวที่เป็นกลาง ด้านล่างคือข่าวทั้งหมดที่ผู้ใช้รวบรวมไว้ของเรื่อง "${data.q}" (เรียงตามลำดับที่เพิ่ม)
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
      if (text.length < 40) throw new Error(L().transcriptPh);
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
''' + h[b:]

# ---- home: paste box instead of recommendations / period ----
rep('''  const rec = S.recOpen ? recBox() :
    `<button class="btn ghost" id="recBtn">${svg("spark",18)} ${esc(t.rec)}</button>`;''', '')
rep('''${S.feed?`<button class="chip" style="height:32px;border:none;color:var(--accent);padding:0" id="sameBtn">${esc(t.same)}</button>`:""}''',
    '''${S.lastFeed?`<button class="chip" style="height:32px;border:none;color:var(--accent);padding:0" id="sameBtn">${esc(t.lastFeed)}</button>`:""}''')
rep('''  <div style="display:flex;flex-direction:column;gap:8px"><span class="label">${esc(t.period)}</span>${seg("period",[["1d","d1"],["3d","d3"],["7d","d7"]])}</div>
  <button class="btn" id="goBtn" ${p.topics.length?"":"disabled"}>${esc(t.go(p.topics.length))}</button>
  <div class="grow"></div>
  ${rec}`;''', '''  <div style="display:flex;flex-direction:column;gap:6px"><label class="label" for="newsText">${esc(t.pasteNews)}</label>
    <textarea id="newsText" class="field paste" placeholder="${esc(t.pasteNewsPh)}">${esc(S.newsText||"")}</textarea>
    <span class="hint">${esc(t.pasteHint)}</span></div>
  <button class="btn" id="goBtn" ${p.topics.length?"":"disabled"}>${esc(t.go(p.topics.length))}</button>`;''')
rep('view.classList.toggle("home", S.tab === "news" && S.screen === "home");', 'view.classList.remove("home");')

# feed header: no period / refresh
rep('''<span class="muted" style="font-size:12px">${f&&f.items?`${f.items.length} · ${esc(t[{"1d":"d1","3d":"d3","7d":"d7"}[f.period]]||"")}`:""}</span></div>
    ${f&&f.items?`<button class="icon-btn" id="feedRefresh" aria-label="${esc(t.refresh)}">${svg("refresh",20)}</button>`:""}</div>''',
    '''<span class="muted" style="font-size:12px">${f&&f.items?`${f.items.length} · ${esc(t.aiBy)}`:""}</span></div></div>''')
rep('''<span style="color:var(--faint)">· ${esc(n.source)} · ${esc(ago(n.date))}</span>''', '''${n.source||n.date?`<span style="color:var(--faint)">· ${esc(n.source)}${n.date?" · "+esc(n.date):""}</span>`:""}''')
rep('''<span class="muted" style="font-size:12px">${esc(t.by(n.sources))}</span>''', '''<span class="muted" style="font-size:12px">${esc(n.topic)}</span>''')
rep('''<a href="${safeUrl(n.link)}" target="_blank" rel="noopener" aria-label="open">${svg("share",19)}</a>''', '''${n.link?`<a href="${safeUrl(n.link)}" target="_blank" rel="noopener" aria-label="open">${svg("share",19)}</a>`:""}''')

# story: empty state + add box
rep('''  if (s.error) return head + `<div class="err">${esc(s.error)}</div><button class="btn" id="storyRetry">${esc(t.retry)}</button><button class="btn ghost" id="unfollowBtn">${esc(t.unfollow)}</button>`;''',
    '''  const addBox = `<section style="display:flex;flex-direction:column;gap:8px"><label class="label" for="storyText">${esc(t.addToStory)}</label>
    <textarea id="storyText" class="field paste" placeholder="${esc(t.addToStoryPh)}"></textarea>
    <button class="btn small" id="storyAdd">${esc(t.addToStory)}</button></section>`;
  if (s.error) return head + `<div class="err">${esc(s.error)}</div><button class="btn" id="storyRetry">${esc(t.retry)}</button>${addBox}<button class="btn ghost" id="unfollowBtn">${esc(t.unfollow)}</button>`;
  if (s.empty) return head + `<div class="loading" style="white-space:pre-line;padding:20px 0">${esc(t.storyEmpty)}</div>${addBox}<button class="btn ghost small" id="unfollowBtn">${esc(t.unfollow)}</button>`;''')
rep('''<div class="row" style="font-size:12px;gap:6px"><span class="tag ${/จบ|คลี่/.test(s.status)?"":"hot"}">${esc(s.status)}</span><span style="color:var(--faint)">${esc(ago(s.created))}</span></div>''',
    '''<div class="row" style="font-size:12px;gap:6px"><span class="tag ${/จบ|คลี่/.test(s.status)?"":"hot"}">${esc(s.status)}</span><span style="color:var(--faint)">${esc(ago(s.created))} · ${s.count||0} ชิ้น</span></div>''')
rep('''    ${s.sources.map(x => `<a class="listrow" href="${safeUrl(x.link)}" target="_blank" rel="noopener" style="color:var(--ink)"><span>${esc(x.title)}<br><span class="muted" style="font-size:12px">${esc(x.source)} · ${esc(ago(x.date))}</span></span><span class="muted">↗</span></a>`).join("")}</section>''',
    '''    ${s.sources.map(x => x.link ? `<a class="listrow" href="${safeUrl(x.link)}" target="_blank" rel="noopener" style="color:var(--ink)"><span>${esc(x.title)}<br><span class="muted" style="font-size:12px">${esc(x.source)} ${esc(x.date)}</span></span><span class="muted">↗</span></a>` : `<div class="listrow"><span>${esc(x.title)}<br><span class="muted" style="font-size:12px">${esc(x.source)} ${esc(x.date)}</span></span></div>`).join("")}</section>
  ${addBox}''')
rep('''${s&&!s.error?`<button class="icon-btn" id="storyRefresh" aria-label="${esc(t.refresh)}">${svg("refresh",20)}</button>`:""}</div>''',
    '''${s&&!s.error&&!s.empty?`<button class="icon-btn" id="storyRefresh" aria-label="${esc(t.rebuild)}">${svg("refresh",20)}</button>`:""}</div>''')

# video: transcript instead of link
rep('''    const thumb = `<a class="yt" href="${safeUrl(v.url)}" target="_blank" rel="noopener"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt=""></a>`;''', '''    const thumb = "";''')
rep('''? (v.sections||[]).map(s => `<div class="sec"><a href="${safeUrl(v.url)}&t=${toSec(s.start)}s" target="_blank" rel="noopener" style="font-size:13px;font-weight:700">[${esc(s.start)}${s.end?" – "+esc(s.end):""}] ${esc(s.title)}</a>''',
    '''? (v.sections||[]).map(s => `<div class="sec"><b style="font-size:13px;color:var(--accent)">${s.start?`[${esc(s.start)}${s.end?" – "+esc(s.end):""}] `:""}${esc(s.title)}</b>''')
rep('''`<a class="mom" href="${safeUrl(v.url)}&t=${toSec(k.time)}s" target="_blank" rel="noopener"><b>${esc(k.time)}</b><span>${esc(k.point)}</span></a>`''',
    '''`<div class="mom">${k.time?`<b>${esc(k.time)}</b>`:""}<span>${esc(k.point)}</span></div>`''')
rep('''<span class="muted" style="font-size:12px">${esc(v.channel||"YouTube")}''', '''<span class="muted" style="font-size:12px">${v.url?`<a href="${safeUrl(v.url)}" target="_blank" rel="noopener">${esc(v.channel||"YouTube")} ↗</a>`:esc(v.channel||"")}''')
rep('''  <div style="display:flex;flex-direction:column;gap:6px"><label class="label" for="yt">${esc(t.ytLink)}</label>
    <input id="yt" class="field" inputmode="url" placeholder="https://youtu.be/…" autocomplete="off" value="${esc(S.vUrl||"")}"></div>''',
    '''  <div style="display:flex;flex-direction:column;gap:6px"><label class="label" for="vTitle">${esc(t.clipTitle)}</label>
    <input id="vTitle" class="field" placeholder="https://youtu.be/…" autocomplete="off" value="${esc(S.vTitle||"")}"></div>
  <div style="display:flex;flex-direction:column;gap:6px"><label class="label" for="yt">${esc(t.transcript)}</label>
    <textarea id="yt" class="field paste" placeholder="${esc(t.transcriptPh)}">${esc(S.vUrl||"")}</textarea></div>''')
rep('''    `<button class="listrow" data-vh="${esc(h.id)}" data-vhm="${esc(h.mode)}">''', '''    `<button class="listrow" data-vh="${esc(h.id)}">''')

# actions
rep('''  try { S.feed = await api("/news", { topics: p.topics, period: p.period, length: p.length, refresh: !!refresh }); }''',
    '''  try { S.feed = await api("/news", { topics: p.topics, length: p.length, text: S.newsText }); S.lastFeed = S.feed; }''')
rep('''async function openStory(q, refresh){
  S.storyQ = q; S.story = null; render(); $("view").scrollTop = 0;
  try { S.story = await api("/story", { q, refresh: !!refresh }); } catch(e){ S.story = { error: e.message }; }''',
    '''async function openStory(q, refresh, add){
  S.storyQ = q; S.story = null; render(); $("view").scrollTop = 0;
  try { S.story = await api("/story", { q, refresh: !!refresh, add }); } catch(e){ S.story = { error: e.message }; }''')
rep('''async function runVideo(url, mode){
  S.vUrl = url; S.vMode = mode; S.busy = true; S.err = null; S.vResult = null; render();
  try { S.vResult = await api("/video", { url, mode });''', '''async function runVideo(url, mode){
  S.vUrl = url; S.vTitle = ($("vTitle")||{}).value || S.vTitle || ""; S.vMode = mode; S.busy = true; S.err = null; S.vResult = null; render();
  try { S.vResult = await api("/video", { text: url, title: S.vTitle, mode });''')
rep('''  if (d.vh){ runVideo(`https://www.youtube.com/watch?v=${d.vh}`, d.vhm); return; }''',
    '''  if (d.vh){ const it = S.vHistory.find(x => x.id === d.vh); if (it){ S.vResult = it; S.err = null; render(); $("view").scrollTop = 0; } return; }''')
rep('''  if (d.vmode){ S.vMode = d.vmode; S.vUrl = ($("yt")||{}).value || S.vUrl; render(); return; }''',
    '''  if (d.vmode){ S.vMode = d.vmode; S.vUrl = ($("yt")||{}).value || S.vUrl; S.vTitle = ($("vTitle")||{}).value || S.vTitle; render(); return; }''')
rep('''  if (d.follow){ const n = S.feed.items[Number(d.follow)]; promptFollow(n.headline.slice(0,40)); return; }''',
    '''  if (d.follow){ const n = S.feed.items[Number(d.follow)]; promptFollow(n.headline.slice(0,40), [n.headline, ...n.points, n.source, n.link, n.date].filter(Boolean).join("\\n")); return; }''')
rep('''    case "goBtn": case "sameBtn": loadFeed(false); break;
    case "feedRefresh": case "feedRetry": loadFeed(true); break;''',
    '''    case "goBtn": case "feedRetry": { const ta = $("newsText"); if (ta) S.newsText = ta.value; if (!String(S.newsText||"").trim()){ toast(L().pasteNewsPh); break; } loadFeed(false); break; }
    case "sameBtn": S.feed = S.lastFeed; S.filter = "all"; S.screen = "feed"; render(); break;''')
rep('''    case "storyRetry": openStory(S.storyQ); break;''', '''    case "storyRetry": openStory(S.storyQ); break;
    case "storyAdd": { const v = ($("storyText")||{}).value || ""; if (v.trim()) openStory(S.storyQ, false, v.trim()); break; }''')
rep('''function promptFollow(def){
  askText(L().newFollow, async v => {
    try { S.follows = (await api("/follow/add", { q: v })).follows;''', '''function promptFollow(def, seed){
  askText(L().newFollow, async v => {
    try { S.follows = (await api("/follow/add", { q: v, seed })).follows;''')
rep('''    case "switchUser": S.user = S.user === "jo" ? "u2" : "jo"; lsSet("gn_user", S.user); closeDrawer();
      Object.assign(S, { ready: false, feed: null,''', '''    case "switchUser": S.user = S.user === "jo" ? "u2" : "jo"; lsSet("gn_user", S.user); closeDrawer();
      Object.assign(S, { ready: false, feed: null, lastFeed: null, newsText: "",''')
# keep the pasted text while typing (re-render safety)
rep('''document.addEventListener("submit", async e => {''', '''document.addEventListener("input", e => {
  if (e.target.id === "newsText") S.newsText = e.target.value;
  if (e.target.id === "yt") S.vUrl = e.target.value;
  if (e.target.id === "vTitle") S.vTitle = e.target.value;
});
document.addEventListener("submit", async e => {''')
# last feed + history on boot
rep('''  api("/saved/list").then(x => { S.saved = x.saved; }).catch(()=>{});''', '''  api("/saved/list").then(x => { S.saved = x.saved; }).catch(()=>{});
  api("/feed/last").then(x => { if (x && x.items){ S.lastFeed = x; render(); } }).catch(()=>{});''')
# drawer: no quota box
h = re.sub(r'\n    <div style="margin:8px 20px;padding:14px;border-radius:14px;background:var\(--soft\)" id="quotaBox">.*?</div>`;', '`;', h)
h = re.sub(r'\n  api\("/quota"\)\.then\(.*?\n', '\n', h)
assert "quotaBox" not in h, "quota"
# recommendation prompt tab not used
rep('''const names = { news: t.pNews, recommend: t.pRec, story: t.pStory, video: t.pVideo };''', '''const names = { news: t.pNews, story: t.pStory, video: t.pVideo };''')

assert "fetch(" not in h, "network call left"
assert "i.ytimg.com" not in h
open(OUT, "w", encoding="utf-8").write(h)
print("ok", len(h))
