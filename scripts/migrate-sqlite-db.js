const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

async function migrate() {
  const wasmPath = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  const dbFile = path.resolve(__dirname, '..', 'data', 'sivarstock.db');
  if (!fs.existsSync(dbFile)) {
    console.error('Base de datos no encontrada en:', dbFile);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(dbFile);
  const db = new SQL.Database(fileBuffer);

  const migrations = [
    `ALTER TABLE employees ADD COLUMN dpi TEXT`,
    `ALTER TABLE employees ADD COLUMN job_title TEXT`,
    `ALTER TABLE products ADD COLUMN is_rented INTEGER DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN rental_cost REAL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN rental_period TEXT DEFAULT 'MENSUAL'`,
    `ALTER TABLE products ADD COLUMN rental_provider TEXT`,
    `ALTER TABLE products ADD COLUMN supplier_phone TEXT`,
    `ALTER TABLE products ADD COLUMN contract_number TEXT`,
    `ALTER TABLE products ADD COLUMN backup_alert_threshold INTEGER DEFAULT 1`,
    `ALTER TABLE inventory_items ADD COLUMN current_location_id TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN mac_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN imei TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN ip_address TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN hostname TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN specifications TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN is_rented INTEGER DEFAULT 0`,
    `ALTER TABLE inventory_items ADD COLUMN rental_cost REAL DEFAULT 0`,
    `ALTER TABLE inventory_items ADD COLUMN rental_provider TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN qr_printed INTEGER DEFAULT 0`,
    `ALTER TABLE inventory_items ADD COLUMN qr_printed_at TEXT`,
    `ALTER TABLE inventory_items ADD COLUMN label_orientation TEXT DEFAULT 'HORIZONTAL'`,
    `ALTER TABLE mobile_devices ADD COLUMN serial_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN mac_address TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN carrier TEXT DEFAULT 'Claro Guatemala'`,
    `ALTER TABLE mobile_devices ADD COLUMN plan_name TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN monthly_cost REAL DEFAULT 0`,
    `ALTER TABLE mobile_devices ADD COLUMN sim_iccid TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_number TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_start_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN contract_end_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN renewal_alert_days INTEGER DEFAULT 30`,
    `ALTER TABLE mobile_devices ADD COLUMN assignment_mode TEXT DEFAULT 'EQUIPO_Y_LINEA'`,
    `ALTER TABLE mobile_devices ADD COLUMN incident_type TEXT DEFAULT 'NINGUNO'`,
    `ALTER TABLE mobile_devices ADD COLUMN incident_date TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN repair_details TEXT`,
    `ALTER TABLE mobile_devices ADD COLUMN history_log_json TEXT DEFAULT '[]'`,
    `ALTER TABLE mobile_devices ADD COLUMN custom_carrier_note TEXT`,
    `ALTER TABLE inventory_movements ADD COLUMN requires_acta INTEGER DEFAULT 0`,
    `ALTER TABLE inventory_movements ADD COLUMN acta_id TEXT`,
    `ALTER TABLE inventory_movements ADD COLUMN acta_code TEXT`,
    `ALTER TABLE inventory_movements ADD COLUMN acta_status TEXT`,
    `ALTER TABLE inventory_movements ADD COLUMN recipient_name TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN repair_provider_type TEXT DEFAULT 'INTERNO_IT'`,
    `ALTER TABLE maintenance_records ADD COLUMN repair_scope TEXT DEFAULT 'TERCERO'`,
    `ALTER TABLE maintenance_records ADD COLUMN resolution_status TEXT DEFAULT 'PENDIENTE'`,
    `ALTER TABLE maintenance_records ADD COLUMN observation_start_date TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN observation_end_date TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN observation_employee_id TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN employee_id TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN updates_json TEXT DEFAULT '[]'`,
    `ALTER TABLE maintenance_records ADD COLUMN updates_log_json TEXT DEFAULT '[]'`,
    `ALTER TABLE maintenance_records ADD COLUMN solution_type TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN resolution_type TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN resolution_notes TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN resolved_date TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN replacement_item_id TEXT`,
    `ALTER TABLE maintenance_records ADD COLUMN replacement_reason TEXT`,
    `ALTER TABLE cost_records ADD COLUMN invoice_file_name TEXT`,
    `ALTER TABLE cost_records ADD COLUMN invoice_file_data TEXT`,
    `ALTER TABLE cost_records ADD COLUMN warranty_file_name TEXT`,
    `ALTER TABLE cost_records ADD COLUMN warranty_file_data TEXT`,
    `ALTER TABLE cost_records ADD COLUMN insurance_file_name TEXT`,
    `ALTER TABLE cost_records ADD COLUMN insurance_file_data TEXT`,
    `ALTER TABLE cost_records ADD COLUMN photo_file_data TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contract_number TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contract_type TEXT DEFAULT 'LICENCIA_SAAS'`,
    `ALTER TABLE digital_services ADD COLUMN contact_name TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contact_phone TEXT`,
    `ALTER TABLE digital_services ADD COLUMN contact_email TEXT`,
    `ALTER TABLE digital_services ADD COLUMN sla_terms TEXT`,
    `ALTER TABLE digital_services ADD COLUMN employee_id TEXT`,
    `ALTER TABLE digital_services ADD COLUMN assigned_employee_id TEXT`,
    `ALTER TABLE digital_services ADD COLUMN responsible_employee_id TEXT`,
    `ALTER TABLE digital_services ADD COLUMN last_renewal_date TEXT`,
    `ALTER TABLE digital_services ADD COLUMN no_expiration INTEGER DEFAULT 0`,
    `ALTER TABLE digital_services ADD COLUMN requires_acta INTEGER DEFAULT 0`,
    `ALTER TABLE digital_services ADD COLUMN acta_id TEXT`,
    `ALTER TABLE digital_services ADD COLUMN no_renewal INTEGER DEFAULT 0`,
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
    `CREATE TABLE IF NOT EXISTS delivery_actas (
      id TEXT PRIMARY KEY,
      acta_code TEXT UNIQUE NOT NULL,
      acta_type TEXT NOT NULL DEFAULT 'ENTREGA_INICIAL',
      employee_id TEXT,
      employee_code TEXT,
      employee_name TEXT NOT NULL,
      employee_dpi TEXT,
      employee_phone TEXT,
      employee_email TEXT,
      employee_job_title TEXT,
      department_name TEXT,
      supervisor_name TEXT,
      delivered_by_name TEXT DEFAULT 'Alexander Turcios Melendez',
      delivered_by_role TEXT DEFAULT 'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)',
      delivered_by_signature TEXT,
      issuer_name TEXT DEFAULT 'Alexander Turcios Melendez',
      issuer_role TEXT DEFAULT 'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)',
      issuer_signature_data TEXT,
      items_json TEXT DEFAULT '[]',
      replaced_item_json TEXT,
      devices_snapshot_json TEXT DEFAULT '[]',
      replaced_device_json TEXT,
      receive_condition TEXT NOT NULL DEFAULT 'NUEVO',
      return_condition TEXT,
      returned_condition TEXT,
      refused_to_sign INTEGER DEFAULT 0,
      internal_rental_notes_json TEXT,
      internal_admin_notes TEXT,
      delivery_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
      employee_signature_data TEXT,
      signed_at TEXT,
      signed_ip TEXT,
      public_token TEXT,
      legal_notice TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE delivery_actas ADD COLUMN employee_phone TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN employee_email TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN employee_job_title TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN delivered_by_name TEXT DEFAULT 'Alexander Turcios Melendez'`,
    `ALTER TABLE delivery_actas ADD COLUMN delivered_by_role TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN delivered_by_signature TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN issuer_name TEXT DEFAULT 'Alexander Turcios Melendez'`,
    `ALTER TABLE delivery_actas ADD COLUMN issuer_role TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN issuer_signature_data TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN items_json TEXT DEFAULT '[]'`,
    `ALTER TABLE delivery_actas ADD COLUMN replaced_item_json TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN devices_snapshot_json TEXT DEFAULT '[]'`,
    `ALTER TABLE delivery_actas ADD COLUMN replaced_device_json TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN receive_condition TEXT DEFAULT 'NUEVO'`,
    `ALTER TABLE delivery_actas ADD COLUMN return_condition TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN returned_condition TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN refused_to_sign INTEGER DEFAULT 0`,
    `ALTER TABLE delivery_actas ADD COLUMN internal_rental_notes_json TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN internal_admin_notes TEXT`,
    `ALTER TABLE delivery_actas ADD COLUMN public_token TEXT`,
  ];

  let count = 0;
  for (const sql of migrations) {
    try {
      db.run(sql);
      count++;
    } catch (err) {
      // Ya existe la columna o tabla
    }
  }

  // Asegurar usuario turcosivar
  try {
    const hash = bcrypt.hashSync('12345679', 10);
    const checkStmt = db.prepare(`SELECT id FROM users WHERE LOWER(username) = 'turcosivar'`);
    const exists = checkStmt.step();
    checkStmt.free();
    const allTabsJson = '["DASHBOARD","INVENTARIO","CELULARES","PRODUCTOS","MOVIMIENTOS","ASIGNACIONES","MANTENIMIENTO","SERVICIOS","COSTOS","REPORTES","DEPARTAMENTOS","USUARIOS","AUDITORIA","CONFIGURACION"]';

    if (!exists) {
      db.run(
        `INSERT INTO users (
          id, username, full_name, email, password_hash, role,
          department_id, initials, allowed_tabs_json,
          only_own_department, can_view_financials, can_export, can_manage_users, can_edit, is_active
        ) VALUES (?, ?, ?, ?, ?, 'ADMIN', 'dept-it', 'ATM', ?, 0, 1, 1, 1, 1, 1)`,
        ['usr-turcosivar', 'turcosivar', 'Alexander Turcios Melendez', 'turcosivar@sivarstock.local', hash, allTabsJson]
      );
      console.log('Usuario turcosivar creado.');
    } else {
      db.run(
        `UPDATE users SET
          password_hash = ?,
          role = 'ADMIN',
          allowed_tabs_json = ?,
          can_manage_users = 1,
          can_edit = 1,
          is_active = 1
        WHERE LOWER(username) = 'turcosivar'`,
        [hash, allTabsJson]
      );
      console.log('Usuario turcosivar actualizado.');
    }
  } catch (err) {
    console.error('Error al asegurar usuario turcosivar:', err.message);
  }

  // Guardar archivo SQLite actualizado
  const data = db.export();
  fs.writeFileSync(dbFile, Buffer.from(data));
  console.log(`Migración de base de datos SQLite completada con éxito. Sentencias ejecutadas/verificadas: ${count}`);
}

migrate().catch(console.error);
