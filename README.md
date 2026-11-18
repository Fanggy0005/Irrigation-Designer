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
