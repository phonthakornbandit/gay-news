# GAY News

เว็บสรุปข่าวส่วนตัว: เลือกหัวข้อ → AI สรุปข่าวจากหลายสำนัก, ติดตามเรื่อง (ไทม์ไลน์/5W1H), สรุปและถอดคำพูดคลิป YouTube

- `index.html` — หน้าเว็บ (GitHub Pages)
- `worker/` — Cloudflare Worker (ซ่อน API key, ดึงข่าว Google News RSS, เรียก Gemini API, เก็บข้อมูลใน KV)

## ตั้งค่า
1. Cloudflare → KV → สร้าง namespace `NEWS` → ใส่ ID ใน `worker/wrangler.toml`
2. Cloudflare → Workers → Import repository นี้ (Root directory: `worker`)
3. Worker → Settings → Variables and Secrets: `GEMINI_API_KEY` (ไม่บังคับ: `DAILY_LIMIT` เพดานเรียก AI ต่อวัน ค่าเริ่มต้น 300)
4. ใส่ที่อยู่ Worker ใน `WORKER_URL` บรรทัดบนสุดของสคริปต์ใน `index.html`
5. GitHub → Settings → Pages → Deploy from branch `main` / root

สรุปและถอดความโดย AI อาจคลาดเคลื่อน ตรวจกับแหล่งต้นทางก่อนอ้างอิง
