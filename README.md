# Irrigation Designer

เว็บแอปออกแบบระบบน้ำสวนไม้ผลบนแผนที่ คำนวณขนาดท่อ แรงดัน และปั๊ม พร้อมรายการวัสดุ ขอบเขตและหลักการออกแบบอยู่ที่ [docs/SCOPE.md](docs/SCOPE.md)

Laravel 12 + Inertia + React + TypeScript + Tailwind, แผนที่ใช้ Leaflet + OpenStreetMap

## เริ่มพัฒนา

ต้องมี PHP 8.3+, Composer และ Node 22+

```sh
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate        # ใช้ SQLite ที่ database/database.sqlite

composer run dev           # Laravel + queue + Vite พร้อมกัน แล้วเปิด http://localhost:8000
```

## รันด้วย Podman

ไม่ต้องติดตั้ง PHP หรือ Composer บนเครื่อง ต้องมี Podman 5 (`podman machine start`), `podman-compose` และไฟล์ `.env` (คัดลอกจาก `.env.example` แล้ว `APP_KEY` ต้องมีค่า)

```sh
podman compose up -d --build           # ครั้งแรกใช้เวลาหลายนาที (build image, composer install, npm ci, migrate)
podman compose logs -f app vite        # พร้อมเมื่อเห็น "Server running" และ "VITE ... ready"
```

แล้วเปิด http://localhost:8001 บัญชีทดสอบคือ `test@example.com` รหัสผ่าน `password`

| Service | ทำอะไร | Port บนเครื่อง |
|---|---|---|
| `app` | Laravel (PHP 8.3, `php artisan serve`) | http://localhost:8001 |
| `vite` | Vite dev server (Node 22) | http://localhost:5174 |

ใช้ port 8001 และ 5174 เพื่อไม่ชนกับโปรเจกต์อื่นที่ใช้ 8000 และ 5173 ทุก port เปิดเฉพาะ `127.0.0.1`

```sh
podman compose stop                              # หยุด (ข้อมูลยังอยู่)
podman compose up -d                             # เปิดอีกครั้ง
podman compose exec app php artisan tinker       # คำสั่ง artisan
podman compose exec app php artisan migrate:fresh --seed   # ล้างฐานข้อมูล
podman compose down -v                           # ลบ container และ volume ทั้งหมด
```

- ฐานข้อมูล SQLite ของ container อยู่ใน volume `db-data` แยกจาก `database/database.sqlite` บนเครื่อง เพราะการล็อกไฟล์ของ SQLite ผ่าน mount ของ Windows ไม่น่าเชื่อถือ
- `vendor/` และ `node_modules/` ใน container อยู่ใน volume แยก container จะ `composer install` หรือ `npm ci` ใหม่เองเมื่อ lock file เปลี่ยน
- Vite ใน container ตรวจการแก้ไฟล์ทุก 1 วินาที เพราะ event การแก้ไฟล์ไม่ข้ามจาก Windows เข้า container
- อย่ารันพร้อม `composer run dev` บนเครื่อง เพราะใช้ไฟล์ `public/hot` ร่วมกัน ถ้า container ถูก kill แล้วหน้าเว็บบนเครื่องโหลด asset ไม่ขึ้น ให้ลบ `public/hot`

## ตรวจโค้ด

```sh
npm run types              # TypeScript
npm run lint:check
npm run format:check
npm test                   # Vitest (resources/js/**/*.test.ts)
php artisan test           # Pest
vendor/bin/pint --test
```

CI (`.github/workflows/ci.yml`) รันทุกคำสั่งข้างบนนี้
