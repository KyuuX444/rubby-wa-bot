<div align="center">

<img src="public/og-image.png" alt="Rubby WA Bot Banner" width="100%" />

# Rubby WA Bot — Multi-User WhatsApp Bot Manager

**Full-Stack Cloud Platform to Create, Connect, and Manage Isolated Multi-Device WhatsApp Bots**

[![Engine](https://img.shields.io/badge/Engine-ruby--baileys%20v1.5.18-171717?style=for-the-badge)](https://www.npmjs.com/package/ruby-baileys)
[![Backend](https://img.shields.io/badge/Web%20API-TypeScript%20%2B%20Express-171717?style=for-the-badge)](https://nodejs.org/)
[![Bot Runtime](https://img.shields.io/badge/Bot%20Core-JavaScript%20ESM-171717?style=for-the-badge)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-171717?style=for-the-badge)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-NOT%20FOR%20SALE-171717?style=for-the-badge)](./LICENSE)
[![Creator](https://img.shields.io/badge/Creator-Kyuu%20(%40KyuuX444)-171717?style=for-the-badge)](https://github.com/KyuuX444)

</div>

---

> [!IMPORTANT]
> **LISENSI & KETENTUAN PENGGUNAAN (STRICTLY NOT FOR SALE)**
> Source code **Rubby WA Bot** ini dibagikan secara **GRATIS** oleh **Kyuu (`@KyuuX444`)**.
> 1. **DILARANG DIPERJUALBELIKAN (`NOT FOR SALE`)**: Dilarang keras menjual, memperjualbelikan, atau mengkomersialkan source code ini dalam bentuk asli maupun hasil modifikasi.
> 2. **WAJIB MENCANTUMKAN CREATOR ASLI**: Setiap penggunaan, deployment, atau modifikasi **wajib tetap menampilkan atribusi Creator asli (`Kyuu` / `github.com/KyuuX444`)** pada halaman website maupun pada respon menu bot WhatsApp.

## Overview

**Rubby WA Bot** adalah platform full-stack **WhatsApp Bot Manager** berbasis web yang memungkinkan banyak pengguna (multi-user) membuat, menautkan, dan mengelola bot WhatsApp multi-device secara mandiri dengan sesi yang terisolasi penuh.

Sistem ini menggunakan [`ruby-baileys`](https://www.npmjs.com/package/ruby-baileys) secara langsung tanpa bergantung pada layanan API bot pihak ketiga, dilengkapi penyimpanan kredensial Signal berbasis PostgreSQL (`usePostgresAuthState`), streaming WebSocket real-time, autentikasi GitHub OAuth, serta **Sinkronisasi Role Otomatis** antara akun website dan runtime bot WhatsApp.

---

## Web Interface Preview

### 1. Public Landing Page
Halaman utama publik dengan informasi fitur, status server real-time, panduan 3 langkah penautan perangkat, daftar command bawaan, serta FAQ.

![Landing Page Preview](docs/screenshots/landing-page.png)

### 2. Authentication & GitHub Login
Mendukung login via **GitHub OAuth** (Web Flow & Device Flow yang tahan terhadap perpindahan aplikasi di mobile) maupun kredensial akun website yang di-hash menggunakan **Argon2id**.

![Login Page Preview](docs/screenshots/login-page.png)

### 3. Bot Dashboard & 8-Digit Pairing Code
Dashboard kontrol real-time yang menampilkan status koneksi WhatsApp, metrik pesan & command, log aktivitas langsung via WebSocket, serta panel penautan perangkat melalui **8-Digit Pairing Code** (cukup 1 HP) atau **QR Code**.

![Dashboard Page Preview](docs/screenshots/dashboard-page.png)

### 4. Live Bot Configuration (Bot Settings)
Pengaturan nama bot, simbol prefix (`/`, `.`, `!`, `#`), mode akses (`Public` / `Private`), `Auto-Read`, `Auto-Typing`, `Auto-Online`, `Maintenance Mode`, serta manajemen aktivasi command secara langsung tanpa perlu me-restart koneksi WhatsApp.

![Bot Settings Preview](docs/screenshots/settings-page.png)

### 5. Owner Administration Panel
Halaman khusus role `OWNER` untuk memantau statistik global seluruh bot, mengubah role pengguna (`OWNER` ↔ `FREE`) secara instan, me-restart/memutuskan sesi bot pengguna, serta mengelola status akun (`ban` / `unban` / `delete`).

![Owner Panel Preview](docs/screenshots/owner-panel.png)

---

## Key Features

- **Dual WhatsApp Connection Methods (`ruby-baileys`)**
  - **8-Digit Pairing Code**: Tautkan perangkat langsung dari 1 HP hanya dengan memasukkan nomor telepon WhatsApp (`sock.requestPairingCode`).
  - **Real-Time QR Code**: Streaming QR Code langsung melalui WebSocket dengan rotasi otomatis.
- **Automatic Website-to-Bot Role Synchronization**
  - Role pengguna disimpan secara terpusat di PostgreSQL (`OWNER` atau `FREE`).
  - Perubahan role di website langsung diterapkan pada command handler bot WhatsApp saat itu juga tanpa perlu menghubungkan ulang sesi.
- **Multi-User Session Isolation**
  - Setiap user ID (`#1001+`) memiliki instance socket `ruby-baileys` tersendiri dan penyimpanan kunci enkripsi Signal terisolasi di tabel PostgreSQL `baileys_auth`.
  - Dilengkapi auto-recovery sesi saat server dimulai ulang (`recoverPersistedSessions`).
- **Interactive `ButtonV2` Menu (`RUBBY MULTI DEVICE`)**
  - Menu interaktif menggunakan komponen `ButtonV2` dari `ruby-baileys` dengan daftar pilihan kategori (`single_select`), gambar thumbnail terkompresi via `sharp`, serta tombol cepat (`quick_reply` & `cta_url`).
- **Hardened Web Security**
  - Password hashing menggunakan **Argon2id**.
  - Sesi autentikasi menggunakan cookie `HttpOnly`, `Secure`, `SameSite=Lax` + validasi token **CSRF (`X-CSRF-Token`)**.
  - Injeksi otomatis **Subresource Integrity (`integrity="sha384-..."`)** pada seluruh bundle aset produksi.
  - Konfigurasi penuh header keamanan **Content-Security-Policy (CSP)**, **Permissions-Policy**, **Strict-Transport-Security (HSTS)**, dan **X-Frame-Options: DENY**.

---

## Architecture & Directory Structure

Sesuai spesifikasi arsitektur, **Engine Bot WhatsApp** ditulis menggunakan **JavaScript (`.js`, ESM)** sedangkan **Web Backend API & Frontend Dashboard** ditulis menggunakan **TypeScript (`.ts` / `.tsx`)**.

```text
jadibot/
├── deploy/
│   └── nginx.conf                  # Konfigurasi reverse proxy Nginx + WebSocket + Security Headers
├── docs/
│   └── screenshots/                # Screenshot preview web hasil tangkapan Playwright
├── media/
│   └── thumb.jpg                   # Gambar thumbnail untuk menu interaktif ButtonV2
├── public/                         # Aset statis, Favicon SVG, Web Manifest & OpenGraph Banner
├── src/
│   ├── bot/                        # WhatsApp Bot Engine (Pure JavaScript ESM)
│   │   ├── sessionManager.js       # Multi-user socket manager, QR, 8-digit Pairing & Auto-Reconnect
│   │   ├── botRuntime.js           # Event listener pesan masuk, auto-read, auto-typing & counter
│   │   ├── commandHandler.js       # Eksekutor command & integrasi permission
│   │   ├── menuHandler.js          # Generator menu interaktif ButtonV2 Rubby Multi Device
│   │   └── roleAuth.js             # Middleware otorisasi role langsung dari PostgreSQL
│   ├── server/                     # Web Backend API (TypeScript + Express + WebSocket)
│   │   ├── db/
│   │   │   ├── pool.ts             # Koneksi pool PostgreSQL
│   │   │   ├── migrate.ts          # Skema tabel & migrasi database otomatis
│   │   │   └── seed.ts             # Seeder akun default OWNER
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts   # Validasi sesi cookie, role & CSRF
│   │   ├── routes/
│   │   │   ├── authRoutes.ts       # Register, Login, GitHub OAuth & Reset Password
│   │   │   ├── botRoutes.ts        # Endpoint kontrol koneksi QR/Pairing, Settings & Logs
│   │   │   └── ownerRoutes.ts      # Endpoint manajemen global khusus OWNER
│   │   ├── services/
│   │   │   ├── realtimeHub.ts      # WebSocket server terautentikasi per user
│   │   │   └── loggerService.ts    # Pencatatan log aktivitas real-time ke PostgreSQL & WS
│   │   └── index.ts                # Entry point server HTTP, Helmet, SRI & static serving
│   ├── client/                     # Web Frontend (TypeScript + React 18 + Tailwind CSS)
│   │   ├── components/             # Layout sidebar, header & RubbyLogo SVG
│   │   ├── context/                # AuthContext & auto-reconnecting WebSocket client
│   │   ├── pages/                  # LandingPage, AuthPages, DashboardPage, SettingsPage, OwnerPage
│   │   └── App.tsx                 # Routing & route guards (ProtectedRoute, OwnerRoute, GuestRoute)
│   └── shared/
│       └── types.ts                # Tipe data bersama antara backend dan frontend
├── ecosystem.config.cjs            # Konfigurasi process manager PM2
└── package.json
```

---

## Built-In Bot Commands

| Command | Minimum Role | Deskripsi |
| :--- | :---: | :--- |
| `/menu` | `FREE` | Menampilkan menu interaktif **Rubby Multi Device** (`ButtonV2` single-select & quick-reply). |
| `/ping` | `FREE` | Mengukur kecepatan respon bot dan latensi pesan dalam milidetik (`ms`). |
| `/runtime` | `FREE` | Menampilkan waktu aktif (uptime) sesi WhatsApp, uptime server, dan penggunaan memori. |
| `/profile` | `FREE` | Menampilkan JID pengirim, nomor WhatsApp, dan sinkronisasi role akun website. |
| `/status` | `FREE` | Menampilkan konfigurasi bot aktif, mode akses, serta statistik pesan dan command. |
| `/groupinfo` | `FREE` | Menampilkan nama grup, jumlah anggota, daftar admin, dan deskripsi grup WhatsApp. |
| `/owner` | `OWNER` | Command khusus pemilik platform (`/owner stats`, `/owner maintenance on\|off`). |

---

## Quick Start & Installation

### 1. Prerequisites
- **Node.js** `>= 20.x`
- **PostgreSQL** `>= 14.x`

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration (`.env`)
Salin `.env.example` menjadi `.env` lalu sesuaikan konfigurasi database dan aplikasi:

```env
PORT=3000
APP_URL=http://localhost:3000
DATABASE_URL=postgres://jadibot:jadibot_secure_pwd_2026@127.0.0.1:5432/jadibot_db
SESSION_SECRET=replace_with_64_char_random_hex_secret
SESSION_TTL_HOURS=72
CUSTOM_PAIRING_CODE=KYUUAPIS

DEFAULT_OWNER_USERNAME=admin
DEFAULT_OWNER_EMAIL=admin@jadibot.local
DEFAULT_OWNER_PASSWORD=ChangeMeImmediately123!
```

### 4. Run Database Migration & Seed
```bash
npm run db:migrate
```

### 5. Build & Start Production Server
```bash
npm run build
npm start
```

Untuk menjalankan di latar belakang menggunakan **PM2**:
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

---

## License & Creator Attribution

Proyek ini dilisensikan di bawah **[RUBBY WA BOT NON-COMMERCIAL & CREATOR ATTRIBUTION LICENSE (NOT FOR SALE)](./LICENSE)**:
- **Strictly Not For Sale**: Source code ini 100% gratis dan tidak boleh diperjualbelikan dengan alasan apa pun.
- **Mandatory Creator Credit**: Wajib mempertahankan nama dan atribusi Creator asli (**Kyuu / `@KyuuX444`**) pada tampilan website dan bot.

---

## Developer Info

- **Creator**: [Kyuu (`@KyuuX444`)](https://github.com/KyuuX444)
- **Website**: [https://api.kyzzz.xyz](https://api.kyzzz.xyz)
- **Official WhatsApp Channel**: [Rubby Updates & Announcements](https://whatsapp.com/channel/0029VbDXYlKDJ6H1D7Dm0f13)
