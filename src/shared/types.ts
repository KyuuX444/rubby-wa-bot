export type UserRole = 'OWNER' | 'FREE';
export type UserStatus = 'active' | 'banned' | 'inactive';
export type ConnectionStatus = 'disconnected' | 'waiting' | 'connecting' | 'connected';
export type BotRuntimeStatus = 'running' | 'stopped' | 'maintenance' | 'error';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  github_id?: string | null;
  github_username?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSessionInfo {
  id: number;
  user_id: number;
  phone_number: string | null;
  jid: string | null;
  push_name: string | null;
  connection_status: ConnectionStatus;
  bot_status: BotRuntimeStatus;
  messages_received: number;
  commands_executed: number;
  connected_at: string | null;
  updated_at: string;
  uptime_seconds: number;
}

export interface BotSettings {
  id: number;
  user_id: number;
  bot_name: string;
  prefix: string;
  auto_read: boolean;
  auto_typing: boolean;
  auto_online: boolean;
  public_mode: boolean;
  maintenance_mode: boolean;
  disabled_commands: string[];
  created_at: string;
  updated_at: string;
}

export interface BotLog {
  id: number;
  user_id: number;
  username?: string;
  event: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  created_at: string;
}

export interface BotCommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  category: 'main' | 'general' | 'info' | 'group' | 'owner';
  minRole: UserRole;
}

export interface OwnerGlobalStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  owner_users: number;
  free_users: number;
  connected_whatsapp: number;
  active_bots: number;
  disconnected_bots: number;
  total_messages: number;
  total_commands: number;
}

export interface OwnerBotMonitorItem {
  user_id: number;
  username: string;
  email: string;
  role: UserRole;
  user_status: UserStatus;
  github_username?: string | null;
  avatar_url?: string | null;
  phone_number: string | null;
  push_name: string | null;
  connection_status: ConnectionStatus;
  bot_status: BotRuntimeStatus;
  bot_name: string;
  prefix: string;
  public_mode: boolean;
  maintenance_mode: boolean;
  messages_received: number;
  commands_executed: number;
  connected_at: string | null;
  uptime_seconds: number;
}
