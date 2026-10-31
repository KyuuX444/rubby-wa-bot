import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Radio,
  User as UserIcon,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RubbyLogo } from './RubbyLogo';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, wsConnected, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    '/dashboard': {
      title: 'Bot Overview & Connection',
      subtitle: 'Manage your WhatsApp connection, runtime metrics, and live command logs',
    },
    '/settings': {
      title: 'Bot Configuration',
      subtitle: 'Customize prefix, presence behavior, access mode, and active commands',
    },
    '/owner': {
      title: 'Owner Administration',
      subtitle: 'Global user management, real-time role synchronization, and system monitoring',
    },
  };

  const currentMeta = pageMeta[location.pathname] || pageMeta['/dashboard'];

  const workspaceNav = [
    {
      to: '/dashboard',
      label: 'Overview',
      description: 'Connection & Runtime',
      icon: LayoutDashboard,
    },
    {
      to: '/settings',
      label: 'Bot Settings',
      description: 'Prefix & Preferences',
      icon: Settings,
    },
  ];

  const adminNav =
    user?.role === 'OWNER'
      ? [
          {
            to: '/owner',
            label: 'Owner Panel',
            description: 'Users, Roles & Global Bots',
            icon: ShieldCheck,
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#171717] flex">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#FFFFFF] border-r border-[#EAEAEA] z-30">
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#EAEAEA]">
          <NavLink to="/dashboard" className="flex items-center gap-3 group">
            <RubbyLogo className="w-9 h-9 shrink-0 transition-transform group-hover:scale-[1.03]" />
            <div>
              <span className="font-semibold text-[15px] tracking-tight text-[#171717] block leading-none">
                Rubby WA Bot
              </span>
              <span className="text-[11px] text-[#666666] font-mono mt-1 block">
                ruby-baileys v1.5
              </span>
            </div>
          </NavLink>
        </div>

        <div className="flex-1 px-3.5 py-5 space-y-6 overflow-y-auto">
          <div>
            <div className="px-2.5 mb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
              Workspace
            </div>
            <nav className="space-y-1">
              {workspaceNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-[10px] text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#171717] text-white shadow-sm'
                          : 'text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <div>
                            <div className="leading-none font-medium">{item.label}</div>
                            <div
                              className={`text-[10px] mt-1 ${
                                isActive ? 'text-white/70' : 'text-[#999999]'
                              }`}
                            >
                              {item.description}
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-transparent'}`}
                        />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {adminNav.length > 0 && (
            <div>
              <div className="px-2.5 mb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#666666]">
                Administration
              </div>
              <nav className="space-y-1">
                {adminNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2.5 rounded-[10px] text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-[#171717] text-white shadow-sm'
                            : 'text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div>
                              <div className="leading-none font-medium">{item.label}</div>
                              <div
                                className={`text-[10px] mt-1 ${
                                  isActive ? 'text-white/70' : 'text-[#999999]'
                                }`}
                              >
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-3.5 h-3.5 ${
                              isActive ? 'text-white' : 'text-transparent'
                            }`}
                          />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}

          <div className="p-3.5 rounded-[12px] bg-[#F7F8FA] border border-[#EAEAEA] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#171717] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#171717]" />
                <span>Role Integration</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#EAEAEA] text-[#171717]">
                Live
              </span>
            </div>
            <p className="text-[11px] text-[#666666] leading-relaxed">
              Your website account role (<strong className="text-[#171717]">{user?.role}</strong>)
              automatically determines your WhatsApp bot permissions.
            </p>
          </div>
        </div>

        <div className="p-3.5 border-t border-[#EAEAEA] space-y-3 bg-[#FFFFFF]">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-[8px] bg-[#F7F8FA] border border-[#EAEAEA] text-[11px] text-[#666666]">
            <span className="flex items-center gap-1.5">
              <Radio
                className={`w-3.5 h-3.5 ${
                  wsConnected ? 'text-[#171717]' : 'text-[#999999] animate-pulse'
                }`}
              />
              <span>Realtime Socket</span>
            </span>
            <span className="font-mono font-medium text-[#171717]">
              {wsConnected ? 'ONLINE' : 'SYNCING'}
            </span>
          </div>

          {user && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-[10px] border border-[#EAEAEA] bg-[#FFFFFF]">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-[8px] object-cover border border-[#EAEAEA] shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-[8px] bg-[#171717] text-white flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#171717] truncate">
                      {user.username}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                        user.role === 'OWNER'
                          ? 'bg-[#171717] text-white border-[#171717]'
                          : 'bg-[#F7F8FA] text-[#171717] border-[#EAEAEA]'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#666666] font-mono truncate">
                    {user.github_username ? `gh/@${user.github_username}` : `ID #${user.id}`}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-[8px] text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA] transition-colors shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-[#FFFFFF]/95 backdrop-blur border-b border-[#EAEAEA] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-[10px] text-[#171717] hover:bg-[#F7F8FA] border border-[#EAEAEA]"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="lg:hidden flex items-center gap-2">
              <RubbyLogo className="w-7 h-7" />
              <span className="font-semibold text-sm text-[#171717]">Rubby WA Bot</span>
            </div>

            <div className="hidden lg:block">
              <h1 className="text-sm font-semibold text-[#171717] leading-none">
                {currentMeta.title}
              </h1>
              <p className="text-xs text-[#666666] mt-1">{currentMeta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[#F7F8FA] border border-[#EAEAEA] text-xs">
              <span className="text-[#666666]">Bot Role:</span>
              <span className="font-mono font-semibold text-[#171717]">{user?.role}</span>
            </div>
            {user && (
              <div className="lg:hidden flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-[#171717] text-white">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFFFF] border-b border-[#EAEAEA] px-4 py-4 space-y-3 shadow-sm">
            {user && (
              <div className="flex items-center justify-between p-3 rounded-[10px] bg-[#F7F8FA] border border-[#EAEAEA]">
                <div>
                  <div className="text-xs font-semibold text-[#171717]">{user.username}</div>
                  <div className="text-[11px] text-[#666666] font-mono">Account ID #{user.id}</div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#171717] text-white">
                  {user.role}
                </span>
              </div>
            )}

            <div className="space-y-1">
              {[...workspaceNav, ...adminNav].map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-xs font-medium ${
                        isActive
                          ? 'bg-[#171717] text-white'
                          : 'text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-xs font-medium text-[#666666] hover:text-[#171717] hover:bg-[#F7F8FA] border border-[#EAEAEA]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>

        <footer className="bg-[#FFFFFF] border-t border-[#EAEAEA] py-3.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#666666] gap-2">
            <span>Rubby WA Bot — Isolated Multi-Device WhatsApp Platform</span>
            <span className="font-mono">Powered by ruby-baileys</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
