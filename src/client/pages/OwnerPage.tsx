import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Wifi,
  Cpu,
  WifiOff,
  Search,
  RefreshCw,
  PowerOff,
  Trash2,
  Ban,
  CheckCircle2,
  AlertCircle,
  Activity,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type {
  OwnerGlobalStats,
  OwnerBotMonitorItem,
  BotLog,
  UserRole,
  UserStatus,
} from '../../shared/types';

function formatUptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m ${rem}s`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export const OwnerPage: React.FC = () => {
  const { user, subscribeRealtime } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'bots' | 'logs'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [stats, setStats] = useState<OwnerGlobalStats | null>(null);
  const [bots, setBots] = useState<OwnerBotMonitorItem[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const data = await apiRequest<{
        stats: OwnerGlobalStats;
        bots: OwnerBotMonitorItem[];
        logs: BotLog[];
      }>('/api/owner/overview');

      setStats(data.stats);
      setBots(data.bots || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load owner panel data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (event.type === 'owner.bot_status') {
        const p = event.payload;
        setBots((prev) =>
          prev.map((b) =>
            b.user_id === p.user_id
              ? {
                  ...b,
                  connection_status: p.connection_status,
                  bot_status: p.bot_status,
                  phone_number: p.phone_number,
                  push_name: p.push_name,
                  messages_received: p.messages_received,
                  commands_executed: p.commands_executed,
                  connected_at: p.connected_at,
                  uptime_seconds: p.uptime_seconds,
                }
              : b
          )
        );
      } else if (event.type === 'owner.log') {
        setLogs((prev) => [event.payload, ...prev.slice(0, 149)]);
      }
    });
  }, [subscribeRealtime]);

  const handleChangeRole = async (targetUserId: number, newRole: UserRole) => {
    setError(null);
    setNotice(null);
    setActionBusyId(targetUserId);
    try {
      const res = await apiRequest<{ message: string }>(`/api/owner/users/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      setNotice(res.message);
      await fetchOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleBan = async (targetUserId: number, currentStatus: UserStatus) => {
    const nextStatus: UserStatus = currentStatus === 'active' ? 'banned' : 'active';
    setError(null);
    setNotice(null);
    setActionBusyId(targetUserId);
    try {
      const res = await apiRequest<{ message: string }>(`/api/owner/users/${targetUserId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(res.message);
      await fetchOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to update account status');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteUser = async (targetUserId: number, username: string) => {
    if (
      !window.confirm(
        `Delete account "${username}" (ID #${targetUserId}) and terminate its WhatsApp session?`
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setActionBusyId(targetUserId);
    try {
      const res = await apiRequest<{ message: string }>(`/api/owner/users/${targetUserId}`, {
        method: 'DELETE',
      });
      setNotice(res.message);
      await fetchOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleOwnerBotAction = async (
    targetUserId: number,
    action: 'restart' | 'disconnect'
  ) => {
    setError(null);
    setNotice(null);
    setActionBusyId(targetUserId);
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/owner/bots/${targetUserId}/${action}`,
        { method: 'POST' }
      );
      setNotice(res.message);
      await fetchOverview();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} bot`);
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredBots = bots.filter((b) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchesUsername = b.username.toLowerCase().includes(q);
      const matchesEmail = b.email.toLowerCase().includes(q);
      const matchesId = String(b.user_id) === q || `#${b.user_id}` === q;
      const matchesPhone = (b.phone_number || '').includes(q);
      if (!matchesUsername && !matchesEmail && !matchesId && !matchesPhone) {
        return false;
      }
    }
    if (roleFilter && b.role !== roleFilter) return false;
    if (statusFilter && b.user_status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse-subtle">
        <div className="h-20 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px]" />
          ))}
        </div>
        <div className="h-96 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#171717] text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#171717]">Owner Administration Panel</h1>
            <p className="text-xs text-[#666666]">
              Global user management, automatic bot role synchronization, and multi-session monitoring
            </p>
          </div>
        </div>

        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#EAEAEA] text-xs font-medium text-[#171717] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5">
          <div className="flex items-center justify-between text-[#666666] mb-3">
            <span className="text-xs font-medium">Total Registered Users</span>
            <Users className="w-4 h-4 text-[#171717]" />
          </div>
          <div className="text-2xl font-semibold font-mono text-[#171717]">
            {stats?.total_users || 0}
          </div>
          <div className="text-[11px] text-[#666666] mt-1">
            {stats?.owner_users || 0} OWNER / {stats?.free_users || 0} FREE ({stats?.banned_users || 0}{' '}
            banned)
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5">
          <div className="flex items-center justify-between text-[#666666] mb-3">
            <span className="text-xs font-medium">Connected WhatsApp</span>
            <Wifi className="w-4 h-4 text-[#171717]" />
          </div>
          <div className="text-2xl font-semibold font-mono text-[#171717]">
            {stats?.connected_whatsapp || 0}
          </div>
          <div className="text-[11px] text-[#666666] mt-1">
            Active authenticated WhatsApp sessions
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5">
          <div className="flex items-center justify-between text-[#666666] mb-3">
            <span className="text-xs font-medium">Total Active Bots</span>
            <Cpu className="w-4 h-4 text-[#171717]" />
          </div>
          <div className="text-2xl font-semibold font-mono text-[#171717]">
            {stats?.active_bots || 0}
          </div>
          <div className="text-[11px] text-[#666666] mt-1">
            Commands Processed: {(stats?.total_commands || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-5">
          <div className="flex items-center justify-between text-[#666666] mb-3">
            <span className="text-xs font-medium">Disconnected Bots</span>
            <WifiOff className="w-4 h-4 text-[#666666]" />
          </div>
          <div className="text-2xl font-semibold font-mono text-[#171717]">
            {stats?.disconnected_bots || 0}
          </div>
          <div className="text-[11px] text-[#666666] mt-1">
            Global Messages: {(stats?.total_messages || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#171717] flex items-center justify-between gap-3 text-xs text-[#171717]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#666666] hover:text-[#171717]">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#EAEAEA] flex items-center justify-between gap-3 text-xs text-[#171717]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-[#666666] hover:text-[#171717]">
            Close
          </button>
        </div>
      )}

      <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#EAEAEA]">
          <div className="inline-flex p-1 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA]">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#666666] hover:text-[#171717]'
              }`}
            >
              User &amp; Role Management ({bots.length})
            </button>
            <button
              onClick={() => setActiveTab('bots')}
              className={`px-4 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                activeTab === 'bots'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#666666] hover:text-[#171717]'
              }`}
            >
              Bot Monitoring
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-[#171717] text-white'
                  : 'text-[#666666] hover:text-[#171717]'
              }`}
            >
              System Logs ({logs.length})
            </button>
          </div>

          {activeTab !== 'logs' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search username or User ID (e.g. 1001)..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#F7F8FA] border border-[#EAEAEA] rounded-[8px] text-[#171717] placeholder-[#999999] focus:outline-none focus:border-[#171717] w-64"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-[#EAEAEA] rounded-[8px] text-[#171717] focus:outline-none focus:border-[#171717]"
              >
                <option value="">All Roles</option>
                <option value="OWNER">OWNER</option>
                <option value="FREE">FREE</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[#F7F8FA] border border-[#EAEAEA] rounded-[8px] text-[#171717] focus:outline-none focus:border-[#171717]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          )}
        </div>

        {activeTab === 'users' && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAEAEA] text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                  <th className="py-3 px-3">User ID</th>
                  <th className="py-3 px-3">Account</th>
                  <th className="py-3 px-3">Website &amp; Bot Role</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">WhatsApp Session</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA] text-xs">
                {filteredBots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#666666]">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredBots.map((item) => {
                    const isSelf = item.user_id === user?.id;
                    const isBusy = actionBusyId === item.user_id;

                    return (
                      <tr key={item.user_id} className="hover:bg-[#F7F8FA]/60">
                        <td className="py-3.5 px-3 font-mono font-medium text-[#171717]">
                          #{item.user_id}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-[#171717]">{item.username}</div>
                          <div className="text-[11px] text-[#666666]">{item.email}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <select
                            value={item.role}
                            disabled={isBusy}
                            onChange={(e) =>
                              handleChangeRole(item.user_id, e.target.value as UserRole)
                            }
                            className={`px-2.5 py-1 rounded-[8px] font-mono text-xs font-semibold border focus:outline-none ${
                              item.role === 'OWNER'
                                ? 'bg-[#171717] text-white border-[#171717]'
                                : 'bg-white text-[#171717] border-[#EAEAEA]'
                            }`}
                          >
                            <option value="OWNER" className="bg-white text-[#171717]">
                              OWNER
                            </option>
                            <option value="FREE" className="bg-white text-[#171717]">
                              FREE
                            </option>
                          </select>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase border ${
                              item.user_status === 'active'
                                ? 'bg-white text-[#171717] border-[#EAEAEA]'
                                : 'bg-[#171717] text-white border-[#171717]'
                            }`}
                          >
                            {item.user_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[11px]">
                          <span className="font-semibold text-[#171717]">
                            {item.connection_status.toUpperCase()}
                          </span>
                          {item.phone_number ? ` (+${item.phone_number})` : ''}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSelf || isBusy}
                              onClick={() => handleToggleBan(item.user_id, item.user_status)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#F7F8FA] border border-[#EAEAEA] text-xs font-medium text-[#171717] disabled:opacity-40"
                              title={item.user_status === 'active' ? 'Ban User' : 'Unban User'}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                              <span>{item.user_status === 'active' ? 'Ban' : 'Unban'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSelf || isBusy}
                              onClick={() => handleDeleteUser(item.user_id, item.username)}
                              className="p-1.5 rounded-[8px] bg-white hover:bg-[#F7F8FA] border border-[#EAEAEA] text-[#666666] hover:text-[#171717] disabled:opacity-40"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAEAEA] text-[11px] font-semibold uppercase tracking-wider text-[#666666]">
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Bot Name &amp; Prefix</th>
                  <th className="py-3 px-3">WhatsApp Number</th>
                  <th className="py-3 px-3">Connection</th>
                  <th className="py-3 px-3">Runtime</th>
                  <th className="py-3 px-3">Uptime</th>
                  <th className="py-3 px-3">Traffic</th>
                  <th className="py-3 px-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA] text-xs">
                {filteredBots.map((b) => {
                  const isBusy = actionBusyId === b.user_id;
                  return (
                    <tr key={b.user_id} className="hover:bg-[#F7F8FA]/60">
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-[#171717]">
                          {b.username}{' '}
                          <span className="font-mono text-[#666666]">#{b.user_id}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#666666]">{b.role}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-[#171717]">{b.bot_name}</div>
                        <div className="text-[11px] text-[#666666] font-mono">
                          Prefix: {b.prefix} | {b.public_mode ? 'Public' : 'Private'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        {b.phone_number ? `+${b.phone_number}` : 'Unlinked'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded font-mono text-[10px] font-semibold uppercase border ${
                            b.connection_status === 'connected'
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-[#F7F8FA] text-[#666666] border-[#EAEAEA]'
                          }`}
                        >
                          {b.connection_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] uppercase">
                        {b.bot_status}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        {b.connection_status === 'connected'
                          ? formatUptime(b.uptime_seconds)
                          : '0s'}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        {b.messages_received} msgs / {b.commands_executed} cmds
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOwnerBotAction(b.user_id, 'restart')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#F7F8FA] border border-[#EAEAEA] text-xs font-medium text-[#171717] disabled:opacity-40"
                            title="Restart User Bot"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Restart</span>
                          </button>

                          <button
                            onClick={() => handleOwnerBotAction(b.user_id, 'disconnect')}
                            disabled={isBusy || b.connection_status === 'disconnected'}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-white hover:bg-[#F7F8FA] border border-[#EAEAEA] text-xs font-medium text-[#171717] disabled:opacity-40"
                            title="Disconnect User WhatsApp"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                            <span>Disconnect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="mt-5 space-y-2 max-h-[500px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#666666]">
                No system logs recorded yet.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#EAEAEA] text-[10px] font-semibold uppercase">
                        {log.event}
                      </span>
                      <span className="text-[11px] font-semibold text-[#171717]">
                        {log.username ? `${log.username} (#${log.user_id})` : `User #${log.user_id}`}
                      </span>
                      <span className="text-[11px] text-[#666666]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#171717]">{log.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
