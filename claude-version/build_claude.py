"""สร้าง GAY News เวอร์ชัน claude.ai จาก index.html ตัวเดียวกับเว็บหลัก
ใช้: python3 build_claude.py <index.html> <backend-claude.js> <output.html>
หน้าตาเหมือนเว็บหลักทุกอย่าง ต่างกันแค่ "หลังบ้าน" (window.GN_BACKEND) ที่ใช้ Claude + ที่เก็บข้อมูลของ claude.ai + Parallel Search
"""
import re, sys
src, backend, out = sys.argv[1:4]
h = open(src, encoding="utf-8").read()
be = open(backend, encoding="utf-8").read()

head = h[h.index("<head>") + 6:h.index("</head>")]
body = h[h.index("<body>") + 6:h.index("</body>")]
head = re.sub(r'<meta charset="UTF-8">\s*', "", head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', "", head)
head = re.sub(r'<meta name="theme-color"[^>]*>\s*', "", head)
head = head.replace("<title>GAY News</title>", '<title>GAY News</title>\n<meta name="claude:viewport-fit-sides" content="cover">')
head = head.replace("</style>", ".topbar{top:env(safe-area-inset-top,0px)}\nbody::before{content:\"\";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:16;background:var(--bar)}\n</style>")
i = body.index("<script>")
body = body[:i] + "<script>\n" + be + "\n</script>\n" + body[i:]
open(out, "w", encoding="utf-8").write(head + body)
print("ok", len(head + body))
