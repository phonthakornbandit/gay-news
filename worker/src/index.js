// GAY News — Cloudflare Worker (backend)
// Secret ที่ต้องตั้งใน Cloudflare: GEMINI_API_KEY
// ตัวแปรเสริม (ไม่บังคับ): MODEL — ชื่อรุ่น Gemini, DAILY_LIMIT — จำกัดจำนวนครั้งเรียก AI ต่อวัน (ค่าเริ่มต้น 300)
// ไม่มีระบบรหัสผ่าน: รับเฉพาะคำขอจากหน้าเว็บ GitHub Pages ของเจ้าของ และมีเพดานการใช้ AI ต่อวัน

const DEFAULT_MODEL = "gemini-3.8-flash";

const ALLOWED_ORIGINS = ["https://phonthakornbandit.github.io"];
let CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_PREFS = {
  name: "",
  topics: ["เศรษฐกิจ", "ไอที"],
  customTopics: [],
  length: "mid",
  period: "1d",
  theme: "light",
  uiLang: "th",
  sumLang: "th",
  newsCount: 20,
  fontSize: "m",
  styles: { news: "", recommend: "", story: "", video: "" },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const okOrigin = ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    CORS = { ...CORS, "Access-Control-Allow-Origin": okOrigin ? origin : ALLOWED_ORIGINS[0] };
    if (origin && !okOrigin) return json({ error: "ไม่อนุญาต" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return json({ error: "ใช้ได้เฉพาะ POST" }, 405);

    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    let body = {};
    try { body = await request.json(); } catch { return json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, 400); }

    const user = body.user === "u2" ? "u2" : "jo";

    try {
      switch (path) {
        case "/login": return json({ user, prefs: await getPrefs(env, user) });
        case "/prefs/save": return json({ prefs: await savePrefs(env, user, body.prefs) });
        case "/news": return json(await newsFeed(env, user, body));
        case "/recommend": return json(await recommend(env, user, body));
        case "/follow/list": return json({ follows: await getFollows(env, user) });
        case "/follow/add": return json({ follows: await addFollow(env, user, body.q) });
        case "/follow/remove": return json({ follows: await removeFollow(env, user, body.q) });
        case "/story": return json(await story(env, user, body.q, body.refresh));
        case "/story/ask": return json(await storyAsk(env, user, body.q, body.question));
        case "/video": return json(await video(env, user, body.url, body.mode));
        case "/video/history": return json({ history: await getJSON(env, `vh:${user}`, []) });
        case "/saved/list": return json({ saved: await getJSON(env, `saved:${user}`, []) });
        case "/saved/toggle": return json({ saved: await toggleSaved(env, user, body.item) });
        case "/quota": return json(await quota(env));
        default: return json({ error: "ไม่พบคำสั่งนี้" }, 404);
      }
    } catch (e) {
      const msg = String(e && e.message || e);
      const status = /quota|429|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 500;
      return json({ error: status === 429 ? "โควตา AI ฟรีของวันนี้เต็มแล้ว ลองใหม่ภายหลัง" : msg }, status);
    }
  },
};

/* ---------------- helpers ---------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getJSON(env, key, fallback) {
  const v = await env.NEWS.get(key);
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

async function putJSON(env, key, val, ttl) {
  const opts = ttl ? { expirationTtl: Math.max(60, ttl) } : undefined;
  await env.NEWS.put(key, JSON.stringify(val), opts);
}

function today() {
  // วันที่ตามเวลาไทย
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function hash(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function clean(s, max = 200) {
  return String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function langLine(prefs) {
  return prefs.sumLang === "en" ? "Write every text value in English." : "เขียนข้อความทั้งหมดเป็นภาษาไทย";
}

function styleLine(prefs, key) {
  const s = clean(prefs.styles && prefs.styles[key], 1500);
  return s ? `\n\nสไตล์เพิ่มเติมที่ผู้ใช้กำหนด (ใช้กับน้ำเสียงและการเรียบเรียงเท่านั้น ห้ามเปลี่ยนรูปแบบ JSON):\n${s}` : "";
}

/* ---------------- prefs ---------------- */

async function getPrefs(env, user) {
  const p = await getJSON(env, `prefs:${user}`, {});
  return { ...DEFAULT_PREFS, ...p, styles: { ...DEFAULT_PREFS.styles, ...(p.styles || {}) } };
}

async function savePrefs(env, user, incoming) {
  const cur = await getPrefs(env, user);
  const p = { ...cur };
  if (incoming && typeof incoming === "object") {
    if ("name" in incoming) p.name = clean(incoming.name, 40);
    if (Array.isArray(incoming.topics)) p.topics = incoming.topics.map(t => clean(t, 40)).filter(Boolean).slice(0, 12);
    if (Array.isArray(incoming.customTopics)) p.customTopics = incoming.customTopics.map(t => clean(t, 40)).filter(Boolean).slice(0, 12);
    if (["short", "mid", "long"].includes(incoming.length)) p.length = incoming.length;
    if (["1d", "3d", "7d"].includes(incoming.period)) p.period = incoming.period;
    if (["light", "dark", "auto"].includes(incoming.theme)) p.theme = incoming.theme;
    if (["th", "en"].includes(incoming.uiLang)) p.uiLang = incoming.uiLang;
    if (["th", "en"].includes(incoming.sumLang)) p.sumLang = incoming.sumLang;
    if ([10, 20, 30].includes(Number(incoming.newsCount))) p.newsCount = Number(incoming.newsCount);
    if (["s", "m", "l"].includes(incoming.fontSize)) p.fontSize = incoming.fontSize;
    if (incoming.styles && typeof incoming.styles === "object") {
      for (const k of Object.keys(DEFAULT_PREFS.styles)) {
        if (k in incoming.styles) p.styles[k] = clean(incoming.styles[k], 1500);
      }
    }
  }
  await putJSON(env, `prefs:${user}`, p);
  return p;
}

/* ---------------- Gemini ---------------- */

async function gemini(env, parts, maxTokens = 8192) {
  if (!env.GEMINI_API_KEY) throw new Error("ยังไม่ได้ตั้ง GEMINI_API_KEY ใน Cloudflare");
  const limit = Number(env.DAILY_LIMIT) || 300;
  if ((Number(await env.NEWS.get(`usage:${today()}`)) || 0) >= limit) throw new Error(`ใช้ AI ครบ ${limit} ครั้งของวันนี้แล้ว (เพดานกันใช้เกิน) ลองใหม่พรุ่งนี้`);
  // รุ่นหลัก + รุ่นสำรอง (ตั้งได้ใน Cloudflare: MODEL และ MODEL_FALLBACK คั่นด้วย ,)
  const models = [env.MODEL || DEFAULT_MODEL, ...String(env.MODEL_FALLBACK || "").split(",").map(x => x.trim()).filter(Boolean)];
  let lastMsg = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.3 },
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await bumpUsage(env);
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
        if (!text) throw new Error("ไม่ได้รับผลจาก AI (คลิปหรือข่าวอาจถูกจำกัด)");
        try {
          return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        } catch {
          throw new Error("AI ตอบกลับมาไม่ครบ ลองกดใหม่อีกครั้ง");
        }
      }
      lastMsg = (data.error && data.error.message) || `Gemini ตอบกลับผิดพลาด (${res.status})`;
      const busy = res.status === 503 || res.status === 500 || /high demand|overloaded|unavailable/i.test(lastMsg);
      const quota = res.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(lastMsg);
      if (busy && attempt < 2) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1) ** 2)); continue; }
      if (busy || quota || res.status === 404) break; // ลองรุ่นสำรองถัดไป
      throw new Error(lastMsg);
    }
  }
  if (/high demand|overloaded|unavailable/i.test(lastMsg)) throw new Error("ตอนนี้ AI ของ Google มีคนใช้เยอะมาก (ชั่วคราว) รอสัก 1–2 นาทีแล้วกดลองใหม่");
  throw new Error(lastMsg);
}

async function bumpUsage(env) {
  const k = `usage:${today()}`;
  const n = Number(await env.NEWS.get(k)) || 0;
  await env.NEWS.put(k, String(n + 1), { expirationTtl: 3 * 86400 });
}

async function quota(env) {
  return { date: today(), aiCalls: Number(await env.NEWS.get(`usage:${today()}`)) || 0, limit: Number(env.DAILY_LIMIT) || 300 };
}

/* ---------------- Google News RSS ---------------- */

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name.replace(":", "\\:")}[^>]*>([\\s\\S]*?)</${name.replace(":", "\\:")}>`));
  return m ? decodeEntities(m[1]).trim() : "";
}

function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    const source = tag(it, "source");
    let title = tag(it, "title");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    const desc = tag(it, "description");
    const related = (desc.match(/<li>/g) || []).length;
    const link = tag(it, "link");
    if (!/^https?:\/\//.test(link)) continue;
    items.push({
      title: clean(title, 220),
      source: clean(source, 60),
      link,
      date: tag(it, "pubDate"),
      sources: Math.max(1, related),
      related: clean(desc.replace(/<[^>]+>/g, " · ").replace(/\s+/g, " "), 400),
    });
  }
  return items;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PERIOD_MS = { "1d": 86400e3, "3d": 3 * 86400e3, "7d": 7 * 86400e3 };

// ดึงข่าว: ลอง Google News ก่อน ถ้าถูกปฏิเสธจะเปลี่ยนไปใช้ Bing News อัตโนมัติ
async function gnews(q, period, hl = "th") {
  const tries = [() => fetchGoogle(q, period, hl), () => fetchBing(q, period, hl)];
  let lastErr;
  for (const t of tries) {
    try {
      const items = await t();
      if (items.length) return items;
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return [];
}

async function fetchGoogle(q, period, hl) {
  const loc = hl === "en" ? "hl=en-US&gl=US&ceid=US:en" : "hl=th&gl=TH&ceid=TH:th";
  const url = q
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${period}`)}&${loc}`
    : `https://news.google.com/rss?${loc}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8" } });
  if (!res.ok) throw new Error(`ดึงข่าวไม่สำเร็จ (Google ${res.status})`);
  return parseRSS(await res.text());
}

async function fetchBing(q, period, hl) {
  const interval = period === "1d" ? "7" : "8"; // 7 = 24 ชม., 8 = 7 วัน
  const mkt = hl === "en" ? "en-US" : "th-TH";
  const query = q || (hl === "en" ? "top news" : "ข่าว");
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setmkt=${mkt}&setlang=${mkt}&qft=${encodeURIComponent(`interval="${interval}"`)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8" } });
  if (!res.ok) throw new Error(`ดึงข่าวไม่สำเร็จ (Bing ${res.status})`);
  const since = Date.now() - (PERIOD_MS[period] || PERIOD_MS["7d"]);
  return parseBing(await res.text()).filter(it => !Date.parse(it.date) || Date.parse(it.date) >= since);
}

function parseBing(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    let link = tag(it, "link");
    try {
      const u = new URL(link);
      const real = u.searchParams.get("url");
      if (real) link = real;
    } catch {}
    if (!/^https?:\/\//.test(link)) continue;
    let source = tag(it, "News:Source");
    if (!source) { try { source = new URL(link).hostname.replace(/^www\./, ""); } catch {} }
    items.push({
      title: clean(tag(it, "title"), 220),
      source: clean(source, 60),
      link,
      date: tag(it, "pubDate"),
      sources: 1,
      related: clean(tag(it, "description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), 400),
    });
  }
  return items;
}

/* ---------------- ข่าววันนี้ ---------------- */

const LENGTH_RULE = {
  short: "points มี 1 ข้อ สั้นมาก",
  mid: "points มี 2-3 ข้อ",
  long: "points มี 4-5 ข้อ แต่ละข้ออธิบายให้เข้าใจ",
};

async function newsFeed(env, user, body) {
  const prefs = await getPrefs(env, user);
  const topics = (Array.isArray(body.topics) ? body.topics : prefs.topics).map(t => clean(t, 40)).filter(Boolean).slice(0, 12);
  if (!topics.length) throw new Error("เลือกอย่างน้อย 1 หัวข้อ");
  const period = ["1d", "3d", "7d"].includes(body.period) ? body.period : prefs.period;
  const length = ["short", "mid", "long"].includes(body.length) ? body.length : prefs.length;
  const total = [10, 20, 30].includes(Number(prefs.newsCount)) ? Number(prefs.newsCount) : 20;

  const key = `news:${user}:${await hash([today(), topics.join("|"), period, length, total, prefs.sumLang, prefs.styles.news].join("#"))}`;
  if (!body.refresh) {
    const cached = await getJSON(env, key, null);
    if (cached) return { ...cached, cached: true };
  }

  const per = Math.ceil(total / topics.length);
  const lists = await Promise.all(topics.map(t => gnews(t, period).catch(() => [])));
  const seen = new Set();
  const picked = [];
  lists.forEach((list, ti) => {
    let n = 0;
    for (const it of list) {
      const k = it.title.slice(0, 60);
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push({ ...it, topic: topics[ti] });
      if (++n >= per) break;
    }
  });
  const items = picked.slice(0, total);
  if (!items.length) throw new Error("ไม่พบข่าวในช่วงเวลานี้ ลองเลือกช่วงเวลาให้ยาวขึ้น");

  const listText = items.map((it, i) =>
    `[${i}] หัวข้อ:${it.topic} | ${it.title} | สำนัก:${it.source} | เวลา:${it.date} | หัวข่าวเกี่ยวข้อง:${it.related}`
  ).join("\n");

  const prompt = `คุณคือบรรณาธิการข่าวที่เป็นกลาง ด้านล่างคือรายการข่าว (หัวข่าวจากหลายสำนัก)
สรุปแต่ละข่าวโดยใช้เฉพาะข้อมูลที่ให้มา ห้ามแต่งข้อเท็จจริง ตัวเลข หรือชื่อที่ไม่มีในข้อมูล
${langLine(prefs)}
ตอบเป็น JSON เท่านั้น รูปแบบ:
{"overview":"ภาพรวมข่าวทั้งหมด 2-3 ประโยค",
 "items":[{"i":0,"headline":"หัวข่าวเรียบเรียงใหม่ เป็นกลาง ไม่เรียกคลิก","points":["..."],"category":"หมวดสั้นๆ","tone":"บวก|กลาง|ลบ"}]}
กติกา: ${LENGTH_RULE[length]} · items ต้องครบทุกข่าวและใช้ i ตามเลขในวงเล็บ${styleLine(prefs, "news")}

ข่าว:
${listText}`;

  const ai = await gemini(env, [{ text: prompt }], 8192);
  const byI = new Map((ai.items || []).map(x => [Number(x.i), x]));
  const out = {
    overview: clean(ai.overview, 800),
    created: new Date().toISOString(),
    topics, period, length,
    items: items.map((it, i) => {
      const a = byI.get(i) || {};
      return {
        id: i,
        topic: it.topic,
        headline: clean(a.headline || it.title, 220),
        points: (Array.isArray(a.points) ? a.points : []).map(p => clean(p, 400)).slice(0, 6),
        category: clean(a.category || it.topic, 30),
        tone: ["บวก", "กลาง", "ลบ"].includes(a.tone) ? a.tone : "กลาง",
        title: it.title, source: it.source, link: it.link, date: it.date, sources: it.sources,
      };
    }),
  };
  await putJSON(env, key, out, 1800);
  return out;
}

/* ---------------- ข่าวแนะนำ ---------------- */

async function recommend(env, user, body) {
  const prefs = await getPrefs(env, user);
  const key = `rec:${user}:${today()}`;
  if (!body.refresh) {
    const cached = await getJSON(env, key, null);
    if (cached) return { ...cached, cached: true };
  }
  const follows = await getFollows(env, user);
  const items = (await gnews("", "1d")).slice(0, 35);
  if (!items.length) throw new Error("ยังดึงข่าวเด่นไม่ได้");

  const prompt = `เลือกข่าวแนะนำ 5 ข่าวจากรายการด้านล่างให้ผู้ใช้คนนี้
ความสนใจ: ${[...prefs.topics, ...prefs.customTopics].join(", ") || "-"}
เรื่องที่ติดตาม: ${follows.map(f => f.q).join(", ") || "-"}
กติกา: 4 ข่าวเกี่ยวกับความสนใจหรือเรื่องที่ติดตาม และ 1 ข่าวที่อยู่นอกความสนใจแต่สำคัญ (outside=true)
ทุกข่าวต้องมีเหตุผลสั้นๆ ว่าทำไมแนะนำ ใช้เฉพาะข้อมูลที่ให้มา ${langLine(prefs)}
ตอบเป็น JSON เท่านั้น: {"picks":[{"i":0,"headline":"...","why":"...","outside":false}]}${styleLine(prefs, "recommend")}

ข่าว:
${items.map((it, i) => `[${i}] ${it.title} | ${it.source}`).join("\n")}`;

  const ai = await gemini(env, [{ text: prompt }], 2048);
  const picks = (ai.picks || []).slice(0, 5).map(p => {
    const it = items[Number(p.i)];
    if (!it) return null;
    return { headline: clean(p.headline || it.title, 220), why: clean(p.why, 200), outside: !!p.outside, link: it.link, source: it.source, date: it.date };
  }).filter(Boolean);
  const out = { picks, created: new Date().toISOString() };
  await putJSON(env, key, out, 86400);
  return out;
}

/* ---------------- ติดตามเรื่อง ---------------- */

async function getFollows(env, user) {
  return getJSON(env, `follows:${user}`, []);
}

async function addFollow(env, user, q) {
  q = clean(q, 60);
  if (!q) throw new Error("พิมพ์คำค้นก่อน");
  const list = await getFollows(env, user);
  if (!list.some(f => f.q === q)) list.unshift({ q, added: new Date().toISOString() });
  await putJSON(env, `follows:${user}`, list.slice(0, 20));
  return list.slice(0, 20);
}

async function removeFollow(env, user, q) {
  const list = (await getFollows(env, user)).filter(f => f.q !== q);
  await putJSON(env, `follows:${user}`, list);
  await env.NEWS.delete(`story:${user}:${await hash(q)}`);
  return list;
}

async function story(env, user, q, refresh) {
  q = clean(q, 60);
  if (!q) throw new Error("ไม่ได้ระบุเรื่อง");
  const prefs = await getPrefs(env, user);
  const key = `story:${user}:${await hash(q)}`;
  const cached = await getJSON(env, key, null);
  if (cached && !refresh && Date.now() - Date.parse(cached.created) < 3600 * 1000) return { ...cached, cached: true };

  const items = (await gnews(q, "7d")).slice(0, 30);
  if (!items.length) throw new Error("ยังไม่พบข่าวของเรื่องนี้ใน 7 วันล่าสุด");

  const prompt = `คุณคือนักข่าวที่เป็นกลาง รวบรวมข่าวทั้งหมดด้านล่างของเรื่อง "${q}" แล้วเล่าเป็นเรื่องเดียว
ใช้เฉพาะข้อมูลที่ให้มา ถ้าไม่มีข้อมูลส่วนใดให้ใส่ "ยังไม่มีข้อมูล" ห้ามเดา
ถ้าแต่ละสำนักรายงานตัวเลขหรือข้อเท็จจริงไม่ตรงกัน ให้ใส่ใน conflicts ${langLine(prefs)}
ตอบเป็น JSON เท่านั้น:
{"title":"ชื่อเรื่อง","status":"กำลังพัฒนา|คลี่คลาย|จบแล้ว",
 "w":{"who":"","what":"","where":"","when":"","why":"","how":""},
 "story":"เล่าเรื่อง 2-3 ย่อหน้า ภาษาง่าย","analogy":"ตัวอย่างเปรียบเทียบให้เข้าใจง่าย",
 "timeline":[{"when":"วันที่/เวลา","what":"เกิดอะไรขึ้น","refs":[0,3]}],
 "sides":[{"name":"ฝ่าย","stance":"จุดยืน"}],
 "conflicts":["..."],"watch":["สิ่งที่ต้องจับตาต่อ"]}
timeline เรียงจากเก่าไปใหม่ refs คือเลขข่าวที่เป็นที่มา${styleLine(prefs, "story")}

ข่าว:
${items.map((it, i) => `[${i}] ${it.date} | ${it.source} | ${it.title} | เกี่ยวข้อง:${it.related}`).join("\n")}`;

  const ai = await gemini(env, [{ text: prompt }], 8192);
  const out = {
    q,
    title: clean(ai.title || q, 120),
    status: clean(ai.status, 20) || "กำลังพัฒนา",
    w: Object.fromEntries(["who", "what", "where", "when", "why", "how"].map(k => [k, clean(ai.w && ai.w[k], 300)])),
    story: clean(ai.story, 3000),
    analogy: clean(ai.analogy, 600),
    timeline: (ai.timeline || []).slice(0, 15).map(t => ({
      when: clean(t.when, 60), what: clean(t.what, 300),
      sources: [...new Set((t.refs || []).map(r => items[Number(r)] && items[Number(r)].source).filter(Boolean))].slice(0, 4),
    })),
    sides: (ai.sides || []).slice(0, 5).map(s => ({ name: clean(s.name, 60), stance: clean(s.stance, 400) })),
    conflicts: (ai.conflicts || []).slice(0, 5).map(c => clean(c, 300)),
    watch: (ai.watch || []).slice(0, 5).map(c => clean(c, 300)),
    sources: items.map(it => ({ title: it.title, source: it.source, link: it.link, date: it.date })),
    created: new Date().toISOString(),
  };
  await putJSON(env, key, out, 7 * 86400);
  return out;
}

async function storyAsk(env, user, q, question) {
  question = clean(question, 300);
  if (!question) throw new Error("พิมพ์คำถามก่อน");
  const s = await getJSON(env, `story:${user}:${await hash(clean(q, 60))}`, null);
  if (!s) throw new Error("เปิดดูเรื่องนี้ก่อน แล้วค่อยถาม");
  const prefs = await getPrefs(env, user);
  const prompt = `ตอบคำถามของผู้ใช้เกี่ยวกับเรื่อง "${s.title}" โดยใช้เฉพาะข้อมูลด้านล่าง
ถ้าข้อมูลไม่พอให้บอกตรงๆ ว่ายังไม่มีข้อมูล ${langLine(prefs)}
ตอบเป็น JSON: {"answer":"..."}
คำถาม: ${question}

สรุปเรื่อง: ${s.story}
ไทม์ไลน์: ${s.timeline.map(t => `${t.when}: ${t.what}`).join(" / ")}
หัวข่าว: ${s.sources.map(x => `${x.source}: ${x.title}`).join(" / ")}`;
  const ai = await gemini(env, [{ text: prompt }], 1024);
  return { answer: clean(ai.answer, 2000) };
}

/* ---------------- บันทึก ---------------- */

async function toggleSaved(env, user, item) {
  const list = await getJSON(env, `saved:${user}`, []);
  if (!item || !/^https?:\/\//.test(item.link || "")) return list;
  const i = list.findIndex(x => x.link === item.link);
  if (i >= 0) list.splice(i, 1);
  else list.unshift({ headline: clean(item.headline, 220), link: item.link, source: clean(item.source, 60), saved: new Date().toISOString() });
  await putJSON(env, `saved:${user}`, list.slice(0, 200));
  return list.slice(0, 200);
}

/* ---------------- สรุปวิดีโอ ---------------- */

function videoId(u) {
  try {
    const x = new URL(String(u).trim());
    if (x.hostname.includes("youtu.be")) return x.pathname.slice(1).split("/")[0] || null;
    if (x.searchParams.get("v")) return x.searchParams.get("v");
    const m = x.pathname.match(/\/(shorts|live|embed)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch { return null; }
}

async function video(env, user, url, mode) {
  const id = videoId(url);
  if (!id || !/^[\w-]{6,20}$/.test(id)) throw new Error("ลิงก์ YouTube ไม่ถูกต้อง");
  mode = mode === "full" ? "full" : "sum";
  const prefs = await getPrefs(env, user);
  const key = `v:${id}:${mode}:${prefs.sumLang}`;

  let item = await getJSON(env, key, null);
  if (!item) {
    const prompt = mode === "sum"
      ? `สรุปคลิปนี้อย่างเป็นกลาง ${langLine(prefs)}
ตอบเป็น JSON เท่านั้น:
{"headline":"ชื่อเรื่อง 1 บรรทัด","channel":"ชื่อช่อง/รายการ ถ้าทราบ","summary":["ประเด็นสำคัญ 3-6 ข้อ"],
 "key_moments":[{"time":"mm:ss","point":"..."}],"category":"หมวด","sentiment":"บวก|กลาง|ลบ"}
ถ้าไม่แน่ใจข้อมูลใด อย่าเดา ให้ข้ามไป${styleLine(prefs, "video")}`
      : `ถอดคำพูดในคลิปนี้ให้ครบและใกล้เคียงคำพูดจริงที่สุด แบ่งเป็นช่วงตามหัวข้อที่เปลี่ยน ระบุผู้พูด
ถ้าไม่ทราบชื่อผู้พูด ใช้ "ผู้พูด 1", "ผู้พูด 2" ห้ามสรุปย่อหรือแต่งเพิ่ม
ตอบเป็น JSON เท่านั้น:
{"headline":"ชื่อเรื่อง","channel":"ชื่อช่อง/รายการ ถ้าทราบ","speakers":["..."],
 "sections":[{"start":"mm:ss","end":"mm:ss","title":"หัวข้อช่วง","lines":[{"speaker":"...","text":"..."}]}]}`;

    const ai = await gemini(env, [
      { file_data: { file_uri: `https://www.youtube.com/watch?v=${id}` } },
      { text: prompt },
    ], mode === "full" ? 65536 : 4096);

    item = {
      id, mode,
      url: `https://www.youtube.com/watch?v=${id}`,
      headline: clean(ai.headline, 220),
      channel: clean(ai.channel, 100),
      created: new Date().toISOString(),
    };
    if (mode === "sum") {
      item.summary = (ai.summary || []).map(s => clean(s, 500)).slice(0, 8);
      item.key_moments = (ai.key_moments || []).slice(0, 12).map(k => ({ time: clean(k.time, 10), point: clean(k.point, 300) }));
      item.category = clean(ai.category, 30);
      item.sentiment = clean(ai.sentiment, 10);
    } else {
      item.speakers = (ai.speakers || []).map(s => clean(s, 60)).slice(0, 10);
      item.sections = (ai.sections || []).slice(0, 80).map(s => ({
        start: clean(s.start, 10), end: clean(s.end, 10), title: clean(s.title, 200),
        lines: (s.lines || []).slice(0, 200).map(l => ({ speaker: clean(l.speaker, 60), text: clean(l.text, 4000) })),
      }));
    }
    await putJSON(env, key, item);
  }

  const hist = (await getJSON(env, `vh:${user}`, [])).filter(h => !(h.id === id && h.mode === mode));
  hist.unshift({ id, mode, headline: item.headline, channel: item.channel, created: new Date().toISOString() });
  await putJSON(env, `vh:${user}`, hist.slice(0, 50));
  return item;
}
