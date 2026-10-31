import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { query } from '../db/pool.js';
import type { UserRole } from '../../shared/types.js';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: number;
  username: string;
  role: UserRole;
  sessionId: string;
}

class RealtimeHub {
  private wss: WebSocketServer;
  private clients: Set<AuthenticatedClient> = new Set();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  public async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    try {
      const cookieHeader = request.headers.cookie || '';
      const cookies = Object.fromEntries(
        cookieHeader
          .split(';')
          .map((c) => c.trim().split('='))
          .filter((parts) => parts.length === 2)
          .map(([k, v]) => [k, decodeURIComponent(v)])
      );

      const sessionToken = cookies['wbm_session'];
      if (!sessionToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const res = await query<{
        session_id: string;
        user_id: number;
        username: string;
        role: UserRole;
        status: string;
      }>(
        `SELECT s.id AS session_id, u.id AS user_id, u.username, u.role, u.status
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW()`,
        [sessionToken]
      );

      if (res.rows.length === 0 || res.rows[0].status !== 'active') {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const authData = res.rows[0];

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        const client: AuthenticatedClient = {
          ws,
          userId: authData.user_id,
          username: authData.username,
          role: authData.role,
          sessionId: authData.session_id,
        };

        this.clients.add(client);

        ws.send(
          JSON.stringify({
            type: 'connected',
            payload: {
              userId: client.userId,
              role: client.role,
              timestamp: new Date().toISOString(),
            },
          })
        );

        ws.on('close', () => {
          this.clients.delete(client);
        });

        ws.on('error', () => {
          this.clients.delete(client);
        });
      });
    } catch (error) {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  public sendToUser(userId: number, type: string, payload: unknown): void {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  public sendToOwners(type: string, payload: unknown): void {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.role === 'OWNER' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  public updateUserRole(userId: number, newRole: UserRole): void {
    for (const client of this.clients) {
      if (client.userId === userId) {
        client.role = newRole;
      }
    }
    this.sendToUser(userId, 'role.update', { userId, role: newRole });
  }

  public disconnectUser(userId: number, reason = 'Session terminated'): void {
    for (const client of this.clients) {
      if (client.userId === userId) {
        try {
          client.ws.send(
            JSON.stringify({
              type: 'auth.revoked',
              payload: { reason },
            })
          );
          client.ws.close(4001, reason);
        } catch {
        }
        this.clients.delete(client);
      }
    }
  }
}

export const realtimeHub = new RealtimeHub();
