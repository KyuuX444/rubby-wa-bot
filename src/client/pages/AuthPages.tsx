import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  QrCode,
  Shield,
  Cpu,
  Github,
  ExternalLink,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, setCsrfToken } from '../lib/api';
import { RubbyLogo } from '../components/RubbyLogo';

const AuthShell: React.FC<{
  badge: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ badge, title, subtitle, children }) => (
  <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between">
    <header className="h-16 bg-[#FFFFFF] border-b border-[#EAEAEA] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <RubbyLogo className="w-8 h-8 transition-transform group-hover:scale-[1.03]" />
        <span className="font-semibold text-sm text-[#171717]">Rubby WA Bot</span>
      </Link>

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA] border border-transparent hover:border-[#EAEAEA] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Kembali ke Beranda</span>
      </Link>
    </header>

    <div className="flex-1 flex items-center justify-center py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="lg:col-span-5 bg-[#171717] text-white p-7 sm:p-9 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono uppercase tracking-wider text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>Multi-Device Cloud Platform</span>
            </div>

            <h2 className="mt-6 text-xl font-semibold tracking-tight text-white leading-snug">
              Kelola Bot WhatsApp Anda Secara Real-Time
            </h2>
            <p className="mt-2 text-xs text-[#A3A3A3] leading-relaxed">
              Hubungkan perangkat WhatsApp dalam hitungan detik menggunakan 8-Digit Pairing Code
              (tanpa perlu HP kedua) atau QR Code dengan isolasi sesi penuh.
            </p>

            <div className="mt-7 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Hash className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-medium text-white">
                    8-Digit Pairing Code &amp; QR Scan
                  </div>
                  <div className="text-[11px] text-[#A3A3A3] mt-0.5">
                    Tautkan langsung dari 1 HP menggunakan nomor telepon atau pindai QR Code.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-medium text-white">
                    Sinkronisasi Role Otomatis
                  </div>
                  <div className="text-[11px] text-[#A3A3A3] mt-0.5">
                    Role akun website langsung terhubung dengan hak akses command bot Anda.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-medium text-white">
                    Aktif 24/7 di Cloud Server
                  </div>
                  <div className="text-[11px] text-[#A3A3A3] mt-0.5">
                    Bot tetap berjalan otomatis di server meskipun browser atau HP Anda ditutup.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#A3A3A3]">
            <span>Rubby WA Bot</span>
            <span>Engine: ruby-baileys</span>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-[#FFFFFF]">
          <div className="max-w-md w-full mx-auto">
            <span className="inline-block text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#F7F8FA] border border-[#EAEAEA] text-[#666666]">
              {badge}
            </span>
            <h1 className="mt-2.5 text-xl sm:text-2xl font-bold tracking-tight text-[#171717]">
              {title}
            </h1>
            <p className="mt-1 text-xs text-[#666666]">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>

    <footer className="py-4 px-4 text-center text-[11px] text-[#666666] border-t border-[#EAEAEA] bg-[#FFFFFF]">
      Rubby WA Bot Platform — Multi-Device WhatsApp Manager
    </footer>
  </div>
);

interface StoredDeviceFlow {
  flowToken: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresAt: number;
}

const GH_STORAGE_KEY = 'wbm_gh_device_flow';

function loadStoredDeviceFlow(): StoredDeviceFlow | null {
  try {
    const raw = sessionStorage.getItem(GH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredDeviceFlow = JSON.parse(raw);
    if (!parsed.flowToken || !parsed.userCode || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(GH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredDeviceFlow(flow: StoredDeviceFlow | null) {
  try {
    if (!flow) {
      sessionStorage.removeItem(GH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(GH_STORAGE_KEY, JSON.stringify(flow));
    }
  } catch {
  }
}

const GitHubAuthSection: React.FC<{ onError: (msg: string) => void }> = ({ onError }) => {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [starting, setStarting] = useState(false);
  const [deviceData, setDeviceData] = useState<StoredDeviceFlow | null>(() =>
    loadStoredDeviceFlow()
  );
  const [copied, setCopied] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const isPollingRef = useRef<boolean>(false);

  const updateDeviceData = useCallback((next: StoredDeviceFlow | null) => {
    saveStoredDeviceFlow(next);
    setDeviceData(next);
  }, []);

  const executePoll = useCallback(
    async (flow: StoredDeviceFlow) => {
      if (isPollingRef.current) return;
      if (Date.now() >= flow.expiresAt) {
        updateDeviceData(null);
        onError('Kode login GitHub telah kedaluwarsa. Silakan klik tombol GitHub lagi.');
        return;
      }

      isPollingRef.current = true;
      try {
        const pollRes = await apiRequest<{
          status: 'pending' | 'authenticated' | 'expired' | 'failed';
          csrfToken?: string;
          interval?: number;
          error?: string;
        }>('/api/auth/github/device/poll', {
          method: 'POST',
          body: JSON.stringify({ flowToken: flow.flowToken }),
        });

        if (pollRes.status === 'authenticated') {
          updateDeviceData(null);
          if (pollRes.csrfToken) {
            setCsrfToken(pollRes.csrfToken);
          }
          await refreshUser();
          navigate('/dashboard');
          return;
        }

        if (pollRes.status === 'expired' || pollRes.status === 'failed') {
          updateDeviceData(null);
          onError(pollRes.error || 'Otorisasi GitHub dibatalkan atau kedaluwarsa.');
          return;
        }

        if (pollRes.interval && pollRes.interval !== flow.interval) {
          const updated = { ...flow, interval: pollRes.interval };
          updateDeviceData(updated);
        }
      } catch {
      } finally {
        isPollingRef.current = false;
      }
    },
    [navigate, onError, refreshUser, updateDeviceData]
  );

  useEffect(() => {
    if (!deviceData) return;

    let cancelled = false;
    const intervalMs = Math.max(5, deviceData.interval || 5) * 1000;

    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        await executePoll(deviceData);
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        executePoll(deviceData);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [deviceData, executePoll]);

  const handleGitHubClick = async () => {
    onError('');
    setStarting(true);
    try {
      const cfg = await apiRequest<{ webOAuthEnabled: boolean; deviceFlowEnabled: boolean }>(
        '/api/auth/github/config'
      );

      if (cfg.webOAuthEnabled) {
        window.location.href = '/api/auth/github';
        return;
      }

      const flow = await apiRequest<{
        flowToken: string;
        userCode: string;
        verificationUri: string;
        expiresIn: number;
        expiresAt?: number;
        interval: number;
      }>('/api/auth/github/device/start', { method: 'POST' });

      const stored: StoredDeviceFlow = {
        flowToken: flow.flowToken,
        userCode: flow.userCode,
        verificationUri: flow.verificationUri || 'https://github.com/login/device',
        interval: Math.max(5, flow.interval || 5),
        expiresAt: flow.expiresAt || Date.now() + (flow.expiresIn || 900) * 1000,
      };

      updateDeviceData(stored);

      try {
        await navigator.clipboard.writeText(flow.userCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
      }
    } catch (err: any) {
      onError(err.message || 'Gagal memulai login GitHub.');
    } finally {
      setStarting(false);
    }
  };

  const copyCode = async () => {
    if (!deviceData) return;
    try {
      await navigator.clipboard.writeText(deviceData.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
    }
  };

  const cancelDeviceFlow = () => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    updateDeviceData(null);
  };

  if (deviceData) {
    return (
      <div className="mb-6 p-4 rounded-[12px] bg-[#F7F8FA] border border-[#171717] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
            <Github className="w-4 h-4" />
            <span>Verifikasi Login GitHub</span>
          </div>
          <button
            type="button"
            onClick={cancelDeviceFlow}
            className="p-1 rounded text-[#666666] hover:text-[#171717]"
            title="Batalkan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[11px] text-[#666666] leading-relaxed">
          Salin kode 8 karakter di bawah ini, lalu buka halaman aktivasi GitHub. Kode ini tidak
          akan hilang meskipun Anda berpindah tab:
        </p>

        <div className="p-3 bg-[#FFFFFF] border border-[#171717] rounded-[10px] flex items-center justify-between">
          <span className="font-mono text-xl font-bold tracking-[0.2em] text-[#171717]">
            {deviceData.userCode}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[#F7F8FA] hover:bg-[#EAEAEA] text-xs font-medium text-[#171717] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Disalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Kode</span>
              </>
            )}
          </button>
        </div>

        <a
          href={deviceData.verificationUri}
          target="_blank"
          rel="noopener noreferrer"
          onClick={copyCode}
          className="w-full py-2.5 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <span>Buka Halaman Aktivasi GitHub</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#666666] pt-1">
          <span className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#171717]" />
            <span>Menunggu konfirmasi dari GitHub...</span>
          </span>
          <button
            type="button"
            onClick={() => executePoll(deviceData)}
            className="underline text-[#171717] font-sans font-medium"
          >
            Cek Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={handleGitHubClick}
        disabled={starting}
        className="w-full py-2.5 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2.5 transition-colors shadow-sm"
      >
        {starting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Menghubungkan ke GitHub...</span>
          </>
        ) : (
          <>
            <Github className="w-4 h-4" />
            <span>Lanjutkan dengan GitHub</span>
          </>
        )}
      </button>

      <div className="relative my-5 flex items-center justify-center">
        <div className="border-t border-[#EAEAEA] w-full" />
        <span className="bg-[#FFFFFF] px-3 text-[10px] font-mono uppercase tracking-wider text-[#666666] shrink-0">
          atau gunakan akun website
        </span>
        <div className="border-t border-[#EAEAEA] w-full" />
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get('error'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      saveStoredDeviceFlow(null);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="Autentikasi Akun"
      title="Masuk ke Rubby WA Bot"
      subtitle="Akses dashboard untuk mengelola koneksi dan konfigurasi bot WhatsApp Anda"
    >
      {error && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717]/20 flex items-start gap-2.5 text-xs text-[#171717]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#171717]" />
          <span>{error}</span>
        </div>
      )}

      <GitHubAuthSection onError={(msg) => setError(msg || null)} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">
            Username atau Email
          </label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Masukkan username atau email"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-[#171717]">Password</label>
            <Link
              to="/forgot-password"
              className="text-xs text-[#666666] hover:text-[#171717] transition-colors"
            >
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password Anda"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717]"
              aria-label="Toggle Password Visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-2 py-2.5 px-4 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#171717] disabled:opacity-50 text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses Login...</span>
            </>
          ) : (
            <>
              <span>Masuk dengan Akun</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#EAEAEA] text-center">
        <p className="text-xs text-[#666666]">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-[#171717] hover:underline">
            Daftar akun gratis
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(username, email, password);
      saveStoredDeviceFlow(null);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="Pendaftaran Gratis"
      title="Buat Akun Rubby WA Bot"
      subtitle="Daftarkan akun Anda untuk mulai menghubungkan bot WhatsApp multi-device"
    >
      {error && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717]/20 flex items-start gap-2.5 text-xs text-[#171717]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#171717]" />
          <span>{error}</span>
        </div>
      )}

      <GitHubAuthSection onError={(msg) => setError(msg || null)} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">Username</label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="huruf, angka, atau underscore"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">Alamat Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">
            Password (minimal 8 karakter)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#171717]"
              aria-label="Toggle Password Visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-2 py-2.5 px-4 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#171717] disabled:opacity-50 text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Membuat Akun...</span>
            </>
          ) : (
            <>
              <span>Daftar Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#EAEAEA] text-center">
        <p className="text-xs text-[#666666]">
          Sudah memiliki akun?{' '}
          <Link to="/login" className="font-semibold text-[#171717] hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccessMsg(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="Pemulihan Akun"
      title="Reset Password"
      subtitle="Masukkan alamat email terdaftar untuk menerima token reset password"
    >
      {error && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717]/20 flex items-start gap-2.5 text-xs text-[#171717]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717] flex items-start gap-2.5 text-xs text-[#171717]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">Alamat Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mengirim instruksi...</span>
            </>
          ) : (
            <span>Kirim Instruksi Reset</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#EAEAEA] flex items-center justify-between text-xs text-[#666666]">
        <Link to="/login" className="font-medium text-[#171717] hover:underline">
          Kembali ke Login
        </Link>
        <Link to="/reset-password" className="hover:text-[#171717]">
          Sudah punya token reset?
        </Link>
      </div>
    </AuthShell>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      badge="Keamanan Akun"
      title="Buat Password Baru"
      subtitle="Masukkan token reset dan password baru Anda"
    >
      {error && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717]/20 flex items-start gap-2.5 text-xs text-[#171717]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#171717] flex items-start gap-2.5 text-xs text-[#171717]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Password berhasil diperbarui! Mengalihkan ke halaman login...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">Token Reset</label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Tempel token reset"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] focus:outline-none focus:border-[#171717]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#171717] mb-1.5">Password Baru</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] focus:outline-none focus:border-[#171717]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memperbarui password...</span>
            </>
          ) : (
            <span>Simpan Password Baru</span>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#EAEAEA] text-center">
        <Link to="/login" className="text-xs font-medium text-[#171717] hover:underline">
          Kembali ke Login
        </Link>
      </div>
    </AuthShell>
  );
};
