/**
 * MySQL access for the contact Worker.
 *
 * The enquiries live in the hosting account's own MySQL database, reached
 * directly from the Worker with mysql2 over a TCP socket (Cloudflare's
 * nodejs_compat layer carries node:net onto cloudflare:sockets). One
 * connection is opened per request and closed after it; a contact form does
 * not need a pool.
 *
 * Nothing here is reachable unless the hosting allows remote MySQL
 * connections — in cPanel that is "Remote MySQL" with the access host `%`,
 * in Plesk "Access control → allow remote connections from any host".
 * Cloudflare's egress addresses change, so a narrower host will not hold.
 *
 * TLS: the driver asks for a secure connection when MYSQL_SSL is "require"
 * or "prefer" (the default). With "prefer" a server that has no TLS gets a
 * plain connection instead of a failure; the password itself is never sent
 * in clear either way — MySQL authentication is challenge/response — but
 * the enquiry text would be. Set "require" once the host confirms TLS.
 *
 * The table is created on first use, so setup is one database and one user
 * with rights on it; migrations/enquiries.mysql.sql is the same statement
 * for anyone who prefers phpMyAdmin.
 */

import mysql from 'mysql2/promise'

export const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS enquiries (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  received_at   DATETIME(3)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  company       VARCHAR(160) NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(40)  NULL,
  service       VARCHAR(40)  NOT NULL,
  budget        VARCHAR(40)  NULL,
  message       TEXT         NOT NULL,
  ip_hash       CHAR(64)     NOT NULL,
  country       CHAR(2)      NULL,
  user_agent    VARCHAR(300) NULL,
  referer       VARCHAR(500) NULL,
  notified_at   DATETIME(3)  NULL,
  notify_error  VARCHAR(200) NULL,
  INDEX enquiries_received_at (received_at),
  INDEX enquiries_ip_window (ip_hash, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

/** True once this isolate has confirmed the table exists. */
let tableReady = false

export function configured(env) {
  return Boolean(env.MYSQL_HOST && env.MYSQL_DATABASE && env.MYSQL_USER && env.MYSQL_PASSWORD)
}

/**
 * Opens a connection for one request. Callers must `end()` it — use
 * `withDb` below, which does that on every path.
 */
async function open(env) {
  const base = {
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    timezone: 'Z',
    connectTimeout: 10_000,
    // Workers forbid eval(); mysql2 has a slower parser that does without.
    disableEval: true
  }

  const mode = (env.MYSQL_SSL || 'prefer').toLowerCase()
  if (mode === 'off') return mysql.createConnection(base)

  try {
    return await mysql.createConnection({ ...base, ssl: { rejectUnauthorized: mode === 'require' } })
  } catch (error) {
    // "prefer" means exactly this: fall back to plain when the server has
    // no TLS at all. Any other failure (bad password, host unreachable) is
    // the same on both transports and must not be masked by a retry.
    if (mode === 'prefer' && /does not support secure connection|SSL/i.test(String(error?.message))) {
      console.warn('[db] MySQL server has no TLS — connecting in plain (set MYSQL_SSL=require to refuse this)')
      return mysql.createConnection(base)
    }
    throw error
  }
}

/** Runs `fn(connection)` on a fresh connection and always closes it. */
export async function withDb(env, fn) {
  const connection = await open(env)
  try {
    if (!tableReady) {
      await connection.query(CREATE_TABLE)
      tableReady = true
    }
    return await fn(connection)
  } finally {
    await connection.end().catch(() => {})
  }
}

/** MySQL DATETIME(3) in UTC from an ISO string. */
export function toDateTime(iso) {
  return iso.replace('T', ' ').replace('Z', '')
}
