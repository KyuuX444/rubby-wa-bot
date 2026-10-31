import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Sliders,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { BotSettings, BotCommandDefinition } from '../../shared/types';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [botName, setBotName] = useState('WhatsApp Bot');
  const [prefix, setPrefix] = useState('/');
  const [autoRead, setAutoRead] = useState(false);
  const [autoTyping, setAutoTyping] = useState(true);
  const [autoOnline, setAutoOnline] = useState(true);
  const [publicMode, setPublicMode] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [commands, setCommands] = useState<BotCommandDefinition[]>([]);

  const loadSettings = useCallback(async () => {
    try {
      setError(null);
      const data = await apiRequest<{
        settings: BotSettings;
        commands: BotCommandDefinition[];
      }>('/api/bot/dashboard');

      const s = data.settings;
      setBotName(s.bot_name);
      setPrefix(s.prefix);
      setAutoRead(Boolean(s.auto_read));
      setAutoTyping(Boolean(s.auto_typing));
      setAutoOnline(Boolean(s.auto_online));
      setPublicMode(Boolean(s.public_mode));
      setMaintenanceMode(Boolean(s.maintenance_mode));
      setDisabledCommands(Array.isArray(s.disabled_commands) ? s.disabled_commands : []);
      setCommands(data.commands || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bot settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleCommand = (cmdName: string) => {
    setDisabledCommands((prev) =>
      prev.includes(cmdName) ? prev.filter((c) => c !== cmdName) : [...prev, cmdName]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await apiRequest<{ message: string; settings: BotSettings }>(
        '/api/bot/settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            bot_name: botName,
            prefix,
            auto_read: autoRead,
            auto_typing: autoTyping,
            auto_online: autoOnline,
            public_mode: publicMode,
            maintenance_mode: maintenanceMode,
            disabled_commands: disabledCommands,
          }),
        }
      );
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse-subtle">
        <div className="h-20 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6" />
        <div className="h-96 bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-center">
            <Sliders className="w-5 h-5 text-[#171717]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#171717]">Bot Configuration</h1>
            <p className="text-xs text-[#666666]">
              Settings are persisted in PostgreSQL and applied immediately to your active bot runtime
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#EAEAEA] text-xs font-medium text-[#171717] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#171717] flex items-center gap-2.5 text-xs text-[#171717]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-[12px] bg-[#FFFFFF] border border-[#171717] flex items-center gap-2.5 text-xs text-[#171717]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[#171717] pb-3 border-b border-[#EAEAEA]">
            Identity &amp; Command Trigger
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#171717] mb-1.5">Bot Name</label>
              <input
                type="text"
                required
                maxLength={80}
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="WhatsApp Bot"
                className="w-full px-3.5 py-2.5 text-sm bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] focus:outline-none focus:border-[#171717]"
              />
              <p className="text-[11px] text-[#666666] mt-1">
                Displayed in command responses (/menu, /status, /ping).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#171717] mb-1.5">
                Command Prefix
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="/"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FFFFFF] border border-[#EAEAEA] rounded-[10px] text-[#171717] focus:outline-none focus:border-[#171717]"
              />
              <p className="text-[11px] text-[#666666] mt-1">
                Examples: <code className="font-mono">/</code>, <code className="font-mono">!</code>
                , <code className="font-mono">.</code>, <code className="font-mono">#</code>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#171717] pb-3 border-b border-[#EAEAEA]">
            Runtime Behavior &amp; Access Control
          </h2>

          <ToggleRow
            title="Public Mode"
            description="When enabled, anyone can execute commands on your bot. When disabled (Private Mode), only messages sent from your own number are processed."
            checked={publicMode}
            onChange={setPublicMode}
          />

          <ToggleRow
            title="Auto Read Incoming Messages"
            description="Automatically send blue read receipts (sock.readMessages) when messages arrive."
            checked={autoRead}
            onChange={setAutoRead}
          />

          <ToggleRow
            title="Auto Typing Indicator"
            description="Display 'typing...' presence indicator in chat before sending command responses."
            checked={autoTyping}
            onChange={setAutoTyping}
          />

          <ToggleRow
            title="Auto Online Presence"
            description="Keep WhatsApp presence set to 'available' while bot socket is connected."
            checked={autoOnline}
            onChange={setAutoOnline}
          />

          <ToggleRow
            title="Maintenance Mode"
            description="Temporarily pause public command execution and reply with a maintenance notice."
            checked={maintenanceMode}
            onChange={setMaintenanceMode}
          />
        </div>

        <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-[12px] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EAEAEA]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#171717]" />
              <h2 className="text-sm font-semibold text-[#171717]">Manage Commands</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#666666]">
              <Shield className="w-3.5 h-3.5 text-[#171717]" />
              <span>Synchronized Role: {user?.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {commands.map((cmd) => {
              const enabled = !disabledCommands.includes(cmd.name);
              return (
                <div
                  key={cmd.name}
                  className="p-3.5 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA] flex items-center justify-between gap-3"
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
                    </div>
                    <p className="text-[11px] text-[#666666] mt-1">{cmd.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCommand(cmd.name)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      enabled ? 'bg-[#171717]' : 'bg-[#D4D4D4]'
                    }`}
                    role="switch"
                    aria-checked={enabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[10px] bg-[#171717] hover:bg-[#262626] disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Configuration...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save &amp; Apply Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const ToggleRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div>
      <div className="text-xs font-semibold text-[#171717]">{title}</div>
      <div className="text-xs text-[#666666] mt-0.5">{description}</div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked ? 'bg-[#171717]' : 'bg-[#D4D4D4]'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);
