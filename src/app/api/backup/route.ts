import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { saveDb, query, run, transaction, getDatabaseEngine } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los usuarios Administradores (ADMIN) pueden descargar copias de seguridad.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const engine = getDatabaseEngine();
    const format = searchParams.get('format') || (engine === 'POSTGRESQL' ? 'json' : 'sqlite');

    if (format === 'json' || engine === 'POSTGRESQL') {
      const departments = await query('SELECT * FROM departments');
      const locations = await query('SELECT * FROM locations');
      const employees = await query('SELECT * FROM employees');
      const users = await query('SELECT id, username, full_name, email, role, department_id, employee_id, initials, allowed_tabs_json, only_own_department, can_view_financials, can_export, can_edit, is_active FROM users');
      const categories = await query('SELECT * FROM categories');
      const products = await query('SELECT * FROM products');
      const product_suppliers = await query('SELECT * FROM product_suppliers');
      const product_price_history = await query('SELECT * FROM product_price_history');
      const inventory_items = await query('SELECT * FROM inventory_items');
      const mobile_devices = await query('SELECT * FROM mobile_devices');
      const consumable_stocks = await query('SELECT * FROM consumable_stocks');
      const assignments = await query('SELECT * FROM assignments');
      const delivery_actas = await query('SELECT * FROM delivery_actas').catch(() => []);
      const inventory_movements = await query('SELECT * FROM inventory_movements');
      const inventory_counts = await query('SELECT * FROM inventory_counts').catch(() => []);
      const maintenance_records = await query('SELECT * FROM maintenance_records');
      const digital_services = await query('SELECT * FROM digital_services');
      const cost_records = await query('SELECT * FROM cost_records');

      const fullBackup = {
        app: 'SivarStock Enterprise GT',
        version: '3.1.0',
        engine,
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        data: {
          departments,
          locations,
          employees,
          users,
          categories,
          products,
          product_suppliers,
          product_price_history,
          inventory_items,
          mobile_devices,
          consumable_stocks,
          assignments,
          delivery_actas,
          inventory_movements,
          inventory_counts,
          maintenance_records,
          digital_services,
          cost_records,
        },
      };

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'DESCARGA_RESPALDO_BD',
        module: 'SISTEMA',
        reason: `Descarga de respaldo empresarial completo (${engine} - JSON estructurado)`,
      });

      return new NextResponse(JSON.stringify(fullBackup, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="sivarstock_backup_${engine.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // Modo SQLite local
    saveDb();

    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
      : path.resolve(process.cwd(), 'data', 'sivarstock.db');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Archivo de base de datos no encontrado.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sivarstock_backup_${dateStr}.db`;

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'DESCARGA_RESPALDO_BD',
      module: 'SISTEMA',
      reason: 'Descarga manual de respaldo binario SQLite',
    });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error al generar respaldo:', error);
    return NextResponse.json({ error: 'Error al generar respaldo.' }, { status: 500 });
  }
}

/**
 * Restaurar copia de seguridad desde archivo JSON o purgar datos de prueba
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador principal (ADMIN) puede realizar esta operación.' }, { status: 403 });
    }

    const backupData = await req.json();

    if (backupData && backupData.action === 'PURGE_ALL_DATA') {
      const engine = getDatabaseEngine();

      await transaction(async () => {
        if (engine === 'SQLITE') {
          await run('DROP TRIGGER IF EXISTS trg_audit_immutable_del').catch(() => {});
          await run('DROP TRIGGER IF EXISTS trg_audit_immutable_upd').catch(() => {});
        }

        await run('DELETE FROM audit_logs');
        await run('DELETE FROM cost_records');
        await run('DELETE FROM digital_services');
        await run('DELETE FROM maintenance_records');
        await run('DELETE FROM delivery_actas').catch(() => {});
        await run('DELETE FROM inventory_counts').catch(() => {});
        await run('DELETE FROM inventory_movements');
        await run('DELETE FROM assignments');
        await run('DELETE FROM consumable_stocks');
        await run('DELETE FROM mobile_devices');
        await run('DELETE FROM product_price_history');
        await run('DELETE FROM product_suppliers');
        await run('DELETE FROM inventory_items');
        await run('DELETE FROM products');
        
        await run('UPDATE users SET employee_id = NULL');
        await run('DELETE FROM users WHERE id != ?', [user.id]);
        await run('DELETE FROM employees');

        if (engine === 'SQLITE') {
          await run(`
            CREATE TRIGGER IF NOT EXISTS trg_audit_immutable_del
            BEFORE DELETE ON audit_logs
            BEGIN
              SELECT RAISE(FAIL, 'Los registros de auditoria de SivarStock son estrictamente inmutables (DELETE prohibido)');
            END;
          `).catch(() => {});
          await run(`
            CREATE TRIGGER IF NOT EXISTS trg_audit_immutable_upd
            BEFORE UPDATE ON audit_logs
            BEGIN
              SELECT RAISE(FAIL, 'Los registros de auditoria de SivarStock son estrictamente inmutables (UPDATE prohibido)');
            END;
          `).catch(() => {});
        }
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'PURGA_TOTAL_DATOS_PRUEBA',
        module: 'SISTEMA',
        entityId: 'SYSTEM_PURGE',
        entityName: 'Base de Datos de Producción',
        reason: `Limpieza total de datos de prueba ejecutada por ${user.fullName} (${user.email}). Base de datos iniciada de cero conservando departamentos, categorías y administrador.`,
      });

      return NextResponse.json({
        success: true,
        message: 'Base de datos de prueba purgada exitosamente. El inventario ha sido reiniciado a cero conservando departamentos, categorías y el usuario administrador.',
      });
    }

    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: 'Formato de archivo de respaldo inválido.' }, { status: 400 });
    }

    const { data } = backupData;

    await transaction(async () => {
      if (Array.isArray(data.departments)) {
        for (const d of data.departments) {
          await run(
            `INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET 
               code = excluded.code, name = excluded.name, cost_center = excluded.cost_center,
               manager_name = excluded.manager_name, is_bodega = excluded.is_bodega, is_active = excluded.is_active`,
            [d.id, d.code, d.name, d.cost_center, d.manager_name, d.is_bodega ?? 0, d.is_active ?? 1]
          );
        }
      }

      if (Array.isArray(data.categories)) {
        for (const c of data.categories) {
          await run(
            `INSERT INTO categories (id, code, name, tracking_type, description, icon, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET 
               code = excluded.code, name = excluded.name, tracking_type = excluded.tracking_type,
               description = excluded.description, icon = excluded.icon, is_active = excluded.is_active`,
            [c.id, c.code, c.name, c.tracking_type || 'INDIVIDUAL', c.description, c.icon, c.is_active ?? 1]
          );
        }
      }

      if (Array.isArray(data.products)) {
        for (const p of data.products) {
          await run(
            `INSERT INTO products (
              id, category_id, code, name, description, brand, model, image_url,
              unit_of_measure, current_stock, min_stock, target_stock,
              unit_price, box_price, units_per_box, default_supplier, is_consumable, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              category_id = excluded.category_id, code = excluded.code, name = excluded.name,
              description = excluded.description, brand = excluded.brand, model = excluded.model,
              image_url = excluded.image_url, unit_of_measure = excluded.unit_of_measure,
              current_stock = excluded.current_stock, min_stock = excluded.min_stock, target_stock = excluded.target_stock,
              unit_price = excluded.unit_price, box_price = excluded.box_price, units_per_box = excluded.units_per_box,
              default_supplier = excluded.default_supplier, is_consumable = excluded.is_consumable, is_active = excluded.is_active`,
            [
              p.id, p.category_id, p.code, p.name, p.description, p.brand, p.model, p.image_url,
              p.unit_of_measure, p.current_stock, p.min_stock, p.target_stock,
              p.unit_price, p.box_price, p.units_per_box, p.default_supplier, p.is_consumable, p.is_active ?? 1
            ]
          );
        }
      }

      if (Array.isArray(data.employees)) {
        for (const e of data.employees) {
          await run(
            `INSERT INTO employees (
              id, employee_code, full_name, dpi, job_title, initials, email, phone, department_id,
              immediate_supervisor_id, company_name, status, exit_date, exit_reason, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              employee_code = excluded.employee_code, full_name = excluded.full_name,
              dpi = excluded.dpi, job_title = excluded.job_title, initials = excluded.initials,
              email = excluded.email, phone = excluded.phone, department_id = excluded.department_id,
              immediate_supervisor_id = excluded.immediate_supervisor_id, company_name = excluded.company_name,
              status = excluded.status, exit_date = excluded.exit_date, exit_reason = excluded.exit_reason, notes = excluded.notes`,
            [
              e.id, e.employee_code, e.full_name, e.dpi || null, e.job_title || null, e.initials, e.email, e.phone, e.department_id,
              e.immediate_supervisor_id || null, e.company_name, e.status, e.exit_date, e.exit_reason, e.notes
            ]
          );
        }
      }

      if (Array.isArray(data.inventory_items)) {
        for (const it of data.inventory_items) {
          await run(
            `INSERT INTO inventory_items (
              id, product_id, permanent_code, serial_number, mac_address, imei, ip_address, hostname, specifications,
              brand, model, current_department_id, current_employee_id, current_assigned_user_id,
              operational_status, physical_condition, purchase_date, supplier,
              purchase_price, replacement_value, residual_value, currency, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              product_id = excluded.product_id, permanent_code = excluded.permanent_code,
              serial_number = excluded.serial_number, mac_address = excluded.mac_address, imei = excluded.imei,
              ip_address = excluded.ip_address, hostname = excluded.hostname, specifications = excluded.specifications,
              brand = excluded.brand, model = excluded.model,
              current_department_id = excluded.current_department_id, current_employee_id = excluded.current_employee_id,
              current_assigned_user_id = excluded.current_assigned_user_id, operational_status = excluded.operational_status,
              physical_condition = excluded.physical_condition, purchase_date = excluded.purchase_date,
              supplier = excluded.supplier, purchase_price = excluded.purchase_price,
              replacement_value = excluded.replacement_value, residual_value = excluded.residual_value,
              currency = excluded.currency, notes = excluded.notes`,
            [
              it.id, it.product_id, it.permanent_code, it.serial_number, it.mac_address || null, it.imei || null,
              it.ip_address || null, it.hostname || null, it.specifications || null,
              it.brand, it.model, it.current_department_id, it.current_employee_id, it.current_assigned_user_id,
              it.operational_status, it.physical_condition, it.purchase_date, it.supplier,
              it.purchase_price, it.replacement_value, it.residual_value, it.currency || 'GTQ', it.notes
            ]
          );
        }
      }

      if (Array.isArray(data.mobile_devices)) {
        for (const m of data.mobile_devices) {
          await run(
            `INSERT INTO mobile_devices (
              id, device_code, brand, model, serial_number, mac_address, employee_id, department_id,
              phone_number, imei, sim_iccid, carrier, plan_name, monthly_cost, contract_number,
              contract_start_date, contract_end_date, delivery_date, status, notes_history
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              device_code = excluded.device_code, brand = excluded.brand, model = excluded.model,
              serial_number = excluded.serial_number, mac_address = excluded.mac_address,
              employee_id = excluded.employee_id, department_id = excluded.department_id,
              phone_number = excluded.phone_number, imei = excluded.imei, sim_iccid = excluded.sim_iccid,
              carrier = excluded.carrier, plan_name = excluded.plan_name, monthly_cost = excluded.monthly_cost,
              contract_number = excluded.contract_number, contract_start_date = excluded.contract_start_date,
              contract_end_date = excluded.contract_end_date, delivery_date = excluded.delivery_date,
              status = excluded.status, notes_history = excluded.notes_history`,
            [
              m.id, m.device_code, m.brand, m.model, m.serial_number || null, m.mac_address || null,
              m.employee_id, m.department_id, m.phone_number, m.imei, m.sim_iccid || null,
              m.carrier || 'Tigo', m.plan_name || null, m.monthly_cost || 0, m.contract_number || null,
              m.contract_start_date || null, m.contract_end_date || null, m.delivery_date, m.status, m.notes_history || '[]'
            ]
          );
        }
      }

      if (Array.isArray(data.delivery_actas)) {
        for (const da of data.delivery_actas) {
          await run(
            `INSERT INTO delivery_actas (
              id, acta_code, acta_type, employee_id, employee_name, employee_dpi, employee_code,
              department_name, supervisor_name, issuer_name, issuer_role, issuer_signature_data,
              receive_condition, delivery_date, devices_snapshot_json, replaced_device_json,
              notes, status, employee_signature_data, signed_at, signed_ip, legal_notice
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              status = excluded.status,
              employee_signature_data = excluded.employee_signature_data,
              signed_at = excluded.signed_at`,
            [
              da.id, da.acta_code, da.acta_type || 'ENTREGA_INICIAL', da.employee_id, da.employee_name,
              da.employee_dpi || null, da.employee_code || null, da.department_name || null, da.supervisor_name || null,
              da.issuer_name || 'Alexander Turcios Melendez', da.issuer_role || 'Jefe de IT / Administración de Inventario',
              da.issuer_signature_data || null, da.receive_condition || 'NUEVO', da.delivery_date,
              da.devices_snapshot_json || '[]', da.replaced_device_json || null, da.notes || null,
              da.status || 'PENDIENTE_FIRMA', da.employee_signature_data || null, da.signed_at || null,
              da.signed_ip || null, da.legal_notice || ''
            ]
          );
        }
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'RESTAURAR_RESPALDO_BD',
      module: 'SISTEMA',
      reason: `Restauración exitosa de respaldo ejecutada por ${user.fullName}`,
    });

    return NextResponse.json({ success: true, message: 'Copia de seguridad restaurada exitosamente.' });
  } catch (error: any) {
    console.error('Error al restaurar respaldo:', error);
    return NextResponse.json({ error: error.message || 'Error al restaurar respaldo.' }, { status: 500 });
  }
}
