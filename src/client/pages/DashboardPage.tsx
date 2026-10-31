import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  Phone,
  Cpu,
  Shield,
  Clock,
  MessageSquare,
  Terminal,
  Calendar,
  QrCode,
  Hash,
  RefreshCw,
  PowerOff,
  Settings,
  Play,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Activity,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { RubbyLogo } from '../components/RubbyLogo';
import type {
  WhatsAppSessionInfo,
  BotSettings,
  BotLog,
  BotCommandDefinition,
} from '../../shared/types';

function formatUptime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never connected';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

type ExtendedSession = WhatsAppSessionInfo & {
  connection_mode?: 'qr' | 'pairing' | 'reconnect';
  qr_data_url?: string | null;
  pairing_code?: string | null;
  pairing_phone?: string | null;
  pairing_expires_in?: number;
};

export const DashboardPage: React.FC = () => {
  const { user, subscribeRealtime } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [session, setSession] = useState<ExtendedSession | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [commands, setCommands] = useState<BotCommandDefinition[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');

  const [showConnectPanel, setShowConnectPanel] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('wbm_show_connect') === '1';
    } catch {
      return false;
    }
  });
  const [connectMethod, setConnectMethod] = useState<'qr' | 'pairing'>(() => {
    try {
      const saved = sessionStorage.getItem('wbm_connect_method');
      return saved === 'qr' ? 'qr' : 'pairing';
    } catch {
      return 'pairing';
    }
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<string>(() => {
    try {
      return sessionStorage.getItem('wbm_pairing_phone') || '';
    } catch {
      return '';
    }
  });
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresIn, setPairingExpiresIn] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const [connectingQr, setConnectingQr] = useState(false);
  const [requestingPairing, setRequestingPairing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const [liveUptime, setLiveUptime] = useState<number>(0);

  useEffect(() => {
    try {
      sessionStorage.setItem('wbm_show_connect', showConnectPanel ? '1' : '0');
    } catch {
    }
  }, [showConnectPanel]);

  useEffect(() => {
    try {
      sessionStorage.setItem('wbm_connect_method', connectMethod);
    } catch {
    }
  }, [connectMethod]);

  useEffect(() => {
    try {
      if (pairingPhone) {
        sessionStorage.setItem('wbm_pairing_phone', pairingPhone);
      }
    } catch {
    }
  }, [pairingPhone]);

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const data = await apiRequest<{
        session: ExtendedSession;
        settings: BotSettings;
        commands: BotCommandDefinition[];
        logs: BotLog[];
      }>('/api/bot/dashboard');

      setSession(data.session);
      setSettings(data.settings);
      setCommands(data.commands || []);
      setLogs(data.logs || []);
      setLiveUptime(data.session.uptime_seconds || 0);

      if (data.session.connection_status === 'connected') {
        setQrDataUrl(null);
        setPairingCode(null);
        setPairingExpiresIn(0);
        setShowConnectPanel(false);
      } else {
        if (data.session.pairing_code && (data.session.pairing_expires_in || 0) > 0) {
          setPairingCode(data.session.pairing_code);
          setPairingExpiresIn(data.session.pairing_expires_in || 180);
          if (data.session.pairing_phone) {
            setPairingPhone((prev) => prev || data.session.pairing_phone || '');
          }
          setConnectMethod('pairing');
          setShowConnectPanel(true);
        } else if (data.session.qr_data_url) {
          setQrDataUrl(data.session.qr_data_url);
        }
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (event.type === 'ws.reconnected') {
        fetchDashboard(true);
        return;
      }

      if (event.type === 'whatsapp.qr') {
        setQrDataUrl(event.payload.qrDataUrl);
      } else if (event.type === 'whatsapp.pairing_code') {
        setPairingCode(event.payload.code);
        setPairingExpiresIn(event.payload.expiresInSeconds || 180);
        setShowConnectPanel(true);
        setConnectMethod('pairing');
      } else if (event.type === 'whatsapp.status') {
        const p = event.payload;
        setSession((prev) =>
          prev
            ? {
                ...prev,
                connection_status: p.connection_status,
                bot_status: p.bot_status,
                phone_number: p.phone_number,
                jid: p.jid,
                push_name: p.push_name,
                messages_received: p.messages_received,
                commands_executed: p.commands_executed,
                connected_at: p.connected_at,
                uptime_seconds: p.uptime_seconds,
              }
            : prev
        );
        setLiveUptime(p.uptime_seconds || 0);

        if (p.connection_status === 'connected') {
          setQrDataUrl(null);
          setPairingCode(null);
          setPairingExpiresIn(0);
          setShowConnectPanel(false);
        }
      } else if (event.type === 'bot.log') {
        setLogs((prev) => [event.payload, ...prev.slice(0, 99)]);
      }
    });
  }, [subscribeRealtime, fetchDashboard]);

  useEffect(() => {
    if (session?.connection_status !== 'connected') {
      setLiveUptime(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLiveUptime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.connection_status]);

  useEffect(() => {
    if (pairingExpiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setPairingExpiresIn((prev) => {
        if (prev <= 1) {
          setPairingCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingExpiresIn]);

  const handleStartQrConnection = async (forceReset = false) => {
    setError(null);
    setActionMessage(null);
    setShowConnectPanel(true);
    setConnectMethod('qr');
    setConnectingQr(true);
    if (forceReset) {
      setPairingCode(null);
      setPairingExpiresIn(0);
    }
    try {
      const res = await apiRequest<{ qrDataUrl: string | null; session: any }>(
        '/api/bot/connect/qr',
        {
          method: 'POST',
          body: JSON.stringify({ forceReset }),
        }
      );
      if (res.qrDataUrl) {
        setQrDataUrl(res.qrDataUrl);
      }
      if (res.session) {
        setSession(res.session);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start QR connection');
    } finally {
      setConnectingQr(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent, forceNew = false) => {
    e.preventDefault();
    setError(null);
    setActionMessage(null);
    setRequestingPairing(true);
    try {
      const res = await apiRequest<{
        code: string;
        phoneNumber: string;
        expiresInSeconds: number;
        session: any;
      }>('/api/bot/connect/pairing', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: pairingPhone,
          forceNew,
        }),
      });
      setPairingCode(res.code);
      setPairingExpiresIn(res.expiresInSeconds || 180);
      setPairingPhone(res.phoneNumber || pairingPhone);
      if (res.session) {
        setSession(res.session);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate pairing code');
    } finally {
      setRequestingPairing(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setActionMessage(null);
    setDisconnecting(true);
    try {
      const res = await apiRequest<{ message: string; session: any }>('/api/bot/disconnect', {
        method: 'POST',
      });
      setSession(res.session);
      setQrDataUrl(null);
      setPairingCode(null);
      setPairingExpiresIn(0);
      setShowConnectPanel(false);
      setActionMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect WhatsApp');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRestartBot = async () => {
    setError(null);
    setActionMessage(null);
    setRestarting(true);
    try {
      const res = await apiRequest<{ message: string; session: any }>('/api/bot/restart', {
        method: 'POST',
      });
      setSession(res.session);
      setActionMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to restart bot');
    } finally {
      setRestarting(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await apiRequest('/api/bot/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err: any) {
      setError(err.message || 'Failed to clear logs');
    }
  };

  const copyPairingCodeToClipboard = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse-subtle">
        <div className="h-24 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5"
            />
          ))}
        </div>
        <div className="h-80 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-6" />
      </div>
    );
  }

  const isConnected = session?.connection_status === 'connected';
  const connStatusLabel = (session?.connection_status || 'disconnected').toUpperCase();
  const botStatusLabel = (session?.bot_status || 'stopped').toUpperCase();

  const filteredLogs =
    logFilter === 'all' ? logs : logs.filter((l) => l.event.toLowerCase() === logFilter);

  const pairingChars = pairingCode ? pairingCode.split('') : [];

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-start sm:items-center gap-4">
          <RubbyLogo className="w-12 h-12 shrink-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-[#171717]">
                {settings?.bot_name || 'Rubby WA Bot'}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                  isConnected
                    ? 'bg-[#171717] text-white border-[#171717]'
                    : session?.connection_status === 'waiting' ||
                      session?.connection_status === 'connecting'
                    ? 'bg-[#F7F8FA] text-[#171717] border-[#171717]/40'
                    : 'bg-[#F7F8FA] text-[#666666] border-[#EAEAEA]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected
                      ? 'bg-white'
                      : session?.connection_status === 'waiting' ||
                        session?.connection_status === 'connecting'
                      ? 'bg-[#171717] animate-ping'
                      : 'bg-[#999999]'
                  }`}
                />
                {connStatusLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#666666]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#F7F8FA] border border-[#EAEAEA] font-mono text-[11px]">
                Prefix: <strong className="text-[#171717]">{settings?.prefix || '/'}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#F7F8FA] border border-[#EAEAEA] font-mono text-[11px]">
                Mode:{' '}
                <strong className="text-[#171717]">
                  {settings?.public_mode ? 'PUBLIC' : 'PRIVATE'}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#F7F8FA] border border-[#EAEAEA] font-mono text-[11px]">
                Bot Role: <strong className="text-[#171717]">{user?.role}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isConnected && (
            <button
              onClick={() => {
                setShowConnectPanel(true);
                if (connectMethod === 'qr' && !qrDataUrl && !pairingCode) {
                  handleStartQrConnection(false);
                }
              }}
              disabled={connectingQr}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {connectingQr ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>Connect WhatsApp</span>
            </button>
          )}

          <button
            onClick={handleDisconnect}
            disabled={
              disconnecting ||
              (session?.connection_status === 'disconnected' && !showConnectPanel)
            }
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#171717] border border-[#EAEAEA] text-xs font-medium transition-colors disabled:opacity-40"
          >
            {disconnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PowerOff className="w-3.5 h-3.5" />
            )}
            <span>Disconnect WhatsApp</span>
          </button>

          <button
            onClick={handleRestartBot}
            disabled={restarting}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#171717] border border-[#EAEAEA] text-xs font-medium transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart Bot</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] text-[#171717] border border-[#EAEAEA] text-xs font-medium transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Bot Settings</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#171717] flex items-center justify-between gap-3 text-xs text-[#171717]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[#666666] hover:text-[#171717] font-mono text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#EAEAEA] flex items-center justify-between gap-3 text-xs text-[#171717]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[#666666] hover:text-[#171717] font-mono text-xs"
          >
            Close
          </button>
        </div>
      )}

      {(showConnectPanel ||
        session?.connection_status === 'waiting' ||
        qrDataUrl ||
        pairingCode) &&
        !isConnected && (
          <div className="bg-[#FFFFFF] border border-[#171717] rounded-[14px] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#EAEAEA]">
              <div>
                <h2 className="text-base font-semibold text-[#171717]">
                  Hubungkan Akun WhatsApp
                </h2>
                <p className="text-xs text-[#666666] mt-0.5">
                  Pilih metode 8-Digit Pairing Code (cocok untuk 1 HP) atau Scan QR Code
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA]">
                  <button
                    type="button"
                    onClick={() => setConnectMethod('pairing')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                      connectMethod === 'pairing'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#666666] hover:text-[#171717]'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>8-Digit Pairing Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectMethod('qr');
                      if (!qrDataUrl && !pairingCode) {
                        handleStartQrConnection(false);
                      }
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                      connectMethod === 'qr'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#666666] hover:text-[#171717]'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConnectPanel(false)}
                  className="p-2 rounded-[8px] text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA] border border-[#EAEAEA]"
                  title="Minimize Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {connectMethod === 'pairing' ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <form
                  onSubmit={(e) => handleRequestPairingCode(e, false)}
                  className="md:col-span-5 space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-[#171717] mb-1.5">
                      Nomor WhatsApp (Format Internasional / 08xx)
                    </label>
                    <input
                      type="tel"
                      required
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder="Contoh: 6281234567890"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717]"
                    />
                    <p className="text-[11px] text-[#666666] mt-1">
                      Masukkan nomor diawali 628... atau 08... (otomatis dikonversi ke 628).
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={requestingPairing}
                    className="w-full py-2.5 px-4 rounded-[10px] bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {requestingPairing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Meminta Kode Pairing...</span>
                      </>
                    ) : (
                      <>
                        <Hash className="w-4 h-4" />
                        <span>
                          {pairingCode ? 'Tampilkan / Perbarui Kode' : 'Generate 8-Digit Pairing Code'}
                        </span>
                      </>
                    )}
                  </button>

                  <div className="p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] text-[11px] text-[#666666] flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
                    <span>
                      Sesi pairing tetap terjaga meskipun Anda berpindah aplikasi ke WhatsApp
                      di HP untuk memasukkan kode.
                    </span>
                  </div>
                </form>

                <div className="md:col-span-7 p-6 bg-[#F7F8FA] border border-[#EAEAEA] rounded-[12px] flex flex-col justify-between min-h-[240px]">
                  {pairingCode ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#171717]">
                          8-Digit Pairing Code Aktif
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#666666]">
                            Berlaku {pairingExpiresIn}s
                          </span>
                          <button
                            type="button"
                            onClick={copyPairingCodeToClipboard}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-white border border-[#EAEAEA] hover:border-[#171717] text-[11px] font-medium text-[#171717] transition-colors"
                          >
                            {copiedCode ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Disalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin Kode</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-2">
                        {pairingChars.map((ch, idx) => (
                          <React.Fragment key={idx}>
                            {idx === 4 && (
                              <span className="text-lg font-mono font-bold text-[#666666] px-0.5">
                                -
                              </span>
                            )}
                            <div className="w-9 h-12 sm:w-11 sm:h-14 rounded-[10px] bg-[#FFFFFF] border-2 border-[#171717] flex items-center justify-center font-mono text-lg sm:text-xl font-bold text-[#171717] shadow-sm">
                              {ch}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="p-3.5 rounded-[10px] bg-white border border-[#EAEAEA] text-xs text-[#666666] space-y-1">
                        <p className="font-semibold text-[#171717]">
                          Cara memasukkan kode di WhatsApp:
                        </p>
                        <p>
                          Buka WhatsApp &gt; <strong className="text-[#171717]">Perangkat Tertaut</strong>{' '}
                          &gt; <strong className="text-[#171717]">Tautkan Perangkat</strong> &gt;{' '}
                          <strong className="text-[#171717]">
                            Tautkan dengan nomor telepon saja
                          </strong>
                          .
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center my-auto py-8">
                      <div className="w-10 h-10 rounded-[10px] bg-white border border-[#EAEAEA] flex items-center justify-center mb-3">
                        <Hash className="w-5 h-5 text-[#171717]" />
                      </div>
                      <p className="text-xs font-semibold text-[#171717]">
                        Siap Membuat 8-Digit Pairing Code
                      </p>
                      <p className="text-[11px] text-[#666666] mt-1 max-w-sm">
                        Masukkan nomor WhatsApp Anda di sebelah kiri lalu klik Generate untuk
                        mendapatkan 8-digit kode penautan resmi.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#F7F8FA] border border-[#EAEAEA] rounded-[12px] min-h-[290px]">
                  {qrDataUrl ? (
                    <div className="bg-white p-3.5 rounded-[12px] border border-[#EAEAEA] shadow-sm">
                      <img
                        src={qrDataUrl}
                        alt="WhatsApp QR Code"
                        className="w-56 h-56 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center py-8">
                      {connectingQr ? (
                        <>
                          <Loader2 className="w-8 h-8 text-[#171717] animate-spin mb-3" />
                          <p className="text-xs font-medium text-[#171717]">
                            Generating QR Code...
                          </p>
                          <p className="text-[11px] text-[#666666] mt-1">
                            Menghubungkan ke server WhatsApp
                          </p>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-8 h-8 text-[#171717] mb-3" />
                          <p className="text-xs font-medium text-[#171717]">
                            QR Code Belum Dimuat
                          </p>
                          <p className="text-[11px] text-[#666666] mt-1">
                            Klik tombol di bawah untuk membuat QR Code baru
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStartQrConnection(true)}
                    disabled={connectingQr}
                    className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-white border border-[#EAEAEA] hover:border-[#171717] text-xs font-medium text-[#171717] transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${connectingQr ? 'animate-spin' : ''}`}
                    />
                    <span>{qrDataUrl ? 'Refresh QR Code' : 'Generate QR Code'}</span>
                  </button>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <h3 className="text-sm font-semibold text-[#171717]">
                    Langkah Menautkan via QR Code
                  </h3>
                  <div className="space-y-2.5 text-xs text-[#666666]">
                    <div className="p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center gap-3">
                      <span className="w-6 h-6 rounded-[6px] bg-[#171717] text-white font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>Buka aplikasi WhatsApp di HP Anda lalu masuk ke menu Pengaturan.</span>
                    </div>
                    <div className="p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center gap-3">
                      <span className="w-6 h-6 rounded-[6px] bg-[#171717] text-white font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>
                        Pilih <strong className="text-[#171717]">Perangkat Tertaut</strong> lalu ketuk{' '}
                        <strong className="text-[#171717]">Tautkan Perangkat</strong>.
                      </span>
                    </div>
                    <div className="p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center gap-3">
                      <span className="w-6 h-6 rounded-[6px] bg-[#171717] text-white font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>Arahkan kamera HP ke QR Code di samping hingga terhubung.</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] text-[11px] text-[#666666] flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
                    <span>
                      Jika Anda membuka dashboard ini menggunakan 1 HP yang sama dengan WhatsApp,
                      gunakan tab <strong className="text-[#171717]">8-Digit Pairing Code</strong>.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="WhatsApp Status"
          value={connStatusLabel}
          subtext={isConnected ? 'Multi-device socket active' : 'Ready to connect'}
          icon={isConnected ? Wifi : WifiOff}
          highlight={isConnected}
        />

        <MetricCard
          label="Connected Number"
          value={session?.phone_number ? `+${session.phone_number}` : 'Not Linked'}
          subtext={session?.push_name ? `Profile: ${session.push_name}` : 'No linked device'}
          icon={Phone}
          mono
        />

        <MetricCard
          label="Bot Runtime"
          value={botStatusLabel}
          subtext={
            settings?.maintenance_mode
              ? 'Maintenance mode active'
              : isConnected
              ? 'Command handler listening'
              : 'Idle'
          }
          icon={Cpu}
        />

        <MetricCard
          label="Account & Bot Role"
          value={user?.role || 'FREE'}
          subtext={`Account ID #${user?.id} (Auto-Synced)`}
          icon={Shield}
          mono
        />

        <MetricCard
          label="Session Uptime"
          value={isConnected ? formatUptime(liveUptime) : '0s'}
          subtext="Continuous active runtime"
          icon={Clock}
          mono
        />

        <MetricCard
          label="Incoming Messages"
          value={(session?.messages_received || 0).toLocaleString()}
          subtext="Total messages processed"
          icon={MessageSquare}
          mono
        />

        <MetricCard
          label="Commands Executed"
          value={(session?.commands_executed || 0).toLocaleString()}
          subtext="Total bot commands triggered"
          icon={Terminal}
          mono
        />

        <MetricCard
          label="Last Connected"
          value={formatDateTime(session?.connected_at || null)}
          subtext="Persisted in PostgreSQL"
          icon={Calendar}
          compactValue
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA]">
            <div>
              <h2 className="text-sm font-semibold text-[#171717]">Command Registry</h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Synchronized with website role ({user?.role})
              </p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="px-2.5 py-1 rounded-[8px] bg-[#F7F8FA] hover:bg-[#EAEAEA] text-xs font-medium text-[#171717] transition-colors"
            >
              Manage
            </button>
          </div>

          <div className="mt-4 space-y-2.5 flex-1">
            {commands.map((cmd) => {
              const isDisabled = settings?.disabled_commands?.includes(cmd.name);
              const roleAllowed =
                cmd.minRole === 'FREE' || (cmd.minRole === 'OWNER' && user?.role === 'OWNER');
              const prefix = settings?.prefix || '/';

              return (
                <div
                  key={cmd.name}
                  className="p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#171717]">
                        {prefix}
                        {cmd.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          cmd.minRole === 'OWNER'
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-white text-[#666666] border-[#EAEAEA]'
                        }`}
                      >
                        {cmd.minRole}
                      </span>
                      {isDisabled && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#EAEAEA] text-[#999999]">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                      {cmd.description}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded shrink-0 ${
                      roleAllowed
                        ? 'bg-white text-[#171717] border border-[#EAEAEA]'
                        : 'text-[#999999]'
                    }`}
                  >
                    {roleAllowed ? 'ACTIVE' : 'LOCKED'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[14px] p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#EAEAEA]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#171717]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#171717]">
                  Real-Time Activity Stream
                </h2>
                <p className="text-xs text-[#666666]">
                  Isolated session events for User #{user?.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {['all', 'connection', 'command', 'auth', 'settings'].map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-2.5 py-1 rounded-[6px] text-[11px] font-mono uppercase transition-colors ${
                    logFilter === f
                      ? 'bg-[#171717] text-white'
                      : 'bg-[#F7F8FA] text-[#666666] hover:text-[#171717]'
                  }`}
                >
                  {f}
                </button>
              ))}

              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="p-1.5 rounded-[6px] text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA] border border-transparent hover:border-[#EAEAEA] transition-colors ml-1"
                  title="Clear Logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex-1 max-h-[440px] overflow-y-auto space-y-2 pr-1">
            {filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#666666]">
                No matching activity logs. Connect WhatsApp or execute a command to see live events.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          log.level === 'error'
                            ? 'bg-[#171717] text-white'
                            : log.level === 'success'
                            ? 'bg-white text-[#171717] border border-[#171717]'
                            : 'bg-white text-[#666666] border border-[#EAEAEA]'
                        }`}
                      >
                        {log.event}
                      </span>
                      <span className="text-[11px] text-[#666666]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[#171717] break-words text-xs leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  subtext: string;
  icon: React.FC<{ className?: string }>;
  mono?: boolean;
  compactValue?: boolean;
  highlight?: boolean;
}> = ({ label, value, subtext, icon: Icon, mono, compactValue, highlight }) => (
  <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
    <div className="flex items-center justify-between gap-2 mb-3">
      <span className="text-xs font-medium text-[#666666]">{label}</span>
      <div
        className={`w-8 h-8 rounded-[8px] flex items-center justify-center border ${
          highlight
            ? 'bg-[#171717] text-white border-[#171717]'
            : 'bg-[#F7F8FA] text-[#171717] border-[#EAEAEA]'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div>
      <div
        className={`${compactValue ? 'text-sm' : 'text-lg'} font-semibold ${
          mono ? 'font-mono' : ''
        } text-[#171717] tracking-tight truncate`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#666666] mt-1 truncate">{subtext}</div>
    </div>
  </div>
);
