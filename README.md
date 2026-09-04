# ทำเนียบฟาร์มทุเรียน (Durian Farm Directory)

ระบบทะเบียนสวนทุเรียนพร้อมการตรวจสอบย้อนกลับ — รายชื่อและอันดับสวน รีวิว
ทะเบียนต้นไม้รายต้น ประวัติการดูแล ใบรับรอง (GAP / GI / อื่น ๆ)
และระบบยื่นคำขอขึ้นทะเบียนสวนที่มีแอดมินเป็นผู้อนุมัติ

- **ฝั่งเว็บ** React 19 + Vite 6 + Tailwind 4
- **ฝั่ง API** Express 4 + PostgreSQL 17 (`pg` ตรง ๆ ไม่มี ORM)
- **การยืนยันตัวตน** JWT ใน httpOnly cookie เซ็นฝั่ง server เท่านั้น
  รองรับล็อกอินด้วยรหัสผ่าน, Google และ Facebook

---

## 1. ต้องมีอะไรก่อน

| อย่าง | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Node.js | 22 LTS ขึ้นไป | eslint 10 กับ vitest 4 ต้องการ Node `^20.19` / `^22.13` / `>=24` |
| Docker Desktop | ล่าสุด | ใช้รัน Postgres ตาม `docker-compose.yml` |
| npm | มากับ Node | repo มี `bun.lock` ติดมาด้วยแต่ **ให้ใช้ npm** — `package-lock.json` คือตัวจริง |

ไม่อยากใช้ Docker ก็ได้ แต่ต้องติดตั้ง PostgreSQL 17 เอง สร้างฐานข้อมูล
แล้วรันไฟล์ใน `migrations/` เรียงตามลำดับเลขด้วยมือ (ดูหัวข้อ 7)

---

## 2. เริ่มใช้งาน

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d
```

```bash
npm run dev
```

เปิด http://localhost:3000

| บริการ | พอร์ต |
|---|---|
| เว็บ (Vite) | 3000 |
| API (Express) | 3001 |
| PostgreSQL | **5433** (ไม่ใช่ 5432 — จงใจเลี่ยงการชนกับ Postgres ตัวอื่นในเครื่อง) |

Vite proxy ทุก request ที่ขึ้นต้นด้วย `/api` ไปให้ Express เบราว์เซอร์จึงเห็นเป็น
origin เดียวกัน ไม่ต้องตั้ง CORS และ cookie ทำงานได้ปกติ

> **สำคัญ** ให้รันเว็บที่พอร์ต 3000 เสมอ พอร์ตอื่นจะทำให้ล็อกอินด้วย
> Google/Facebook พัง เพราะ origin ที่ลงทะเบียนไว้กับผู้ให้บริการผูกกับพอร์ต

---

## 3. ตัวแปรใน `.env`

`cp .env.example .env` เฉย ๆ **ยังรันไม่ได้** ต้องสร้างค่าลับเองอย่างน้อยสองตัว

### บังคับ

| ตัวแปร | ทำอะไร |
|---|---|
| `DATABASE_URL` | ค่าปริยายตรงกับ `docker-compose.yml` แล้ว ใช้ได้เลย |
| `JWT_SECRET` | ใช้เซ็น token ใครรู้ค่านี้ปลอมตัวเป็นแอดมินได้ |
| `ID_CARD_ENCRYPTION_KEY` | กุญแจเข้ารหัสเลขบัตรประชาชนและรูปบัตรใน `farm_requests` |

`ID_CARD_ENCRYPTION_KEY` ใน `.env.example` เป็นข้อความบอกใบ้ ไม่ใช่กุญแจจริง
**เซิร์ฟเวอร์จะ exit ทันทีถ้ายังไม่เปลี่ยน**

ส่วน `JWT_SECRET` มีค่าปริยายที่รันได้ (`dev_only_secret_change_me_before_production`)
เซิร์ฟเวอร์จึงสตาร์ทผ่าน แต่ค่านี้อยู่ใน git ที่ใคร ๆ ก็อ่านได้ ใช้ได้แค่ตอน dev
**ห้ามใช้บน production เด็ดขาด**

สร้างค่าใหม่ด้วย

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

คำสั่งแรกสำหรับ `JWT_SECRET` คำสั่งที่สองสำหรับ `ID_CARD_ENCRYPTION_KEY`

> `ID_CARD_ENCRYPTION_KEY` ต้องถอด base64 แล้วได้ **32 ไบต์พอดี**
> ถ้ากุญแจหาย ข้อมูลที่เข้ารหัสไว้แล้วกู้กลับไม่ได้เลย และการ "เปลี่ยน" กุญแจ
> มีผลเท่ากับทำกุญแจหาย เพราะยังไม่มีระบบเลือกกุญแจตามเวอร์ชัน
> **ห้ามเปลี่ยนหลังมีข้อมูลจริงแล้ว** และห้ามเก็บไว้ที่เดียวกับไฟล์สำรองฐานข้อมูล
> เพราะถ้าหลุดพร้อมกันก็เท่ากับไม่ได้เข้ารหัส

### ควรตั้งตอน dev

| ตัวแปร | ค่าแนะนำ | ทำไม |
|---|---|---|
| `RATE_LIMIT_ALLOW_LOOPBACK` | `true` | ยกเว้น rate limit ให้ localhost — smoke test สมัครสมาชิกรอบละ 3 คน รันไม่กี่รอบก็ชนเพดาน 20 ครั้ง/ชม. |
| `CARE_LOG_API_KEY` | ค่าสุ่มอะไรก็ได้ | กุญแจให้ระบบของสวนยิงประวัติการดูแลเข้ามา (header `x-api-key`) |
| `API_PORT` | ไม่ต้องตั้ง | ปริยาย 3001 ถ้าเปลี่ยน Vite proxy ตามไปเอง |

### ไม่ต้องสนใจ

`GEMINI_API_KEY` และ `APP_URL` ใน `.env.example` เป็นเศษที่ติดมาจาก template
ของ Google AI Studio **ไม่มีโค้ดตัวไหนอ่านค่าสองตัวนี้** ปล่อยไว้หรือลบทิ้งก็ได้

---

## 4. ล็อกอินด้วย Google / Facebook (ไม่บังคับ)

ข้ามได้ ถ้าไม่ตั้งค่า ปุ่มทั้งสองจะแสดงเป็นสถานะปิดใช้งาน
ส่วนอื่นของระบบยังทำงานปกติ และล็อกอินด้วยรหัสผ่านยังใช้ได้

credential ของโปรเจกต์เดิมใช้ร่วมกันไม่ได้ ต้องสร้างของตัวเอง

### Google

1. สร้าง OAuth 2.0 Client ID ชนิด **Web application** ที่
   https://console.cloud.google.com/apis/credentials
2. ตั้ง **Authorized JavaScript origins** เป็น `http://localhost:3000`
   (ตอน dev) และโดเมนจริงตอน production
3. ใส่ค่าเดียวกันทั้งสองตัวใน `.env` — ฝั่ง server ใช้ verify ฝั่งเบราว์เซอร์ใช้เรนเดอร์ปุ่ม

```
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
VITE_GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
```

flow นี้เป็นแบบ ID token ใช้แค่ Client ID ไม่ต้องมี client secret และไม่ต้องตั้ง redirect URI

### Facebook

1. สร้างแอปที่ https://developers.facebook.com/apps เพิ่มผลิตภัณฑ์ **Facebook Login**
2. ใส่โดเมนที่โฮสต์ไว้ใน **App Domains** และเปิด **Login with the JavaScript SDK**
   (flow นี้ไม่ redirect จึงไม่ต้องตั้ง Valid OAuth Redirect URIs)
3. ใส่ค่าใน `.env`

```
FACEBOOK_APP_ID="1234567890123456"
FACEBOOK_APP_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
VITE_FACEBOOK_APP_ID="1234567890123456"
```

ต่างจาก Google ตรงที่ต้องมี App Secret ด้วย เพราะฝั่งเว็บ Facebook ให้มาแค่
access token ธรรมดา ไม่มี ID token ที่ verify แบบออฟไลน์ได้ server จึงต้องถาม
Graph API ว่า token นี้ออกให้แอปของเราจริงหรือเปล่า

> `FACEBOOK_APP_SECRET` เป็นความลับจริง **ห้ามใส่ในตัวแปรที่ขึ้นต้นด้วย `VITE_`**
> เพราะทุกอย่างที่ขึ้นต้นด้วย `VITE_` จะถูกฝังลงไปในไฟล์ที่เบราว์เซอร์โหลดได้

ทั้งสองผู้ให้บริการจะผูกบัญชีเข้ากับผู้ใช้เดิมอัตโนมัติเมื่ออีเมลตรงกัน

---

## 5. บัญชีแอดมินและข้อมูลตัวอย่าง

ฐานข้อมูลที่เพิ่งสร้างจะว่างเปล่า ไม่มีบัญชีแอดมินติดมาให้

```bash
npm run seed:demo
```

สร้างสวน ต้นไม้ และรีวิวตัวอย่าง ทุกอย่างมี id ขึ้นต้นด้วย `demo-`
จึงลบออกทีหลังได้หมดโดยไม่แตะข้อมูลจริง (`npm run seed:demo -- --clear`)

จากนั้น **สมัครสมาชิกผ่านหน้าเว็บก่อน** แล้วค่อยเลื่อนสิทธิ์จากเครื่องที่เข้าถึงฐานข้อมูลได้

```bash
npm run make:admin -- ชื่อผู้ใช้
```

> ต้องออกจากระบบแล้วเข้าใหม่หลังรัน เพราะ token เดิมที่อยู่ใน cookie
> ยังถือ role เก่าอยู่ — role อยู่ใน JWT ที่เซ็นฝั่ง server ไม่ได้อ่านสดจากฐานข้อมูล

มีแค่สอง role คือ `user` กับ `admin`

---

## 6. คำสั่งที่ใช้บ่อย

### พัฒนา

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บและ API พร้อมกัน |
| `npm run dev:web` | รันเฉพาะ Vite (พอร์ต 3000) |
| `npm run dev:api` | รันเฉพาะ Express พร้อม watch |
| `npm run build` | build เว็บลง `dist/` |
| `npm run check` | `tsc --noEmit` + eslint — CI รันให้ตอนเปิด PR แต่รันเองก่อน push จะรู้ผลเร็วกว่า |

### ทดสอบ

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | รันทั้งชุด |
| `npm run test:web` | เฉพาะคอมโพเนนต์ React (jsdom) |
| `npm run test:server` | เฉพาะ API — **ต้องมี Postgres รันอยู่** |
| `npm run smoke:api` | ทดสอบ API end-to-end (ต้องรัน `dev:api` ไว้ก่อน) |
| `npm run smoke:farm-requests` | ทดสอบเส้นทางคำขอขึ้นทะเบียนสวนและการอนุมัติ |

ชุดทดสอบฝั่ง server แตะฐานข้อมูล**จริง**ตาม `DATABASE_URL` และรันทีละไฟล์
(`fileParallelism: false`) เพราะข้อมูลทดสอบของแต่ละไฟล์จะชนกันเองถ้ารันขนาน
อย่าชี้ `DATABASE_URL` ไปที่ฐานข้อมูลที่มีข้อมูลจริงตอนรันเทสต์

ก่อนรัน `npm test` ให้ครบทุกข้อ ต้องมีสองอย่างนี้พร้อมก่อน

- **`npm run seed:demo`** — ชุดทดสอบใบรับรองระดับภูมิภาคอ่านโซน GI ที่มีอยู่ก่อน
  ซึ่ง migration ไม่ได้สร้างให้ ฐานข้อมูลที่มีแต่ schema เปล่าจะทำให้สามไฟล์นั้น
  ล้มตั้งแต่ `beforeAll`
- **เซิร์ฟเวอร์ API รันอยู่** (`npm run dev:api`) — `test/api/smoke.test.ts`
  ยิงผ่าน HTTP ไปยังเซิร์ฟเวอร์จริง ไม่ใช่เรียก app ตรงแบบ supertest
  และต้องเป็นเซิร์ฟเวอร์ที่ใช้ `DATABASE_URL` กับ `ID_CARD_ENCRYPTION_KEY`
  ชุดเดียวกับที่รันเทสต์ ไม่งั้นจะเขียนคนละฐานแล้วถอดรหัสไม่ออก

### CI

`.github/workflows/ci.yml` รันตอนเปิดหรืออัปเดต PR ที่จะเข้า `main` แยกเป็นสอง job

| job | ทำอะไร |
|---|---|
| `check` | `npm ci` แล้ว `npm run check` |
| `test` | ตั้ง Postgres 17 รัน migration ทั้งหมด `seed:demo` เปิด API แล้ว `npm test` |

> Vercel ที่ต่อไว้กับ repo อยู่แล้วรันแค่ `vite build` ซึ่ง esbuild ทิ้ง type ไปเฉย ๆ
> **ไม่ typecheck และไม่ lint** เห็น Vercel ขึ้นเขียวจึงไม่ได้แปลว่าโค้ดผ่าน `npm run check`

### จัดการข้อมูลและบัญชี

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run list-users` | ดูบัญชีทั้งหมดพร้อมสิทธิ์และสิ่งที่ผูกอยู่ |
| `npm run set-password -- ชื่อผู้ใช้` | ตั้งรหัสผ่านใหม่ (รับทาง prompt ไม่ติด shell history) |
| `npm run delete-user -- ชื่อผู้ใช้` | ดูผลกระทบก่อน เติม `--confirm` เพื่อลบจริง |
| `npm run seed:demo` | สร้าง/ล้างข้อมูลตัวอย่าง |
| `npm run import:care-logs -- ไฟล์.json` | นำประวัติการดูแลเข้าระบบผ่าน API จริง (`--demo` สร้างตัวอย่าง) |
| `npm run purge:rejected` | ล้าง PII ของคำขอที่ถูกปฏิเสธเกินกำหนดเก็บ (เซิร์ฟเวอร์ทำเองทุก 24 ชม. อยู่แล้ว) |

---

## 7. ฐานข้อมูลและ migration

### กับดักที่ต้องรู้ก่อน

`docker-compose.yml` ผูก `./migrations` ไว้กับ `/docker-entrypoint-initdb.d`
ซึ่ง Postgres จะไล่รันทุกไฟล์ตามลำดับชื่อ **"เฉพาะตอนสร้าง volume ครั้งแรก"** เท่านั้น

แปลว่าถ้าเคย `docker compose up` ไปแล้ว ค่อย `git pull` เอา migration ใหม่มา
**มันจะไม่ถูกรันให้เอง** ต้องรันด้วยมือ

```bash
docker exec -i duritrack-postgres psql -U duritrack -d duritrack -f /dev/stdin < migrations/017_facebook_provider.sql
```

หรือถ้ายอมทิ้งข้อมูลได้ (ลบ volume แล้วสร้างใหม่ ทุก migration จะถูกรันครบ)

```bash
docker compose down -v && docker compose up -d
```

ตอนสตาร์ท เซิร์ฟเวอร์จะตรวจว่าตารางที่จำเป็นมีครบไหม ถ้าขาดจะ **บอกชื่อตารางที่ขาด**
แล้ว exit ถ้าเห็นข้อความนี้แปลว่า migration ยังไม่ครบ ให้ย้อนกลับไปดูสองคำสั่งข้างบน

### ไฟล์ใน `scripts/sql/` ไม่ใช่ migration ปกติ

เลข 007, 009, 010 ถูกวางไว้นอก `migrations/` **โดยตั้งใจ** เพราะเป็น data
migration ที่ต้องรันด้วยมือตามจังหวะ ไม่ใช่ตอนสร้างฐานข้อมูลเปล่า

| ไฟล์ | ทำอะไร | ปลอดภัยไหม |
|---|---|---|
| `007_drop_legacy_plaintext.sql` | ลบคอลัมน์และตารางรูปแบบเดิมทิ้ง | **ทำลายข้อมูล ย้อนกลับไม่ได้** มียามกันไว้ ถ้ายังมีข้อมูลที่ไม่ได้เข้ารหัสจะ rollback ทั้งก้อน |
| `009_gi_to_regional.sql` | ย้ายใบ GI ไปตาราง `regional_certifications` | รันซ้ำได้ ไม่ทำลายข้อมูล |
| `010_backfill_missing_certs.sql` | เก็บตกใบรับรองที่ยังไม่มีคู่ในตาราง `certifications` | รันซ้ำได้ ไม่ทำลายข้อมูล |

ฐานข้อมูลที่สร้างใหม่จากศูนย์ **ยังไม่ได้รันสามไฟล์นี้** ซึ่งถูกต้องแล้ว —
ไม่มีข้อมูลเก่าให้ย้าย ให้รันเฉพาะเมื่อกำลังอัปเกรดฐานข้อมูลที่มีข้อมูลเดิมอยู่จริง
อ่านหมายเหตุด้านบนของแต่ละไฟล์ก่อนรันเสมอ โดยเฉพาะ 007 ที่มีเงื่อนไข 4 ข้อต้องครบก่อน

---

## 8. โครงสร้างโปรเจกต์

```
src/                 เว็บฝั่ง React
  components/        คอมโพเนนต์ UI
  context/           auth context และ state ที่ใช้ร่วมกัน
  services/          ตัวเรียก API
  shared/            โค้ดที่ใช้ทั้งฝั่งเว็บและฝั่ง server
server/
  index.ts           จุดเริ่ม Express ประกอบ middleware และ mount router
  db.ts              connection pool และ assertDbReady
  routes/            endpoint แยกตามโดเมน
  middleware/        auth (JWT) และ rate limit
  oauth/             ตรวจ token จาก Facebook
  security/          เข้ารหัสเลขบัตรประชาชน และ log การเปิดดู
  jobs/              งานตามเวลา (ล้าง PII ของคำขอที่ถูกปฏิเสธ)
migrations/          schema migration รันอัตโนมัติตอนสร้าง DB ครั้งแรก
scripts/             เครื่องมือใช้มือ + scripts/sql/ สำหรับ data migration
test/api/            เทสต์ API ที่แตะฐานข้อมูลจริง
```

endpoint หลักที่ mount ไว้

```
/api/auth                      สมัคร เข้าสู่ระบบ ออกจากระบบ Google Facebook
/api/farms                     ข้อมูลสวน
/api/trees                     ทะเบียนต้นไม้
/api/farm-requests             คำขอขึ้นทะเบียนสวนและการอนุมัติ
/api/certification-types       ประเภทใบรับรอง
/api/regional-certifications   ใบรับรองระดับภูมิภาค (GI)
/api/care-logs                 ประวัติการดูแล
/api/data-retention            บันทึกการล้างข้อมูลตามนโยบายเก็บรักษา
/api/health                    health check
```

เพดานขนาด body แยกตามเส้นทาง — `/api/farm-requests`, `/api/farms`,
`/api/care-logs` รับได้ 10mb (แนบไฟล์เป็น base64) ที่เหลือ 256kb

---

## 9. ก่อนขึ้น production

- [ ] เปลี่ยน `JWT_SECRET` และ `ID_CARD_ENCRYPTION_KEY` เป็นค่าสุ่มของ production
      และเก็บ**คนละที่**กับไฟล์สำรองฐานข้อมูล
- [ ] `NODE_ENV=production` — เปิด `COOKIE_SECURE` ให้เอง และปิดการยกเว้น
      rate limit ให้ loopback ไม่ว่าตั้งค่าไว้ยังไง
- [ ] ตั้ง `TRUST_PROXY` **เฉพาะเมื่อมี reverse proxy จริง** ใส่จำนวน hop เช่น `1`
      ถ้าไม่มี proxy แล้วตั้ง ใครก็ปลอม `X-Forwarded-For` เพื่อเลี่ยง rate limit ได้ทันที
      แต่ถ้ามี proxy แล้วไม่ตั้ง ทุกคนจะใช้โควตา rate limit ร่วมกันก้อนเดียว
- [ ] `RATE_LIMIT_ALLOW_LOOPBACK` ต้องไม่เปิด
- [ ] เพิ่ม origin จริงใน Google OAuth และ Facebook App Domains
- [ ] ตรวจว่า migration ครบทุกไฟล์ (ดูหัวข้อ 7 — volume เดิมไม่รันให้อัตโนมัติ)

---

## 10. ข้อควรรู้เรื่องข้อมูลส่วนบุคคล

repo นี้เป็น public แต่ระบบเก็บข้อมูลบัตรประชาชนของเกษตรกร `.gitignore`
กันไฟล์เหล่านี้ไว้แล้ว **อย่าแก้ให้หลุด**

- `.env*` (ยกเว้น `.env.example`)
- `backup/` — dump จาก Firestore มี password hash และอีเมลผู้ใช้จริง
- `/*.sql`, `*.dump`, `*.dump.sql` ที่ราก — dump ฐานข้อมูล
  (เครื่องหมาย `/` นำหน้าจำกัดกฎไว้ที่รากเท่านั้น `migrations/` กับ
  `scripts/sql/` จึงไม่ถูกกระทบ ซึ่งเป็นที่เดียวที่ไฟล์ `.sql` ควรอยู่)

เลขบัตรและรูปบัตรถูกเข้ารหัสในฐานข้อมูล การเปิดดูถูกบันทึกไว้ในตาราง log
และ PII ของคำขอที่ถูกปฏิเสธจะถูกล้างอัตโนมัติเมื่อพ้นกำหนดเก็บรักษา
