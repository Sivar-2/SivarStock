const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

async function main() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync('data/sivarstock.db');
  const db = new SQL.Database(dbBuffer);

  // 1. Recrear tabla users con el CHECK constraint actualizado para incluir 'SUPERADMIN' y 'OPERATOR'
  db.run("PRAGMA foreign_keys = OFF;");
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users_v2 (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      quick_access_enabled INTEGER DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'VIEWER' CHECK(role IN ('SUPERADMIN', 'ADMIN', 'SUBADMIN', 'AREA_MANAGER', 'OPERATOR', 'VIEWER')),
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      initials TEXT NOT NULL,
      allowed_tabs_json TEXT DEFAULT '["DASHBOARD","INVENTARIO","CELULARES","PRODUCTOS","MOVIMIENTOS","ASIGNACIONES","MANTENIMIENTO","SERVICIOS","COSTOS","REPORTES","DEPARTAMENTOS","CONFIGURACION"]',
      allowed_actions_json TEXT DEFAULT '{"can_read":1,"can_write":1,"can_delete":0,"can_export":1,"can_view_financials":1}',
      allowed_departments_json TEXT DEFAULT '[]',
      only_own_department INTEGER DEFAULT 0,
      can_view_financials INTEGER DEFAULT 1,
      can_export INTEGER DEFAULT 1,
      can_manage_users INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Copiar datos existentes
  db.run(`
    INSERT OR IGNORE INTO users_v2 (
      id, username, full_name, email, password_hash, pin_hash, quick_access_enabled,
      role, department_id, employee_id, initials, allowed_tabs_json, allowed_actions_json,
      allowed_departments_json, only_own_department, can_view_financials, can_export,
      can_manage_users, can_edit, is_active, created_at
    )
    SELECT 
      id, username, full_name, email, password_hash, pin_hash, quick_access_enabled,
      role, department_id, employee_id, initials, allowed_tabs_json, allowed_actions_json,
      allowed_departments_json, only_own_department, can_view_financials, can_export,
      can_manage_users, can_edit, is_active, created_at
    FROM users;
  `);

  db.run("DROP TABLE users;");
  db.run("ALTER TABLE users_v2 RENAME TO users;");
  db.run("PRAGMA foreign_keys = ON;");

  console.log('Tabla users migrada con nuevo CHECK constraint.');

  // 2. Insertar / Actualizar Super Admin TurcoSivar
  const adminPass = bcrypt.hashSync('12345679', 10);
  const pinHash = bcrypt.hashSync('2801', 10);
  const allTabs = JSON.stringify([
    'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
    'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
    'DEPARTAMENTOS', 'PERMISOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
  ]);
  const allActions = JSON.stringify({
    can_read: 1,
    can_write: 1,
    can_delete: 1,
    can_export: 1,
    can_view_financials: 1
  });
  const allDepts = JSON.stringify(['*']);

  const check = db.exec("SELECT id, username, role FROM users WHERE username = 'TurcoSivar'");

  if (check.length === 0 || check[0].values.length === 0) {
    db.run(
      `INSERT INTO users (
        id, username, full_name, email, password_hash, pin_hash, quick_access_enabled,
        role, department_id, employee_id, initials, allowed_tabs_json, allowed_actions_json,
        allowed_departments_json, only_own_department, can_view_financials, can_export,
        can_manage_users, can_edit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 'SUPERADMIN', NULL, NULL, 'TS', ?, ?, ?, 0, 1, 1, 1, 1, 1)`,
      [
        'usr-turcosivar',
        'TurcoSivar',
        'Master Super Admin (FPC)',
        'turcosivar@fpc.com.gt',
        adminPass,
        pinHash,
        allTabs,
        allActions,
        allDepts
      ]
    );
    console.log('Inserted TurcoSivar successfully.');
  } else {
    db.run(
      `UPDATE users SET
        full_name = 'Master Super Admin (FPC)',
        email = 'turcosivar@fpc.com.gt',
        password_hash = ?,
        pin_hash = ?,
        quick_access_enabled = 1,
        role = 'SUPERADMIN',
        allowed_tabs_json = ?,
        allowed_actions_json = ?,
        allowed_departments_json = ?,
        can_view_financials = 1,
        can_export = 1,
        can_manage_users = 1,
        can_edit = 1,
        is_active = 1
      WHERE username = 'TurcoSivar'`,
      [adminPass, pinHash, allTabs, allActions, allDepts]
    );
    console.log('Updated TurcoSivar successfully.');
  }

  const data = db.export();
  fs.writeFileSync('data/sivarstock.db', Buffer.from(data));
  console.log('data/sivarstock.db guardado exitosamente.');
}

main().catch(err => {
  console.error('Error seeding TurcoSivar:', err);
  process.exit(1);
});
