// DB抽象化層 — ローカル: better-sqlite3（同期）、本番: Turso/libSQL（HTTP）
// 全関数をasyncに統一して呼び出し側を共通化

import type { Client as LibsqlClient } from "@libsql/client";
import type Database from "better-sqlite3";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    fortune_context TEXT,
    score REAL,
    -- このセッションの鑑定文を、他の相談者のプロンプトに参考として混ぜてよいか。
    -- 既定は 0 (不可)。1 にできるのは運用者の手作業だけで、HTTP 経路は無い。
    -- score だけを条件にすると、相談者が自分の発話でスコアを操作できてしまう
    -- (2026-08-07 セキュリティ監査 / session-rag.test.ts に再現条件)
    rag_approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    score REAL NOT NULL,
    positive_signals TEXT,
    negative_signals TEXT,
    message_count INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_fortune_keys (
    session_id TEXT PRIMARY KEY REFERENCES sessions(id),
    day_stem TEXT,
    zodiac_sign TEXT,
    life_path INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_fortune_keys_day_stem ON session_fortune_keys(day_stem);
  CREATE INDEX IF NOT EXISTS idx_fortune_keys_zodiac ON session_fortune_keys(zodiac_sign);
  CREATE INDEX IF NOT EXISTS idx_fortune_keys_life_path ON session_fortune_keys(life_path);

  CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT PRIMARY KEY,
    hits INTEGER NOT NULL,
    window_start INTEGER NOT NULL
  );
`;

// 統一インターフェース
export interface DbAdapter {
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  executeMulti(sql: string): Promise<void>;
}

// --- Turso (libSQL) アダプター ---
class TursoAdapter implements DbAdapter {
  private client: LibsqlClient | null = null;

  private async getClient(): Promise<LibsqlClient> {
    if (this.client) return this.client;
    const { createClient } = await import("@libsql/client");
    this.client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return this.client;
  }

  async execute(sql: string, params: unknown[] = []) {
    const client = await this.getClient();
    const result = await client.execute({ sql, args: params as any });
    return { rows: result.rows as unknown as Record<string, unknown>[] };
  }

  async executeMulti(sql: string) {
    const client = await this.getClient();
    // libSQL はセミコロン区切りの複数文を batch で実行
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await client.batch(
      statements.map((s) => ({ sql: s, args: [] })),
      "write",
    );
  }
}

// --- better-sqlite3 アダプター（ローカル開発用） ---
class SqliteAdapter implements DbAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    const path = require("path");
    this.dbPath = dbPath ?? path.join(process.cwd(), "data", "fortune.db");
  }

  private getDb(): Database.Database {
    if (this.db) return this.db;
    const BetterSqlite3 = require("better-sqlite3");
    const path = require("path");
    const fs = require("fs");
    if (this.dbPath !== ":memory:") {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new BetterSqlite3(this.dbPath) as Database.Database;
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    return this.db;
  }

  async execute(sql: string, params: unknown[] = []) {
    const db = this.getDb();
    const trimmed = sql.trim().toUpperCase();
    // INSERT ... RETURNING も行を返す。rate_limits の upsert が
    // 「加算した結果の値」を 1 往復で受け取るために必要 (libSQL 側は既に対応)。
    const returnsRows =
      trimmed.startsWith("SELECT") ||
      trimmed.startsWith("WITH") ||
      /\bRETURNING\b/.test(trimmed);
    if (returnsRows) {
      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return { rows };
    }
    db.prepare(sql).run(...params);
    return { rows: [] };
  }

  async executeMulti(sql: string) {
    const db = this.getDb();
    db.exec(sql);
  }
}

// --- シングルトン ---
let adapter: DbAdapter | null = null;
let initialized = false;

export function getAdapter(): DbAdapter {
  if (adapter) return adapter;
  adapter = process.env.TURSO_DATABASE_URL
    ? new TursoAdapter()
    : new SqliteAdapter();
  return adapter;
}

/**
 * テスト専用: アダプターをリセットしてin-memory DBや一時ファイルDBに差し替える
 * 本番コードでは使わないこと
 */
export function _resetAdapterForTesting(dbPath: string = ":memory:"): void {
  adapter = new SqliteAdapter(dbPath);
  initialized = false;
}

/**
 * 既存 DB への後付けカラム。
 *
 * `CREATE TABLE IF NOT EXISTS` は既にあるテーブルを更新しないので、
 * 稼働中の DB には別途 ALTER が要る。既に列がある場合は SQLite が
 * "duplicate column name" で落ちるだけなので握りつぶしてよい。
 */
const ADDITIVE_MIGRATIONS = [
  "ALTER TABLE sessions ADD COLUMN rag_approved INTEGER NOT NULL DEFAULT 0",
];

export async function ensureSchema() {
  if (initialized) return;
  const db = getAdapter();
  await db.executeMulti(SCHEMA);
  for (const sql of ADDITIVE_MIGRATIONS) {
    try {
      await db.execute(sql);
    } catch {
      // 列が既に存在する。新規 DB では SCHEMA 側で作られている
    }
  }
  initialized = true;
}

// --- 公開API（全てasync） ---

export async function createSession(sessionId: string): Promise<void> {
  await ensureSchema();
  const db = getAdapter();
  await db.execute("INSERT OR IGNORE INTO sessions (id) VALUES (?)", [
    sessionId,
  ]);
}

export async function getSession(sessionId: string): Promise<{
  messages: { role: "user" | "assistant"; content: string }[];
  fortuneContext: string | null;
} | null> {
  await ensureSchema();
  const db = getAdapter();

  const { rows: sessions } = await db.execute(
    "SELECT id, fortune_context FROM sessions WHERE id = ?",
    [sessionId],
  );
  if (sessions.length === 0) return null;

  const { rows: messages } = await db.execute(
    "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id",
    [sessionId],
  );

  return {
    messages: messages as unknown as {
      role: "user" | "assistant";
      content: string;
    }[],
    fortuneContext: (sessions[0].fortune_context as string) || null,
  };
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await ensureSchema();
  const db = getAdapter();
  await db.execute(
    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
    [sessionId, role, content],
  );
  await db.execute(
    "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?",
    [sessionId],
  );
}

export async function setFortuneContext(
  sessionId: string,
  context: string,
): Promise<void> {
  await ensureSchema();
  const db = getAdapter();
  await db.execute("UPDATE sessions SET fortune_context = ? WHERE id = ?", [
    context,
    sessionId,
  ]);
}

export async function saveScore(
  sessionId: string,
  score: number,
  positiveSignals: string[],
  negativeSignals: string[],
  messageCount: number,
): Promise<void> {
  await ensureSchema();
  const db = getAdapter();
  await db.execute(
    `INSERT INTO scores (session_id, score, positive_signals, negative_signals, message_count)
     VALUES (?, ?, ?, ?, ?)`,
    [
      sessionId,
      score,
      JSON.stringify(positiveSignals),
      JSON.stringify(negativeSignals),
      messageCount,
    ],
  );
  await db.execute("UPDATE sessions SET score = ? WHERE id = ?", [
    score,
    sessionId,
  ]);
}
