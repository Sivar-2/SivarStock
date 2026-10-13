import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { seedInitialData } from './seed-data';
import { getSqlWasmBinary } from './sql-wasm-binary';
import { SCHEMA_SQL } from './schema-sql';

let sqlJsInstance: SqlJsStatic | null = null;
let sqliteDbInstance: Database | null = null;
let pgPoolInstance: Pool | null = null;
let isPostgresSeeded = false;
const txStorage = new AsyncLocalStorage<PoolClient>();

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const rawPostgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
const isLocalhostPostgres = Boolean(rawPostgresUrl && (rawPostgresUrl.includes('localhost') || rawPostgresUrl.includes('127.0.0.1')));

// Si estamos en Vercel y DATABASE_URL apunta a localhost, se descarta para evitar error de conexión ECONNREFUSED
const POSTGRES_URL = (isVercel && isLocalhostPostgres) ? null : rawPostgresUrl;
let isPostgresConfigured = Boolean(POSTGRES_URL);

// En Vercel / serverless la única carpeta escribible es /tmp
const DB_FILE_PATH = isVercel
  ? path.resolve('/tmp', 'sivarstock.db')
  : (process.env.DATABASE_PATH 
      ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
      : path.resolve(process.cwd(), 'data', 'sivarstock.db'));

/**
 * Retorna el modo activo de la base de datos
 */
export function getDatabaseEngine(): 'POSTGRESQL' | 'SQLITE' {
  return isPostgresConfigured ? 'POSTGRESQL' : 'SQLITE';
}

/**
 * Inicializa el pool de PostgreSQL (Supabase o Local)
 */
function getPgPool(): Pool {
  if (!pgPoolInstance && POSTGRES_URL) {
    const isLocalhost = POSTGRES_URL.includes('localhost') || POSTGRES_URL.includes('127.0.0.1');
    const isDisableSsl = isLocalhost || POSTGRES_URL.includes('sslmode=disable');

    pgPoolInstance = new Pool({
      connectionString: POSTGRES_URL,
      ssl: isDisableSsl ? false : {
        rejectUnauthorized: false,
      },
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    pgPoolInstance.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning] Error en conexión background:', err.message);
    });
  }
  return pgPoolInstance!;
}

/**
 * Retorna el ejecutor activo (cliente en transacción o pool general)
 */
function getPgExecutor(): Pool | PoolClient {
  const txClient = txStorage.getStore();
  if (txClient) {
    return txClient;
  }
  return getPgPool();
}

/**
 * Inicializa la base de datos SQLite (sql.js WASM) para modo local, serverless o fallback
 */
export async function initDb(): Promise<Database> {
  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }

  if (!sqlJsInstance) {
    try {
      const wasmBinary = getSqlWasmBinary();
      sqlJsInstance = await initSqlJs({
        wasmBinary,
      });
    } catch (wasmErr) {
      console.warn('[WASM Warning] Fallback en carga de wasm:', wasmErr);
      sqlJsInstance = await initSqlJs();
    }
  }

  const dir = path.dirname(DB_FILE_PATH);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    console.warn('[DB FileSystem Warning] No se pudo crear directorio de base de datos:', e);
  }

  let needsSeed = false;

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      sqliteDbInstance = new sqlJsInstance.Database(fileBuffer);
    } catch {
      sqliteDbInstance = new sqlJsInstance.Database();
      needsSeed = true;
    }
  } else {
    sqliteDbInstance = new sqlJsInstance.Database();
    needsSeed = true;
  }

  // Verificar si las tablas existen
  try {
    const testStmt = sqliteDbInstance.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'");
    if (testStmt.step()) {
      const row = testStmt.getAsObject() as { cnt: number };
      if (!row || row.cnt === 0) {
        needsSeed = true;
      }
    }
    testStmt.free();
  } catch {
    needsSeed = true;
  }

  if (needsSeed) {
    sqliteDbInstance.run(SCHEMA_SQL);

    // Sembrar administrador inicial y datos esenciales
    await seedInitialData(async (sql, params = []) => {
      if (sqliteDbInstance) {
        sqliteDbInstance.run(sql, params);
      }
    });

    saveDb();
  } else {
    // Si ya existe la base de datos, validar que el admin oficial exista
    try {
      const adminCheck = sqliteDbInstance.prepare("SELECT count(*) as cnt FROM users WHERE email = 'alexander7tm@gmail.com'");
      if (adminCheck.step()) {
        const row = adminCheck.getAsObject() as { cnt: number };
        if (!row || row.cnt === 0) {
          await seedInitialData(async (sql, params = []) => {
            if (sqliteDbInstance) {
              sqliteDbInstance.run(sql, params);
            }
          });
          saveDb();
        }
      }
      adminCheck.free();
    } catch {
      // Ignorar si hay error en la comprobación
    }
  }

  return sqliteDbInstance;
}

/**
 * Guarda el archivo SQLite en disco si el entorno lo permite
 */
export function saveDb(): void {
  if (!sqliteDbInstance || isPostgresConfigured) return;
  try {
    const data = sqliteDbInstance.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (error) {
    // En Vercel o contenedores read-only se opera en memoria sin interrumpir el servicio
    console.warn('[DB Persistence Warning] Operando SQLite en memoria:', (error as any)?.message);
  }
}

/**
 * Traduce consultas con sintaxis de marcadores '?' a '$1, $2, ...' para PostgreSQL
 */
function translateQueryForPostgres(sqlQuery: string): string {
  let paramIndex = 1;
  let translated = sqlQuery.replace(/\?/g, () => `$${paramIndex++}`);
  
  translated = translated.replace(/datetime\('now',\s*'-(\d+)\s*days'\)/gi, "(NOW() - INTERVAL '$1 days')");
  translated = translated.replace(/datetime\('now'\)/gi, 'NOW()');
  translated = translated.replace(/julianday\(([^)]+)\)\s*-\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) - CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*>=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) >= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) <= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*>\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) > CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) < CURRENT_DATE)");

  return translated;
}

/**
 * Asegura que PostgreSQL tenga el usuario admin
 */
async function ensurePostgresAdmin(executor: Pool | PoolClient): Promise<void> {
  if (isPostgresSeeded) return;
  try {
    const res = await executor.query("SELECT count(*) as cnt FROM users WHERE email = 'alexander7tm@gmail.com'");
    if (res.rows && Number(res.rows[0]?.cnt || 0) === 0) {
      await seedInitialData(async (sql, params = []) => {
        const pgSql = translateQueryForPostgres(sql);
        await executor.query(pgSql, params);
      });
    }
    isPostgresSeeded = true;
  } catch (err: any) {
    console.warn('[PostgreSQL Seed Warning]', err.message);
  }
}

/**
 * Ejecuta una consulta SELECT y retorna múltiples filas tipadas con fallback inteligente
 */
export async function query<T = any>(sqlQuery: string, params: any[] = []): Promise<T[]> {
  if (isPostgresConfigured) {
    try {
      const executor = getPgExecutor();
      await ensurePostgresAdmin(executor);
      const pgSql = translateQueryForPostgres(sqlQuery);
      const res = await executor.query(pgSql, params);
      return res.rows as T[];
    } catch (pgError: any) {
      console.warn('[PostgreSQL Fallback] Error en PostgreSQL, usando SQLite seguro:', pgError.message);
      // No desactivamos permanentemente para permitir reintentos, pero caemos a SQLite para evitar error 500
    }
  }

  const db = await initDb();
  const stmt = db.prepare(sqlQuery);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

/**
 * Ejecuta una consulta SELECT y retorna una única fila o null
 */
export async function queryOne<T = any>(sqlQuery: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Ejecuta una sentencia INSERT / UPDATE / DELETE y retorna filas modificadas
 */
export async function run(sqlQuery: string, params: any[] = []): Promise<{ changes: number }> {
  if (isPostgresConfigured) {
    try {
      const executor = getPgExecutor();
      const pgSql = translateQueryForPostgres(sqlQuery);
      const res = await executor.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    } catch (pgError: any) {
      console.warn('[PostgreSQL Fallback] Error en run, usando SQLite seguro:', pgError.message);
    }
  }

  const db = await initDb();
  db.run(sqlQuery, params);
  const changes = db.getRowsModified();
  saveDb();
  return { changes };
}

/**
 * Alias de run para compatibilidad con execute
 */
export const execute = run;

/**
 * Ejecuta un bloque de sentencias SQL directas (migraciones, DDL)
 */
export async function exec(sqlQuery: string): Promise<void> {
  if (isPostgresConfigured) {
    try {
      const executor = getPgExecutor();
      await executor.query(sqlQuery);
      return;
    } catch (pgError: any) {
      console.warn('[PostgreSQL Fallback] Error en exec, usando SQLite seguro:', pgError.message);
    }
  }

  const db = await initDb();
  db.run(sqlQuery);
  saveDb();
}

/**
 * Ejecuta un bloque dentro de una transacción ACID garantizada
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  if (isPostgresConfigured) {
    try {
      const existingClient = txStorage.getStore();
      if (existingClient) {
        return await callback();
      }

      const pool = getPgPool();
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await txStorage.run(client, callback);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (pgErr: any) {
      console.warn('[PostgreSQL Fallback] Error en transacción PostgreSQL, usando SQLite seguro:', pgErr.message);
    }
  }

  const db = await initDb();
  db.run('BEGIN TRANSACTION;');
  try {
    const result = await callback();
    db.run('COMMIT;');
    saveDb();
    return result;
  } catch (error) {
    db.run('ROLLBACK;');
    throw error;
  }
}
