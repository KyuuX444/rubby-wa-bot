import { query } from '../server/db/pool.js';

const ROLE_HIERARCHY = {
  FREE: 1,
  OWNER: 2,
};

export async function getLiveUserAccount(userId) {
  const res = await query(
    `SELECT id, username, email, role, status
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0];
}

export async function authorizeBotAction(userId, requiredRole = 'FREE') {
  const user = await getLiveUserAccount(userId);

  if (!user) {
    return {
      allowed: false,
      user: null,
      reason: 'User account not found in database.',
    };
  }

  if (user.status !== 'active') {
    return {
      allowed: false,
      user,
      reason: `Website account status is ${user.status.toUpperCase()}. Bot actions are suspended.`,
    };
  }

  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 1;

  if (userLevel < requiredLevel) {
    return {
      allowed: false,
      user,
      reason: `Permission denied. Command requires website role ${requiredRole}, but your current website role is ${user.role}.`,
    };
  }

  return {
    allowed: true,
    user,
  };
}
