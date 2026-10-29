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
let pgMigrated = false;
const txStorage = new AsyncLocalStorage<PoolClient>();

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const rawPostgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
const isLocalhostPostgres = Boolean(rawPostgresUrl && (rawPostgresUrl.includes('localhost') || rawPostgresUrl.includes('127.0.0.1')));

// Si estamos en Vercel y DATABASE_URL apunta a localhost sin servidor real, descartamos para permitir SQLite
const POSTGRES_URL = (isVercel && isLocalhostPostgres) ? null : (rawPostgresUrl && rawPostgresUrl.trim() !== '' ? rawPostgresUrl.trim() : null);
export const isPostgresConfigured = Boolean(POSTGRES_URL);

// En Vercel / serverless la única carpeta escribible para SQLite es /tmp
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
 * Inicializa el pool de PostgreSQL (Local o Remoto / Supabase)
 */
function getPgPool(): Pool {
  if (!pgPoolInstance && POSTGRES_URL) {
    const isLocalOrDisabledSsl =
      POSTGRES_URL.includes('localhost') ||
      POSTGRES_URL.includes('127.0.0.1') ||
      POSTGRES_URL.includes('192.168.') ||
      POSTGRES_URL.includes('10.') ||
      POSTGRES_URL.includes('172.16.') ||
      POSTGRES_URL.includes('172.17.') ||
      POSTGRES_URL.includes('172.18.') ||
      POSTGRES_URL.includes('172.19.') ||
      POSTGRES_URL.includes('172.20.') ||
      POSTGRES_URL.includes('172.21.') ||
      POSTGRES_URL.includes('172.22.') ||
      POSTGRES_URL.includes('172.23.') ||
      POSTGRES_URL.includes('172.24.') ||
      POSTGRES_URL.includes('172.25.') ||
      POSTGRES_URL.includes('172.26.') ||
      POSTGRES_URL.includes('172.27.') ||
      POSTGRES_URL.includes('172.28.') ||
      POSTGRES_URL.includes('172.29.') ||
      POSTGRES_URL.includes('172.30.') ||
      POSTGRES_URL.includes('172.31.') ||
      POSTGRES_URL.includes('sslmode=disable');

    pgPoolInstance = new Pool({
      connectionString: POSTGRES_URL,
      ssl: isLocalOrDisabledSsl ? false : {
        rejectUnauthorized: false,
      },
      max: 10,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
    });

    pgPoolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool Fatal Error]:', err.message);
    });
  }
  return pgPoolInstance!;
}

/**
 * Ejecuta migraciones automáticas seguras en PostgreSQL una sola vez por proceso
 */
async function ensurePgAutoMigrations(executor: Pool | PoolClient): Promise<void> {
  if (pgMigrated) return;
  pgMigrated = true;
  const pgMigrations = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS dpi TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS mac_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS imei TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS ip_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS hostname TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS specifications TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS serial_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS mac_address TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS carrier TEXT DEFAULT 'Tigo'`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS plan_name TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC(12,2) DEFAULT 0`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS sim_iccid TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_start_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS contract_end_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN IF NOT EXISTS renewal_alert_days INTEGER DEFAULT 30`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS contract_number TEXT`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'LICENCIA_SAAS'`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS contact_name TEXT`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS contact_phone TEXT`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS contact_email TEXT`,
    `ALTER TABLE digital_services ADD COLUMN IF NOT EXISTS sla_terms TEXT`,
    `CREATE TABLE IF NOT EXISTS inventory_counts (
      id TEXT PRIMARY KEY,
      count_code TEXT UNIQUE NOT NULL,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      executed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      executed_by_name TEXT,
      total_expected NUMERIC(12,2) DEFAULT 0,
      total_counted NUMERIC(12,2) DEFAULT 0,
      total_bodega NUMERIC(12,2) DEFAULT 0,
      total_assigned_employees NUMERIC(12,2) DEFAULT 0,
      discrepancies_count INTEGER DEFAULT 0,
      details_json TEXT DEFAULT '[]',
      notes TEXT,
      status TEXT DEFAULT 'COMPLETADO',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS delivery_actas (
      id TEXT PRIMARY KEY,
      acta_code TEXT UNIQUE NOT NULL,
      acta_type TEXT NOT NULL DEFAULT 'ENTREGA_INICIAL',
      employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      employee_dpi TEXT,
      employee_email TEXT,
      employee_phone TEXT,
      department_name TEXT,
      supervisor_name TEXT,
      delivered_by_name TEXT NOT NULL DEFAULT 'Alexander Turcios Melendez',
      delivered_by_role TEXT DEFAULT 'Jefe de IT / Administración de Inventario',
      delivered_by_signature TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      replaced_item_json TEXT,
      delivery_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
      employee_signature_data TEXT,
      signed_at TEXT,
      signed_ip TEXT,
      public_token TEXT NOT NULL,
      legal_notice TEXT NOT NULL DEFAULT 'Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado en su correo electrónico. Si requiere una copia física, este documento digital puede ser impreso en cualquier momento.',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
  for (const sql of pgMigrations) {
    try {
      await executor.query(sql);
    } catch {
      // Ignorar si la tabla o columna ya existe
    }
  }
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
 * Ejecuta migraciones aditivas seguras en SQLite sin afectar datos existentes
 */
function runSqliteAutoMigrations(db: Database): void {
  const migrations = [
    // DPI y Cargo en empleados
    `ALTER TABLE employees ADD COLUMN dpi TEXT`,
    `ALTER TABLE employees ADD COLUMN job_title TEXT`,
    // Identificadores técnicos en activos físicos (inventory_items)
    `ALTER TABLE inventory_items ADD COLUMN mac_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN imei TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN ip_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN hostname TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN specifications TEXT`,
    // Control de contratos, líneas, serie y MAC en dispositivos móviles (mobile_devices)
    `ALTER TABLE mobile_devices ADD COLUMN serial_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN mac_address TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN carrier TEXT DEFAULT 'Tigo'`,
    `ALTER TABLE mobile_devices ADD COLUMN plan_name TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN monthly_cost REAL DEFAULT 0`,
    `ALTER TABLE mobile_devices ADD COLUMN sim_iccid TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_start_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_end_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN renewal_alert_days INTEGER DEFAULT 30`,
    // Control de contratos con proveedores en servicios digitales (digital_services)
    `ALTER TABLE digital_services ADD COLUMN contract_number TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contract_type TEXT DEFAULT 'LICENCIA_SAAS'`,
    `ALTER TABLE digital_services ADD COLUMN contact_name TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contact_phone TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contact_email TEXT`,
    `ALTER TABLE digital_services ADD COLUMN sla_terms TEXT`,
    // Tabla de Recuentos y Conciliación Física de Inventario
    `CREATE TABLE IF NOT EXISTS inventory_counts (
      id TEXT PRIMARY KEY,
      count_code TEXT UNIQUE NOT NULL,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      executed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      executed_by_name TEXT,
      total_expected REAL DEFAULT 0,
      total_counted REAL DEFAULT 0,
      total_bodega REAL DEFAULT 0,
      total_assigned_employees REAL DEFAULT 0,
      discrepancies_count INTEGER DEFAULT 0,
      details_json TEXT DEFAULT '[]',
      notes TEXT,
      status TEXT DEFAULT 'COMPLETADO',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    // Tabla de Actas Digitales de Entrega y Firma Electrónica (WhatsApp / Celular / Impresión)
    `CREATE TABLE IF NOT EXISTS delivery_actas (
      id TEXT PRIMARY KEY,
      acta_code TEXT UNIQUE NOT NULL,
      acta_type TEXT NOT NULL DEFAULT 'ENTREGA_INICIAL',
      employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      employee_dpi TEXT,
      employee_email TEXT,
      employee_phone TEXT,
      department_name TEXT,
      supervisor_name TEXT,
      delivered_by_name TEXT NOT NULL DEFAULT 'Alexander Turcios Melendez',
      delivered_by_role TEXT DEFAULT 'Jefe de IT / Administración de Inventario',
      delivered_by_signature TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      replaced_item_json TEXT,
      delivery_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
      employee_signature_data TEXT,
      signed_at TEXT,
      signed_ip TEXT,
      public_token TEXT NOT NULL,
      legal_notice TEXT NOT NULL DEFAULT 'Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado en su correo electrónico. Si requiere una copia física, este documento digital puede ser impreso en cualquier momento.',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  let modified = false;
  for (const sql of migrations) {
    try {
      db.run(sql);
      modified = true;
    } catch {
      // La columna o tabla ya existe; continuar silenciosamente
    }
  }
  if (modified) {
    saveDb();
  }
}

/**
 * Inicializa la base de datos SQLite (sql.js WASM) ÚNICAMENTE cuando no hay PostgreSQL configurado
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

  // Verificar si las tablas existen en SQLite
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

    await seedInitialData(async (sql, params = []) => {
      if (sqliteDbInstance) {
        sqliteDbInstance.run(sql, params);
      }
    });

    saveDb();
  }

  // Aplicar migraciones aditivas para garantizar que todas las columnas y tablas nuevas existan
  runSqliteAutoMigrations(sqliteDbInstance);

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
    console.warn('[DB Persistence Warning] Operando SQLite en memoria:', (error as any)?.message);
  }
}

/**
 * Traduce consultas con sintaxis de marcadores '?' a '$1, $2, ...' para PostgreSQL
 */
export function translateQueryForPostgres(sqlQuery: string): string {
  let paramIndex = 1;
  let translated = sqlQuery.replace(/\?/g, () => `$${paramIndex++}`);

  translated = translated.replace(/datetime\('now',\s*'-(\d+)\s*days'\)/gi, "(NOW() - INTERVAL '$1 days')");
  translated = translated.replace(/datetime\('now',\s*'\+(\d+)\s*days'\)/gi, "(NOW() + INTERVAL '$1 days')");
  translated = translated.replace(/datetime\('now'\)/gi, 'NOW()');
  translated = translated.replace(/date\('now'\)/gi, 'CURRENT_DATE');

  translated = translated.replace(/julianday\(([^)]+)\)\s*-\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) - CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*>=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) >= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<=\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) <= CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*>\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) > CURRENT_DATE)");
  translated = translated.replace(/julianday\(([^)]+)\)\s*<\s*julianday\('now'\)/gi, "(CAST($1 AS DATE) < CURRENT_DATE)");

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(translated)) {
      translated = translated.trim() + ' ON CONFLICT DO NOTHING';
    }
  }

  return translated;
}

export async function query<T = any>(sqlQuery: string, params: any[] = []): Promise<T[]> {
  if (isPostgresConfigured) {
    const executor = getPgExecutor();
    await ensurePgAutoMigrations(executor);
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

export async function queryOne<T = any>(sqlQuery: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sqlQuery, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function run(sqlQuery: string, params: any[] = []): Promise<{ changes: number }> {
  if (isPostgresConfigured) {
    const executor = getPgExecutor();
    await ensurePgAutoMigrations(executor);
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

export const execute = run;

export async function exec(sqlQuery: string): Promise<void> {
  if (isPostgresConfigured) {
    const executor = getPgExecutor();
    await ensurePgAutoMigrations(executor);
    await executor.query(sqlQuery);
    return;
  }

  const db = await initDb();
  db.run(sqlQuery);
  saveDb();
}

export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  if (isPostgresConfigured) {
    const existingClient = txStorage.getStore();
    if (existingClient) {
      return await callback();
    }

    const pool = getPgPool();
    const client: PoolClient = await pool.connect();
    try {
      await ensurePgAutoMigrations(client);
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
