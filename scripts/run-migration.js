/**
 * SIVARSTOCK ENTERPRISE - SCRIPT DE MIGRACIÓN AUTOMÁTICA E IDEMPOTENTE
 * Aplica migraciones no destructivas tanto a SQLite como a PostgreSQL.
 */

const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('===============================================================');
  console.log('    EJECUTANDO MIGRACIÓN NO DESTRUCTIVA SIVARSTOCK V2 (FPC)   ');
  console.log('===============================================================');

  const rawPostgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const isPostgres = Boolean(rawPostgresUrl && rawPostgresUrl.trim() !== '');

  if (isPostgres) {
    console.log('[Motor]: PostgreSQL / Supabase detectado.');
    const { Client } = require('pg');
    const isLocalOrDisabledSsl = rawPostgresUrl.includes('localhost') || rawPostgresUrl.includes('127.0.0.1') || rawPostgresUrl.includes('sslmode=disable');

    const client = new Client({
      connectionString: rawPostgresUrl,
      ssl: isLocalOrDisabledSsl ? false : { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('[Conectado a PostgreSQL]');

    const migrationPath = path.resolve(__dirname, '..', 'src', 'lib', 'migrations', '001_fpc_local_first_v2.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Aplicando migración SQL en PostgreSQL...');
    await client.query(migrationSql);
    console.log('✅ Migración aplicada exitosamente en PostgreSQL.');

    await client.end();
  } else {
    console.log('[Motor]: SQLite detectado.');
    const initSqlJs = require('sql.js');
    const wasmPath = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
      : path.resolve(process.cwd(), 'data', 'sivarstock.db');

    if (!fs.existsSync(dbPath)) {
      console.log(`Base de datos no encontrada en ${dbPath}. Creando nueva...`);
      const schemaPath = path.resolve(__dirname, '..', 'src', 'lib', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const db = new SQL.Database();
      db.run(schemaSql);
      const buffer = Buffer.from(db.export());
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, buffer);
      console.log('✅ Nueva base de datos SQLite creada con esquema v2.');
      return;
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    // Función auxiliar para verificar si una columna existe en SQLite
    function columnExists(table, column) {
      try {
        const stmt = db.prepare(`PRAGMA table_info(${table})`);
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (row.name === column) {
            stmt.free();
            return true;
          }
        }
        stmt.free();
      } catch (e) {
        return false;
      }
      return false;
    }

    function addColumnIfNotExists(table, column, def) {
      if (!columnExists(table, column)) {
        console.log(`  + Agregando columna ${column} a tabla ${table}`);
        try {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
        } catch (err) {
          console.warn(`    Advertencia agregando ${column}:`, err.message);
        }
      }
    }

    // 1. Columnas en employees
    addColumnIfNotExists('employees', 'dpi_number', 'TEXT');
    addColumnIfNotExists('employees', 'job_title', 'TEXT');
    addColumnIfNotExists('employees', 'is_deleted', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('employees', 'deleted_at', 'TEXT');

    // 2. Columnas en users
    addColumnIfNotExists('users', 'pin_hash', 'TEXT');
    addColumnIfNotExists('users', 'quick_access_enabled', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('users', 'allowed_actions_json', 'TEXT DEFAULT \'{"can_read":1,"can_write":1,"can_delete":0}\'');
    addColumnIfNotExists('users', 'allowed_departments_json', 'TEXT DEFAULT \'[]\'');

    // 3. Columnas en inventory_items
    addColumnIfNotExists('inventory_items', 'invoice_file_id', 'TEXT');
    addColumnIfNotExists('inventory_items', 'photo_file_id', 'TEXT');
    addColumnIfNotExists('inventory_items', 'qr_data', 'TEXT');
    addColumnIfNotExists('inventory_items', 'is_deleted', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('inventory_items', 'deleted_at', 'TEXT');

    // 4. Columnas en mobile_devices
    addColumnIfNotExists('mobile_devices', 'contract_carrier', 'TEXT DEFAULT "Claro"');
    addColumnIfNotExists('mobile_devices', 'contract_renewal_date', 'TEXT');
    addColumnIfNotExists('mobile_devices', 'contract_status', 'TEXT DEFAULT "ACTIVO"');
    addColumnIfNotExists('mobile_devices', 'is_deleted', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('mobile_devices', 'deleted_at', 'TEXT');

    // 5. Columnas en inventory_movements
    addColumnIfNotExists('inventory_movements', 'replaced_item_id', 'TEXT');
    addColumnIfNotExists('inventory_movements', 'replacement_action', 'TEXT');
    addColumnIfNotExists('inventory_movements', 'contract_status_tag', 'TEXT');

    // 6. Columnas en maintenance_records
    addColumnIfNotExists('maintenance_records', 'scheduled_date', 'TEXT');
    addColumnIfNotExists('maintenance_records', 'assigned_employee_id', 'TEXT');
    addColumnIfNotExists('maintenance_records', 'stage', 'TEXT DEFAULT "REPORTED"');

    // 7. Columnas en digital_services y license_categories
    addColumnIfNotExists('license_categories', 'is_archived', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('digital_services', 'credentials_note', 'TEXT');
    addColumnIfNotExists('digital_services', 'is_archived', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('digital_services', 'invoice_file_id', 'TEXT');

    // 8. Columnas en cost_records
    addColumnIfNotExists('cost_records', 'warranty_end_date', 'TEXT');
    addColumnIfNotExists('cost_records', 'invoice_file_id', 'TEXT');

    // 9. Crear nuevas tablas si no existen
    db.run(`
      CREATE TABLE IF NOT EXISTS license_assignments (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL REFERENCES digital_services(id) ON DELETE CASCADE,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        assigned_email TEXT,
        assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVO' CHECK(status IN ('ACTIVO', 'REVOCADO'))
      );

      CREATE TABLE IF NOT EXISTS handover_acts (
        id TEXT PRIMARY KEY,
        act_number TEXT UNIQUE NOT NULL,
        employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        qr_token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNSIGNED' CHECK(status IN ('UNSIGNED', 'SIGNED', 'CANCELLED')),
        generated_date TEXT NOT NULL,
        signed_at TEXT,
        signature_canvas_data TEXT,
        signed_ip TEXT,
        legal_template_text TEXT NOT NULL,
        delivery_observations TEXT,
        pdf_storage_path TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS handover_act_items (
        id TEXT PRIMARY KEY,
        act_id TEXT NOT NULL REFERENCES handover_acts(id) ON DELETE CASCADE,
        item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
        digital_service_id TEXT REFERENCES digital_services(id) ON DELETE SET NULL,
        item_description TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        serial_or_code TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1.0,
        condition_status TEXT NOT NULL DEFAULT 'Nuevo',
        observations TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stored_files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256_hash TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS custom_reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'NORMAL',
        target_module TEXT,
        target_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY,
        operation_uuid TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        base_version INTEGER DEFAULT 1,
        device_id TEXT,
        user_id TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at_local TEXT NOT NULL,
        synced_at TEXT,
        error_message TEXT,
        attachment_refs TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS sync_operations_log (
        id TEXT PRIMARY KEY,
        operation_uuid TEXT UNIQUE NOT NULL,
        device_id TEXT,
        user_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'SUCCESS',
        server_version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        operation_uuid TEXT NOT NULL,
        device_id TEXT,
        user_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        local_payload_json TEXT,
        server_payload_json TEXT,
        resolution_status TEXT DEFAULT 'PENDING',
        resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_acts_token ON handover_acts(qr_token);
      CREATE INDEX IF NOT EXISTS idx_acts_emp ON handover_acts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_stored_files_hash ON stored_files(sha256_hash);
      CREATE INDEX IF NOT EXISTS idx_sync_log_uuid ON sync_operations_log(operation_uuid);
      CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
    `);

    // Guardar cambios a disco
    const buffer = Buffer.from(db.export());
    fs.writeFileSync(dbPath, buffer);
    console.log('✅ Migración aplicada exitosamente en SQLite local (data/sivarstock.db).');
  }
}

runMigration().catch((err) => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
