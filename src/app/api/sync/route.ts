import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { Pool } from 'pg';
import { query, queryOne, run, transaction, getDatabaseEngine, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

/**
 * GET /api/sync
 * Devuelve el estado del servidor local, IPs de red LAN para conectar otros equipos
 * en la oficina y el estado de sincronización con PostgreSQL/Supabase.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const engine = getDatabaseEngine();
    const lanIps = getLocalNetworkIps();
    const lastSyncRow = await queryOne<any>(`SELECT value, updated_at FROM system_settings WHERE key = 'last_cloud_sync'`);
    const savedRemoteUrlRow = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'remote_postgres_url'`);

    const counts = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM employees) as employees,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM inventory_items) as inventory_items,
        (SELECT COUNT(*) FROM mobile_devices) as mobile_devices,
        (SELECT COUNT(*) FROM assignments) as assignments,
        (SELECT COUNT(*) FROM digital_services) as digital_services,
        (SELECT COUNT(*) FROM delivery_actas) as delivery_actas,
        (SELECT COUNT(*) FROM inventory_movements) as movements
    `);

    const hasEnvRemote = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL || savedRemoteUrlRow?.value);

    return NextResponse.json({
      success: true,
      engine,
      lanIps,
      port: process.env.PORT || 3000,
      hasRemoteConfigured: hasEnvRemote,
      savedRemoteUrlMasked: savedRemoteUrlRow?.value
        ? savedRemoteUrlRow.value.replace(/:[^:@]+@/, ':****@')
        : (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : null),
      lastSync: lastSyncRow ? lastSyncRow.value : null,
      counts,
    });
  } catch (error: any) {
    console.error('Error en GET /api/sync:', error);
    return NextResponse.json({ error: 'Error al consultar estado de sincronización.' }, { status: 500 });
  }
}

/**
 * POST /api/sync
 * Permite guardar la URL de conexión remota (PostgreSQL/Supabase) y sincronizar:
 * - PUSH_TO_CLOUD: Sube todos los cambios de la base de datos local al servidor PostgreSQL/Supabase en la nube.
 * - PULL_FROM_CLOUD: Descarga y actualiza la base de datos local con los registros de PostgreSQL/Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador puede ejecutar sincronizaciones de servidor.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, remotePostgresUrl } = body;

    if (action === 'SAVE_URL') {
      if (!remotePostgresUrl || !remotePostgresUrl.trim().startsWith('postgres')) {
        return NextResponse.json({ error: 'Debe proporcionar una cadena de conexión PostgreSQL válida (postgresql://...).' }, { status: 400 });
      }
      await run(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ('remote_postgres_url', ?, 'URL de sincronización con PostgreSQL/Supabase en la nube', datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [remotePostgresUrl.trim()]
      );
      return NextResponse.json({ success: true, message: 'URL de base de datos remota guardada para sincronización.' });
    }

    const savedUrlRow = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'remote_postgres_url'`);
    const targetUrl = (remotePostgresUrl && remotePostgresUrl.trim()) || savedUrlRow?.value || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'No hay una URL de PostgreSQL / Supabase configurada. Ingrésela en el panel de Sincronización.' },
        { status: 400 }
      );
    }

    const isLocalHost = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1') || targetUrl.includes('192.168.') || targetUrl.includes('sslmode=disable');
    const remotePool = new Pool({
      connectionString: targetUrl,
      ssl: isLocalHost ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      const client = await remotePool.connect();
      try {
        if (action === 'TEST_CONNECTION') {
          const res = await client.query('SELECT NOW() as server_time');
          return NextResponse.json({
            success: true,
            message: `Conexión exitosa con servidor remoto PostgreSQL (${res.rows[0]?.server_time}).`,
          });
        }

        // Asegurar columnas nuevas y tabla delivery_actas en el servidor remoto antes de sincronizar
        const remoteMigrations = [
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
          `CREATE TABLE IF NOT EXISTS delivery_actas (
            id TEXT PRIMARY KEY,
            acta_code TEXT NOT NULL UNIQUE,
            acta_type TEXT NOT NULL DEFAULT 'ENTREGA_INICIAL',
            employee_id TEXT NOT NULL,
            employee_name TEXT NOT NULL,
            employee_dpi TEXT,
            employee_code TEXT,
            department_name TEXT,
            supervisor_name TEXT,
            issuer_name TEXT NOT NULL DEFAULT 'Alexander Turcios Melendez',
            issuer_role TEXT DEFAULT 'Jefe de IT / Administración de Inventario',
            issuer_signature_data TEXT,
            receive_condition TEXT NOT NULL DEFAULT 'NUEVO',
            delivery_date TEXT NOT NULL,
            devices_snapshot_json TEXT NOT NULL DEFAULT '[]',
            replaced_device_json TEXT,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
            employee_signature_data TEXT,
            signed_at TEXT,
            signed_ip TEXT,
            legal_notice TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
        ];
        for (const mSql of remoteMigrations) {
          await client.query(mSql).catch(() => {});
        }

        if (action === 'PUSH_TO_CLOUD') {
          const departments = await query('SELECT * FROM departments');
          const categories = await query('SELECT * FROM categories');
          const employees = await query('SELECT * FROM employees');
          const products = await query('SELECT * FROM products');
          const inventoryItems = await query('SELECT * FROM inventory_items');
          const mobileDevices = await query('SELECT * FROM mobile_devices');
          const digitalServices = await query('SELECT * FROM digital_services');
          const deliveryActas = await query('SELECT * FROM delivery_actas').catch(() => []);

          await client.query('BEGIN');
          try {
            for (const d of departments) {
              await client.query(
                `INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_center = EXCLUDED.cost_center, manager_name = EXCLUDED.manager_name`,
                [d.id, d.code, d.name, d.cost_center, d.manager_name, d.is_bodega ?? 0, d.is_active ?? 1]
              );
            }
            for (const c of categories) {
              await client.query(
                `INSERT INTO categories (id, code, name, tracking_type, description, icon, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tracking_type = EXCLUDED.tracking_type`,
                [c.id, c.code, c.name, c.tracking_type || 'INDIVIDUAL', c.description, c.icon, c.is_active ?? 1]
              );
            }
            for (const e of employees) {
              await client.query(
                `INSERT INTO employees (id, employee_code, full_name, dpi, job_title, initials, email, phone, department_id, immediate_supervisor_id, company_name, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, dpi = EXCLUDED.dpi, job_title = EXCLUDED.job_title, email = EXCLUDED.email, phone = EXCLUDED.phone, department_id = EXCLUDED.department_id, immediate_supervisor_id = EXCLUDED.immediate_supervisor_id, status = EXCLUDED.status`,
                [e.id, e.employee_code, e.full_name, e.dpi || null, e.job_title || null, e.initials, e.email, e.phone, e.department_id, e.immediate_supervisor_id || null, e.company_name, e.status || 'ACTIVO', e.notes]
              );
            }
            for (const p of products) {
              await client.query(
                `INSERT INTO products (id, category_id, code, name, description, brand, model, unit_of_measure, current_stock, min_stock, target_stock, unit_price, default_supplier, is_consumable, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, current_stock = EXCLUDED.current_stock, unit_price = EXCLUDED.unit_price`,
                [p.id, p.category_id, p.code, p.name, p.description, p.brand, p.model, p.unit_of_measure, p.current_stock || 0, p.min_stock || 5, p.target_stock || 20, p.unit_price || 0, p.default_supplier, p.is_consumable ?? 0, p.is_active ?? 1]
              );
            }
            for (const it of inventoryItems) {
              await client.query(
                `INSERT INTO inventory_items (
                  id, product_id, permanent_code, serial_number, mac_address, imei, ip_address, hostname, specifications,
                  brand, model, current_department_id, current_employee_id, operational_status, physical_condition,
                  purchase_date, supplier, purchase_price, replacement_value, currency, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
                ON CONFLICT (id) DO UPDATE SET
                  serial_number = EXCLUDED.serial_number, mac_address = EXCLUDED.mac_address, imei = EXCLUDED.imei,
                  ip_address = EXCLUDED.ip_address, hostname = EXCLUDED.hostname,
                  current_department_id = EXCLUDED.current_department_id, current_employee_id = EXCLUDED.current_employee_id,
                  operational_status = EXCLUDED.operational_status, physical_condition = EXCLUDED.physical_condition,
                  purchase_price = EXCLUDED.purchase_price, notes = EXCLUDED.notes`,
                [
                  it.id, it.product_id, it.permanent_code, it.serial_number, it.mac_address, it.imei, it.ip_address, it.hostname, it.specifications,
                  it.brand, it.model, it.current_department_id, it.current_employee_id, it.operational_status, it.physical_condition,
                  it.purchase_date || null, it.supplier, it.purchase_price, it.replacement_value, it.currency || 'GTQ', it.notes
                ]
              );
            }
            for (const m of mobileDevices) {
              await client.query(
                `INSERT INTO mobile_devices (
                  id, device_code, brand, model, serial_number, mac_address, employee_id, department_id,
                  phone_number, imei, sim_iccid, carrier, plan_name, monthly_cost, contract_number,
                  contract_start_date, contract_end_date, delivery_date, status, notes_history
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                ON CONFLICT (id) DO UPDATE SET
                  employee_id = EXCLUDED.employee_id, department_id = EXCLUDED.department_id,
                  phone_number = EXCLUDED.phone_number, carrier = EXCLUDED.carrier, plan_name = EXCLUDED.plan_name,
                  monthly_cost = EXCLUDED.monthly_cost, contract_end_date = EXCLUDED.contract_end_date,
                  status = EXCLUDED.status, notes_history = EXCLUDED.notes_history`,
                [
                  m.id, m.device_code, m.brand, m.model, m.serial_number, m.mac_address, m.employee_id, m.department_id,
                  m.phone_number, m.imei, m.sim_iccid, m.carrier || 'Tigo', m.plan_name, m.monthly_cost || 0, m.contract_number,
                  m.contract_start_date || null, m.contract_end_date || null, m.delivery_date, m.status, m.notes_history || '[]'
                ]
              );
            }
            for (const ds of digitalServices) {
              await client.query(
                `INSERT INTO digital_services (
                  id, name, provider, contract_number, contract_type, contact_name, contact_phone, contact_email, sla_terms,
                  cost_period, amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date, auto_renew, status, notes
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name, provider = EXCLUDED.provider, contract_number = EXCLUDED.contract_number,
                  amount = EXCLUDED.amount, expiration_date = EXCLUDED.expiration_date, status = EXCLUDED.status`,
                [
                  ds.id, ds.name, ds.provider, ds.contract_number, ds.contract_type || 'LICENCIA_SAAS',
                  ds.contact_name, ds.contact_phone, ds.contact_email, ds.sla_terms,
                  ds.cost_period, ds.amount || 0, ds.monthly_equivalent_cost || 0, ds.currency || 'GTQ',
                  ds.start_date || null, ds.expiration_date || null, ds.renewal_date || null, ds.auto_renew || 'SI', ds.status || 'ACTIVA', ds.notes
                ]
              );
            }
            for (const da of deliveryActas) {
              await client.query(
                `INSERT INTO delivery_actas (
                  id, acta_code, acta_type, employee_id, employee_name, employee_dpi, employee_code,
                  department_name, supervisor_name, issuer_name, issuer_role, issuer_signature_data,
                  receive_condition, delivery_date, devices_snapshot_json, replaced_device_json,
                  notes, status, employee_signature_data, signed_at, signed_ip, legal_notice
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
                ON CONFLICT (id) DO UPDATE SET
                  status = EXCLUDED.status, employee_signature_data = EXCLUDED.employee_signature_data, signed_at = EXCLUDED.signed_at`,
                [
                  da.id, da.acta_code, da.acta_type, da.employee_id, da.employee_name, da.employee_dpi, da.employee_code,
                  da.department_name, da.supervisor_name, da.issuer_name, da.issuer_role, da.issuer_signature_data,
                  da.receive_condition, da.delivery_date, da.devices_snapshot_json, da.replaced_device_json,
                  da.notes, da.status, da.employee_signature_data, da.signed_at, da.signed_ip, da.legal_notice
                ]
              );
            }
            await client.query('COMMIT');
          } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
          }

          const syncTime = new Date().toISOString();
          await run(
            `INSERT INTO system_settings (key, value, description, updated_at)
             VALUES ('last_cloud_sync', ?, 'Última sincronización con la nube', datetime('now'))
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            [`PUSH (${syncTime})`]
          );

          await logAudit({
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'SYNC_PUSH_TO_CLOUD',
            module: 'SISTEMA',
            reason: `Sincronización PUSH desde servidor local hacia la nube (${inventoryItems.length} activos, ${employees.length} empleados, ${deliveryActas.length} actas)`,
          });

          return NextResponse.json({
            success: true,
            message: `Sincronización hacia la nube completada: ${employees.length} empleados, ${inventoryItems.length} activos, ${mobileDevices.length} líneas móviles y ${deliveryActas.length} actas digitales actualizadas.`,
          });
        }

        if (action === 'PULL_FROM_CLOUD') {
          const remDepts = (await client.query('SELECT * FROM departments')).rows;
          const remCats = (await client.query('SELECT * FROM categories')).rows;
          const remEmps = (await client.query('SELECT * FROM employees')).rows;
          const remProds = (await client.query('SELECT * FROM products')).rows;
          const remItems = (await client.query('SELECT * FROM inventory_items')).rows;
          const remMobiles = (await client.query('SELECT * FROM mobile_devices')).rows;
          const remServices = (await client.query('SELECT * FROM digital_services')).rows;
          const remActas = (await client.query('SELECT * FROM delivery_actas').catch(() => ({ rows: [] }))).rows;

          await transaction(async () => {
            for (const d of remDepts) {
              await run(
                `INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, cost_center = excluded.cost_center, manager_name = excluded.manager_name`,
                [d.id, d.code, d.name, d.cost_center, d.manager_name, d.is_bodega ?? 0, d.is_active ?? 1]
              );
            }
            for (const c of remCats) {
              await run(
                `INSERT INTO categories (id, code, name, tracking_type, description, icon, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, tracking_type = excluded.tracking_type`,
                [c.id, c.code, c.name, c.tracking_type || 'INDIVIDUAL', c.description, c.icon, c.is_active ?? 1]
              );
            }
            for (const e of remEmps) {
              await run(
                `INSERT INTO employees (id, employee_code, full_name, dpi, job_title, initials, email, phone, department_id, immediate_supervisor_id, company_name, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name, dpi = excluded.dpi, job_title = excluded.job_title, email = excluded.email, phone = excluded.phone, department_id = excluded.department_id, immediate_supervisor_id = excluded.immediate_supervisor_id, status = excluded.status`,
                [e.id, e.employee_code, e.full_name, e.dpi || null, e.job_title || null, e.initials, e.email, e.phone, e.department_id, e.immediate_supervisor_id || null, e.company_name, e.status || 'ACTIVO', e.notes]
              );
            }
            for (const p of remProds) {
              await run(
                `INSERT INTO products (id, category_id, code, name, description, brand, model, unit_of_measure, current_stock, min_stock, target_stock, unit_price, default_supplier, is_consumable, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, current_stock = excluded.current_stock, unit_price = excluded.unit_price`,
                [p.id, p.category_id, p.code, p.name, p.description, p.brand, p.model, p.unit_of_measure, Number(p.current_stock || 0), Number(p.min_stock || 5), Number(p.target_stock || 20), Number(p.unit_price || 0), p.default_supplier, p.is_consumable ?? 0, p.is_active ?? 1]
              );
            }
            for (const it of remItems) {
              await run(
                `INSERT INTO inventory_items (
                  id, product_id, permanent_code, serial_number, mac_address, imei, ip_address, hostname, specifications,
                  brand, model, current_department_id, current_employee_id, operational_status, physical_condition,
                  purchase_date, supplier, purchase_price, replacement_value, currency, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (id) DO UPDATE SET
                  serial_number = excluded.serial_number, mac_address = excluded.mac_address, imei = excluded.imei,
                  current_department_id = excluded.current_department_id, current_employee_id = excluded.current_employee_id,
                  operational_status = excluded.operational_status, physical_condition = excluded.physical_condition`,
                [
                  it.id, it.product_id, it.permanent_code, it.serial_number, it.mac_address, it.imei, it.ip_address, it.hostname, it.specifications,
                  it.brand, it.model, it.current_department_id, it.current_employee_id, it.operational_status, it.physical_condition,
                  it.purchase_date ? String(it.purchase_date).slice(0, 10) : null, it.supplier, Number(it.purchase_price || 0), Number(it.replacement_value || 0), it.currency || 'GTQ', it.notes
                ]
              );
            }
            for (const m of remMobiles) {
              await run(
                `INSERT INTO mobile_devices (
                  id, device_code, brand, model, serial_number, mac_address, employee_id, department_id,
                  phone_number, imei, sim_iccid, carrier, plan_name, monthly_cost, contract_number,
                  contract_start_date, contract_end_date, delivery_date, status, notes_history
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (id) DO UPDATE SET
                  employee_id = excluded.employee_id, department_id = excluded.department_id,
                  phone_number = excluded.phone_number, carrier = excluded.carrier, plan_name = excluded.plan_name,
                  monthly_cost = excluded.monthly_cost, contract_end_date = excluded.contract_end_date, status = excluded.status`,
                [
                  m.id, m.device_code, m.brand, m.model, m.serial_number, m.mac_address, m.employee_id, m.department_id,
                  m.phone_number, m.imei, m.sim_iccid, m.carrier || 'Tigo', m.plan_name, Number(m.monthly_cost || 0), m.contract_number,
                  m.contract_start_date ? String(m.contract_start_date).slice(0, 10) : null,
                  m.contract_end_date ? String(m.contract_end_date).slice(0, 10) : null,
                  m.delivery_date ? String(m.delivery_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
                  m.status, m.notes_history || '[]'
                ]
              );
            }
            for (const ds of remServices) {
              await run(
                `INSERT INTO digital_services (
                  id, name, provider, contract_number, contract_type, contact_name, contact_phone, contact_email, sla_terms,
                  cost_period, amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date, auto_renew, status, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (id) DO UPDATE SET
                  name = excluded.name, provider = excluded.provider, contract_number = excluded.contract_number,
                  amount = excluded.amount, expiration_date = excluded.expiration_date, status = excluded.status`,
                [
                  ds.id, ds.name, ds.provider, ds.contract_number, ds.contract_type || 'LICENCIA_SAAS',
                  ds.contact_name, ds.contact_phone, ds.contact_email, ds.sla_terms,
                  ds.cost_period, Number(ds.amount || 0), Number(ds.monthly_equivalent_cost || 0), ds.currency || 'GTQ',
                  ds.start_date ? String(ds.start_date).slice(0, 10) : null,
                  ds.expiration_date ? String(ds.expiration_date).slice(0, 10) : null,
                  ds.renewal_date ? String(ds.renewal_date).slice(0, 10) : null,
                  ds.auto_renew || 'SI', ds.status || 'ACTIVA', ds.notes
                ]
              );
            }
            for (const da of remActas) {
              await run(
                `INSERT INTO delivery_actas (
                  id, acta_code, acta_type, employee_id, employee_name, employee_dpi, employee_code,
                  department_name, supervisor_name, issuer_name, issuer_role, issuer_signature_data,
                  receive_condition, delivery_date, devices_snapshot_json, replaced_device_json,
                  notes, status, employee_signature_data, signed_at, signed_ip, legal_notice
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (id) DO UPDATE SET
                  status = excluded.status, employee_signature_data = excluded.employee_signature_data, signed_at = excluded.signed_at`,
                [
                  da.id, da.acta_code, da.acta_type, da.employee_id, da.employee_name, da.employee_dpi, da.employee_code,
                  da.department_name, da.supervisor_name, da.issuer_name, da.issuer_role, da.issuer_signature_data,
                  da.receive_condition, da.delivery_date, da.devices_snapshot_json, da.replaced_device_json,
                  da.notes, da.status, da.employee_signature_data, da.signed_at, da.signed_ip, da.legal_notice
                ]
              );
            }
          });

          saveDb();
          const syncTime = new Date().toISOString();
          await run(
            `INSERT INTO system_settings (key, value, description, updated_at)
             VALUES ('last_cloud_sync', ?, 'Última sincronización con la nube', datetime('now'))
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            [`PULL (${syncTime})`]
          );

          await logAudit({
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'SYNC_PULL_FROM_CLOUD',
            module: 'SISTEMA',
            reason: `Sincronización PULL desde la nube hacia servidor local (${remItems.length} activos, ${remEmps.length} empleados, ${remActas.length} actas)`,
          });

          return NextResponse.json({
            success: true,
            message: `Datos descargados desde la nube al servidor local: ${remEmps.length} empleados, ${remItems.length} activos, ${remMobiles.length} celulares y ${remActas.length} actas digitales.`,
          });
        }

        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
      } finally {
        client.release();
      }
    } finally {
      await remotePool.end().catch(() => {});
    }
  } catch (error: any) {
    console.error('Error en POST /api/sync:', error);
    return NextResponse.json({ error: `Error de sincronización: ${error.message || 'No se pudo conectar al servidor remoto'}` }, { status: 500 });
  }
}
