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
 * The schema is applied on first use, so setup is one database and one user
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
  service       VARCHAR(80)  NOT NULL,
  budget        VARCHAR(80)  NULL,
  message       TEXT         NOT NULL,
  ip_hash       CHAR(64)     NOT NULL,
  user_agent    VARCHAR(300) NULL,
  referer       VARCHAR(500) NULL,
  notified_at   DATETIME(3)  NULL,
  notify_status VARCHAR(200) NULL,
  INDEX enquiries_received_at (received_at),
  INDEX enquiries_ip_window (ip_hash, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

/**
 * Brings a table created by an earlier version up to the current shape.
 *
 * CREATE TABLE IF NOT EXISTS does nothing to a table that already exists,
 * so a database from before these changes would keep the columns below and
 * quietly fail every insert. Each step is guarded by what is actually in
 * information_schema, so this is safe to run on every connection and does
 * nothing at all on a current table.
 *
 *   country        collected from a Cloudflare header the form never asked
 *                  for. Dropped.
 *   notify_error   became notify_status, which is filled in either way:
 *                  the reason on failure, "No problem" on success. A column
 *                  that is NULL both when all is well and when nothing has
 *                  happened yet cannot be read at a glance.
 *   service/budget now hold labels ("Digital Advertising"), not ids, so the
 *                  columns need the room.
 */
export const MIGRATIONS = [
  {
    when: (columns) => columns.has('country'),
    sql: 'ALTER TABLE enquiries DROP COLUMN country'
  },
  {
    when: (columns) => columns.has('notify_error') && !columns.has('notify_status'),
    sql: 'ALTER TABLE enquiries CHANGE notify_error notify_status VARCHAR(200) NULL'
  },
  {
    when: (columns) => (columns.get('service')?.length ?? 80) < 80,
    sql: 'ALTER TABLE enquiries MODIFY service VARCHAR(80) NOT NULL'
  },
  {
    when: (columns) => (columns.get('budget')?.length ?? 80) < 80,
    sql: 'ALTER TABLE enquiries MODIFY budget VARCHAR(80) NULL'
  }
]

/** True once this isolate has confirmed the schema. Reset per deploy. */
let schemaReady = false

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

async function ensureSchema(connection) {
  await connection.query(CREATE_TABLE)

  const [rows] = await connection.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enquiries'`
  )
  const columns = new Map(
    rows.map((row) => [row.COLUMN_NAME, { length: Number(row.CHARACTER_MAXIMUM_LENGTH || 0) }])
  )

  for (const step of MIGRATIONS) {
    if (!step.when(columns)) continue
    console.info(`[db] migrating: ${step.sql}`)
    await connection.query(step.sql)
  }
}

/** Runs `fn(connection)` on a fresh connection and always closes it. */
export async function withDb(env, fn) {
  const connection = await open(env)
  try {
    if (!schemaReady) {
      await ensureSchema(connection)
      schemaReady = true
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
