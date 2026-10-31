import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';
import type { User, UserRole } from '../../shared/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      csrfToken?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = req.cookies?.['wbm_session'];
    if (!sessionToken || typeof sessionToken !== 'string') {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const sessionRes = await query<{
      session_id: string;
      csrf_token: string;
      id: number;
      username: string;
      email: string;
      role: UserRole;
      status: 'active' | 'banned' | 'inactive';
      github_id: string | null;
      github_username: string | null;
      avatar_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
         s.id AS session_id,
         s.csrf_token,
         u.id,
         u.username,
         u.email,
         u.role,
         u.status,
         u.github_id,
         u.github_username,
         u.avatar_url,
         u.created_at,
         u.updated_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()
       LIMIT 1`,
      [sessionToken]
    );

    if (sessionRes.rows.length === 0) {
      res.clearCookie('wbm_session', { path: '/' });
      res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
      return;
    }

    const row = sessionRes.rows[0];

    if (row.status !== 'active') {
      await query(`DELETE FROM user_sessions WHERE user_id = $1`, [row.id]);
      res.clearCookie('wbm_session', { path: '/' });
      res.status(403).json({
        error: `Your account is currently ${row.status}. Access has been revoked.`,
      });
      return;
    }

    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (unsafeMethods.includes(req.method.toUpperCase())) {
      const headerCsrf = req.headers['x-csrf-token'];
      if (!headerCsrf || headerCsrf !== row.csrf_token) {
        res.status(403).json({ error: 'Invalid or missing CSRF security token.' });
        return;
      }
    }

    req.user = {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      status: row.status,
      github_id: row.github_id,
      github_username: row.github_username,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    req.sessionId = row.session_id;
    req.csrfToken = row.csrf_token;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (requiredRole === 'OWNER' && req.user.role !== 'OWNER') {
      res.status(403).json({
        error: 'Access denied. This resource requires OWNER privileges.',
      });
      return;
    }

    next();
  };
}
