import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

let sqlJsInstance: SqlJsStatic | null = null;
let sqliteDbInstance: Database | null = null;
let pgPoolInstance: Pool | null = null;
const txStorage = new AsyncLocalStorage<PoolClient>();

const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
const IS_POSTGRES = Boolean(POSTGRES_URL);

const DB_FILE_PATH = process.env.DATABASE_PATH 
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data', 'sivarstock.db');

/**
 * Retorna el modo activo de la base de datos
 */
export function getDatabaseEngine(): 'POSTGRESQL' | 'SQLITE' {
  return IS_POSTGRES ? 'POSTGRESQL' : 'SQLITE';
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
      idleTimeoutMillis: 30000,
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
 * Inicializa la base de datos SQLite (sql.js WASM) para modo local/pruebas
 */
export async function initDb(): Promise<Database> {
  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }

  if (!sqlJsInstance) {
    const wasmPath = path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    sqlJsInstance = await initSqlJs({
      locateFile: (file) => {
        if (file.endsWith('.wasm')) {
          return wasmPath;
        }
        return file;
      },
    });
  }

  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    sqliteDbInstance = new sqlJsInstance.Database(fileBuffer);
  } else {
    sqliteDbInstance = new sqlJsInstance.Database();
    const schemaPath = path.resolve(process.cwd(), 'src', 'lib', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      sqliteDbInstance.run(schemaSql);
      saveDb();
    }
  }

  return sqliteDbInstance;
}

/**
 * Guarda el archivo SQLite en disco
 */
export function saveDb(): void {
  if (!sqliteDbInstance || IS_POSTGRES) return;
  try {
    const data = sqliteDbInstance.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (error) {
    console.error('Error al guardar la base de datos en disco:', error);
  }
}

/**
 * Traduce consultas con sintaxis de marcadores '?' a '$1, $2, ...' para PostgreSQL
 * y convierte funciones específicas de SQLite (datetime, julianday) a PostgreSQL estándar.
 */
function translateQueryForPostgres(sqlQuery: string): string {
  let paramIndex = 1;
  let translated = sqlQuery.replace(/\?/g, () => `$${paramIndex++}`);
  
  // Traducir datetime('now', '-X days') -> (NOW() - INTERVAL 'X days')
  translated = translated.replace(/datetime\('now',\s*'-(\d+)\s*days'\)/gi, "(NOW() - INTERVAL '$1 days')");
  
  // Traducir datetime('now') -> NOW()
  translated = translated.replace(/datetime\('now'\)/gi, 'NOW()');
  
  // Traducir julianday(exp) - julianday('now') -> (CAST(exp AS DATE) - CURRENT_DATE)
  translated = translated.replace(/julianday\(([^)]+)\)\s*-\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) - CURRENT_DATE)");
  
  // Traducir comparaciones con julianday
  translated = translated.replace(/julianday\(([^)]+)\)\s*>=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) >= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) <= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*>\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) > CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) < CURRENT_DATE)");

  return translated;
}

/**
 * Ejecuta una consulta SELECT y retorna múltiples filas tipadas
 */
export async function query<T = any>(sqlQuery: string, params: any[] = []): Promise<T[]> {
  if (IS_POSTGRES) {
    const executor = getPgExecutor();
    const pgSql = translateQueryForPostgres(sqlQuery);
    const res = await executor.query(pgSql, params);
    return res.rows as T[];
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
  if (IS_POSTGRES) {
    const executor = getPgExecutor();
    const pgSql = translateQueryForPostgres(sqlQuery);
    const res = await executor.query(pgSql, params);
    return { changes: res.rowCount || 0 };
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
  if (IS_POSTGRES) {
    const executor = getPgExecutor();
    await executor.query(sqlQuery);
    return;
  }

  const db = await initDb();
  db.run(sqlQuery);
  saveDb();
}

/**
 * Ejecuta un bloque dentro de una transacción ACID garantizada
 */
export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  if (IS_POSTGRES) {
    // Si ya estamos dentro de una transacción en este contexto asíncrono, reutilizamos el cliente
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
