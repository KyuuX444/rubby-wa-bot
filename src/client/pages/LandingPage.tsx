import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  QrCode,
  Hash,
  Shield,
  Cpu,
  Layers,
  Check,
  Github,
  Globe,
  Radio,
  Lock,
  Sliders,
  Database,
  Activity,
  ChevronRight,
  Smartphone,
  HelpCircle,
} from 'lucide-react';
import { RubbyLogo } from '../components/RubbyLogo';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface PublicStats {
  engine: string;
  uptimeSeconds: number;
  totalUsers: number;
  connectedSessions: number;
  totalMessages: number;
  totalCommands: number;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${rem}s`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PublicStats>({
    engine: 'ruby-baileys v1.5.18',
    uptimeSeconds: 0,
    totalUsers: 1,
    connectedSessions: 0,
    totalMessages: 0,
    totalCommands: 0,
  });

  useEffect(() => {
    apiRequest<PublicStats>('/api/public/stats')
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const demoCodeChars = ['R', 'U', 'B', 'Y', '2', '0', '2', '6'];

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#171717] flex flex-col selection:bg-[#171717] selection:text-white">
      <header className="sticky top-0 z-40 h-16 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <RubbyLogo className="w-9 h-9 transition-transform group-hover:scale-[1.03]" />
            <div>
              <span className="font-semibold text-[15px] tracking-tight text-[#171717] block leading-none">
                Rubby WA Bot
              </span>
              <span className="text-[11px] font-mono text-[#666666] mt-0.5 block">
                WhatsApp Bot Cloud Manager
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#666666]">
            <a href="#cara-kerja" className="hover:text-[#171717] transition-colors">
              Cara Kerja
            </a>
            <a href="#fitur" className="hover:text-[#171717] transition-colors">
              Fitur Utama
            </a>
            <a href="#commands" className="hover:text-[#171717] transition-colors">
              Daftar Command
            </a>
            <a href="#faq" className="hover:text-[#171717] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium transition-colors"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-[10px] text-xs font-medium text-[#171717] hover:bg-[#F7F8FA] border border-[#EAEAEA] sm:border-transparent hover:border-[#EAEAEA] transition-colors"
                >
                  Masuk
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium transition-colors"
                >
                  <span>Daftar Gratis</span>
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#EAEAEA] bg-gradient-to-b from-[#FFFFFF] to-[#F7F8FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFFFFF] border border-[#EAEAEA] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <span className="w-2 h-2 rounded-full bg-[#171717]" />
                <span className="text-[11px] font-mono font-semibold tracking-wide text-[#171717] uppercase">
                  Multi-Device WhatsApp Platform • 24/7 Cloud Active
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#171717] leading-[1.14]">
                Buat &amp; Kelola Bot WhatsApp Langsung dari Browser Anda.
              </h1>

              <p className="text-sm sm:text-base text-[#666666] leading-relaxed max-w-2xl">
                Platform publik untuk membuat, menautkan, dan mengelola bot WhatsApp multi-device
                tanpa perlu sewa VPS sendiri. Hubungkan nomor Anda dengan mudah menggunakan{' '}
                <strong className="text-[#171717]">8-Digit Pairing Code</strong> (cukup 1 HP) atau{' '}
                <strong className="text-[#171717]">Scan QR Code</strong> secara real-time.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={user ? '/dashboard' : '/register'}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#171717] hover:bg-[#262626] text-white text-xs sm:text-sm font-medium transition-colors shadow-sm"
                >
                  <span>{user ? 'Masuk ke Dashboard Bot' : 'Buat Bot Sekarang — Gratis'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {!user && (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#171717] border border-[#EAEAEA] text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>Login dengan GitHub</span>
                  </Link>
                )}

                <a
                  href="#cara-kerja"
                  className="inline-flex items-center gap-1.5 px-3 py-3 rounded-[10px] text-xs sm:text-sm font-medium text-[#666666] hover:text-[#171717] transition-colors"
                >
                  <span>Lihat Cara Kerja</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              <div className="pt-5 grid grid-cols-3 gap-4 border-t border-[#EAEAEA] max-w-lg">
                <div>
                  <div className="text-xs font-mono font-semibold text-[#171717]">
                    Cukup 1 HP
                  </div>
                  <div className="text-[11px] text-[#666666] mt-0.5">
                    8-Digit Pairing Code
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold text-[#171717]">
                    Aktif 24/7
                  </div>
                  <div className="text-[11px] text-[#666666] mt-0.5">
                    Jalan Tanpa Buka Web
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono font-semibold text-[#171717]">
                    Sesi Terisolasi
                  </div>
                  <div className="text-[11px] text-[#666666] mt-0.5">
                    Aman &amp; Multi-User
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#171717]" />
                    <span className="font-mono text-xs font-semibold text-[#171717]">
                      RUBBY MULTI DEVICE
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#171717] text-white font-mono text-[10px] font-semibold">
                    ONLINE • 24/7
                  </span>
                </div>

                <div className="p-4 rounded-[12px] bg-[#F7F8FA] border border-[#EAEAEA] space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#171717] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>8-DIGIT PAIRING CODE</span>
                    </span>
                    <span className="font-mono text-[#666666]">INSTANT LINK</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 py-1">
                    {demoCodeChars.map((ch, i) => (
                      <React.Fragment key={i}>
                        {i === 4 && (
                          <span className="font-mono font-bold text-[#666666] px-0.5">-</span>
                        )}
                        <div className="w-8 h-10 sm:w-9 sm:h-11 rounded-[8px] bg-[#FFFFFF] border border-[#171717] flex items-center justify-center font-mono text-sm sm:text-base font-bold text-[#171717]">
                          {ch}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <p className="text-[11px] text-center text-[#666666]">
                    Tautkan perangkat cukup dengan memasukkan nomor WhatsApp Anda
                  </p>
                </div>

                <div className="rounded-[12px] bg-[#171717] text-white p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-[#999999] pb-2 border-b border-white/10">
                    <span>Interactive Menu Preview</span>
                    <span>ButtonV2 Flow</span>
                  </div>
                  <div className="text-[#A3A3A3]">
                    User: <span className="text-white">/menu</span>
                  </div>
                  <div className="pl-2.5 border-l-2 border-white/30 space-y-1 text-[11px]">
                    <div className="text-white font-semibold">
                      ✦ WELCOME TO RUBBY MULTI DEVICE ✦
                    </div>
                    <div className="text-[#CCCCCC]">
                      • Pilihan Kategori Interaktif (Single Select)
                    </div>
                    <div className="text-[#CCCCCC]">
                      • Auto-Read, Auto-Typing &amp; Custom Prefix
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#666666] pt-1">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#171717]" />
                    <span>Real-Time WebSocket Dashboard</span>
                  </span>
                  <span className="font-mono">Isolated Session</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#EAEAEA] bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-[#171717]" />
              </div>
              <div>
                <div className="text-[11px] text-[#666666]">WhatsApp Engine</div>
                <div className="text-sm font-mono font-semibold text-[#171717]">
                  {stats.engine}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4 text-[#171717]" />
              </div>
              <div>
                <div className="text-[11px] text-[#666666]">Metode Penautan</div>
                <div className="text-sm font-mono font-semibold text-[#171717]">
                  8-Digit Code &amp; QR
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-[#171717]" />
              </div>
              <div>
                <div className="text-[11px] text-[#666666]">Server Uptime</div>
                <div className="text-sm font-mono font-semibold text-[#171717]">
                  {formatDuration(stats.uptimeSeconds)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 text-[#171717]" />
              </div>
              <div>
                <div className="text-[11px] text-[#666666]">Total Pengguna</div>
                <div className="text-sm font-mono font-semibold text-[#171717]">
                  {stats.totalUsers} Workspace Terdaftar
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="py-20 bg-[#F7F8FA] border-b border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Panduan Singkat
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
              Aktifkan Bot WhatsApp Anda dalam 3 Langkah
            </h2>
            <p className="mt-2.5 text-sm text-[#666666] leading-relaxed">
              Tidak perlu instalasi rumit atau perangkat kedua. Anda bisa menautkan dan mengelola
              bot langsung dari HP Anda.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <StepCard
              step="01"
              title="Buat Akun atau Login GitHub"
              description="Daftar akun gratis menggunakan email/username atau masuk secara instan dengan akun GitHub Anda."
            />
            <StepCard
              step="02"
              title="Masukkan 8-Digit Pairing Code"
              description="Buka Dashboard, masukkan nomor WhatsApp Anda, lalu salin 8-digit kode pairing ke menu Perangkat Tertaut di WhatsApp."
            />
            <StepCard
              step="03"
              title="Bot Siap Berjalan 24/7"
              description="Ketik /menu di WhatsApp untuk mencoba menu interaktif. Atur nama bot, prefix, dan fitur otomatis kapan saja dari dashboard."
            />
          </div>
        </div>
      </section>

      <section id="fitur" className="py-20 bg-[#FFFFFF] border-b border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Fitur Unggulan
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
              Dirancang untuk Kecepatan, Kestabilan, dan Kemudahan Penggunaan.
            </h2>
            <p className="mt-2.5 text-sm text-[#666666] leading-relaxed">
              Setiap pengguna mendapatkan ruang kerja (workspace) dan koneksi bot yang terisolasi
              sepenuhnya sehingga aman dan tidak saling mengganggu.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Hash}
              title="8-Digit Pairing Code (1 HP)"
              description="Hubungkan WhatsApp cukup dengan memasukkan nomor telepon Anda tanpa perlu memindai QR dari HP lain."
            />
            <FeatureCard
              icon={QrCode}
              title="Real-Time QR Code Stream"
              description="Tersedia juga opsi pemindaian QR Code secara real-time melalui WebSocket yang diperbarui otomatis."
            />
            <FeatureCard
              icon={Layers}
              title="Menu Interaktif ButtonV2"
              description="Dilengkapi tampilan menu Rubby Multi Device dengan tombol interaktif daftar pilihan (single-select) dan thumbnail."
            />
            <FeatureCard
              icon={Sliders}
              title="Konfigurasi Bot Langsung"
              description="Ubah nama bot, prefix command, mode Public/Private, Auto-Read pesan, Auto-Typing, dan status Online tanpa perlu menghubungkan ulang."
            />
            <FeatureCard
              icon={Shield}
              title="Sinkronisasi Role Otomatis"
              description="Role akun website Anda otomatis tersinkronisasi dengan sistem perizinan command bot secara langsung."
            />
            <FeatureCard
              icon={Lock}
              title="Penyimpanan Sesi Aman"
              description="Kredensial sesi disimpan secara terisolasi di PostgreSQL sehingga bot otomatis tersambung kembali jika server dimulai ulang."
            />
          </div>
        </div>
      </section>

      <section id="commands" className="py-20 bg-[#F7F8FA] border-b border-[#EAEAEA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
                Command Bawaan
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
                Daftar Command Bot Siap Pakai
              </h2>
            </div>
            <span className="text-xs font-mono text-[#666666]">
              Prefix Bawaan: <strong className="text-[#171717]">/</strong> (Dapat diubah di Bot Settings)
            </span>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                cmd: '/menu',
                role: 'SEMUA USER',
                desc: 'Menampilkan menu interaktif Rubby Multi Device lengkap dengan daftar kategori dan tombol cepat.',
              },
              {
                cmd: '/ping',
                role: 'SEMUA USER',
                desc: 'Mengecek kecepatan respon bot dan latensi koneksi dalam satuan milidetik (ms).',
              },
              {
                cmd: '/runtime',
                role: 'SEMUA USER',
                desc: 'Menampilkan durasi waktu aktif (uptime) sesi WhatsApp dan server bot.',
              },
              {
                cmd: '/profile',
                role: 'SEMUA USER',
                desc: 'Menampilkan informasi nomor WhatsApp pengirim serta status role akun yang terhubung.',
              },
              {
                cmd: '/status',
                role: 'SEMUA USER',
                desc: 'Menampilkan ringkasan konfigurasi bot, jumlah pesan masuk, dan total command dijalankan.',
              },
              {
                cmd: '/groupinfo',
                role: 'SEMUA USER',
                desc: 'Menampilkan informasi lengkap grup WhatsApp, jumlah anggota, dan daftar admin grup.',
              },
            ].map((item) => (
              <div
                key={item.cmd}
                className="p-5 rounded-[12px] bg-[#FFFFFF] border border-[#EAEAEA] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-[#171717]">{item.cmd}</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F7F8FA] text-[#171717] border border-[#EAEAEA]">
                      {item.role}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-[#666666] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-[#FFFFFF] border-b border-[#EAEAEA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Tanya Jawab
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
              Pertanyaan yang Sering Diajukan
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            <FaqItem
              question="Bagaimana cara menghubungkan bot jika saya hanya menggunakan 1 HP?"
              answer="Setelah masuk ke Dashboard, klik Connect WhatsApp dan pilih tab '8-Digit Pairing Code'. Masukkan nomor WhatsApp Anda (contoh: 62812xxxx), salin 8-digit kode yang muncul, lalu buka aplikasi WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon saja. Kode tidak akan hilang atau ter-reset saat Anda berpindah aplikasi."
            />
            <FaqItem
              question="Apakah bot tetap aktif meskipun saya menutup browser atau mematikan HP?"
              answer="Ya. Seluruh sesi bot berjalan di atas cloud server kami secara mandiri (24/7). Anda dapat menutup browser kapan saja setelah status WhatsApp terhubung."
            />
            <FaqItem
              question="Apakah saya bisa mengganti nama bot dan prefix command?"
              answer="Tentu saja. Melalui menu Bot Settings di dashboard, Anda dapat mengatur nama bot, mengganti simbol prefix (seperti /, ., !, #), serta mengaktifkan fitur Auto-Read dan Auto-Typing secara langsung."
            />
            <FaqItem
              question="Apakah akun dan sesi WhatsApp saya aman?"
              answer="Setiap pengguna memiliki sesi yang terisolasi di database PostgreSQL dan dilindungi autentikasi terenkripsi. Pengguna lain tidak dapat melihat log maupun mengontrol sesi bot milik Anda."
            />
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#F7F8FA] border-b border-[#EAEAEA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#171717] text-white rounded-[14px] p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Siap Menghubungkan Bot WhatsApp Anda?
              </h2>
              <p className="text-xs sm:text-sm text-[#A3A3A3] leading-relaxed">
                Buat akun gratis sekarang dan hubungkan nomor WhatsApp Anda menggunakan 8-Digit
                Pairing Code atau QR Code dalam hitungan detik.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to={user ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#171717] text-xs font-semibold transition-colors"
              >
                <span>{user ? 'Buka Dashboard' : 'Daftar Akun Gratis'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-[10px] bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-medium transition-colors"
                >
                  <span>Masuk</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#FFFFFF] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#EAEAEA]">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <RubbyLogo className="w-8 h-8" />
                <span className="font-semibold text-sm text-[#171717]">Rubby WA Bot</span>
              </div>
              <p className="text-xs text-[#666666] max-w-sm leading-relaxed">
                Platform Multi-Device WhatsApp Bot Manager modern dengan dukungan 8-Digit Pairing
                Code dan QR Code real-time.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2 text-xs">
              <div className="font-semibold text-[#171717]">Navigasi Platform</div>
              <ul className="space-y-2 text-[#666666]">
                <li>
                  <Link to="/login" className="hover:text-[#171717]">
                    Masuk ke Akun
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-[#171717]">
                    Daftar Akun Baru
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-[#171717]">
                    Dashboard Bot
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-2 text-xs">
              <div className="font-semibold text-[#171717]">Komunitas &amp; Pengembang</div>
              <ul className="space-y-2 text-[#666666]">
                <li>
                  <a
                    href="https://whatsapp.com/channel/0029VbDXYlKDJ6H1D7Dm0f13"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#171717]"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Saluran Resmi WhatsApp</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/KyuuX444"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#171717]"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>github.com/KyuuX444</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://api.kyzzz.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#171717]"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>https://api.kyzzz.xyz</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#666666] gap-2">
            <span>
              Rubby WA Bot • Original Creator:{' '}
              <a
                href="https://github.com/KyuuX444"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#171717] hover:underline"
              >
                Kyuu (@KyuuX444)
              </a>
            </span>
            <span className="font-mono">License: NOT FOR SALE • Multi-Device Runtime</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
}> = ({ icon: Icon, title, description }) => (
  <div className="p-6 rounded-[14px] bg-[#F7F8FA] border border-[#EAEAEA] hover:border-[#171717]/40 transition-colors space-y-3">
    <div className="w-10 h-10 rounded-[10px] bg-[#FFFFFF] border border-[#EAEAEA] flex items-center justify-center">
      <Icon className="w-5 h-5 text-[#171717]" />
    </div>
    <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
    <p className="text-xs text-[#666666] leading-relaxed">{description}</p>
  </div>
);

const StepCard: React.FC<{
  step: string;
  title: string;
  description: string;
}> = ({ step, title, description }) => (
  <div className="p-6 rounded-[14px] bg-[#FFFFFF] border border-[#EAEAEA] space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
    <span className="inline-block font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#171717] text-white">
      LANGKAH {step}
    </span>
    <h3 className="text-sm font-semibold text-[#171717] pt-1">{title}</h3>
    <p className="text-xs text-[#666666] leading-relaxed">{description}</p>
  </div>
);

const FaqItem: React.FC<{
  question: string;
  answer: string;
}> = ({ question, answer }) => (
  <div className="p-5 rounded-[12px] bg-[#F7F8FA] border border-[#EAEAEA] space-y-2">
    <div className="flex items-start gap-2.5">
      <HelpCircle className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
      <h3 className="text-xs sm:text-sm font-semibold text-[#171717]">{question}</h3>
    </div>
    <p className="text-xs text-[#666666] leading-relaxed pl-6">{answer}</p>
  </div>
);
