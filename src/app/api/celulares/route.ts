import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const departmentId = url.searchParams.get('departmentId');
    const status = url.searchParams.get('status');
    const carrier = url.searchParams.get('carrier');
    const contractFilter = url.searchParams.get('contractFilter'); // 'EXPIRING', 'EXPIRED', 'ACTIVE'

    let sql = `
      SELECT 
        m.id, m.device_code, m.brand, m.model, m.serial_number, m.mac_address,
        m.employee_id, m.department_id,
        m.phone_number, m.imei, m.sim_iccid, m.carrier, m.plan_name, m.monthly_cost,
        m.contract_number, m.contract_start_date, m.contract_end_date, m.renewal_alert_days,
        m.delivery_date, m.status, m.notes_history,
        m.created_at, m.updated_at,
        e.full_name as employee_name, e.employee_code, e.email as employee_email, e.initials as employee_initials,
        d.name as department_name, d.code as department_code,
        CASE 
          WHEN m.contract_end_date IS NOT NULL AND m.contract_end_date != ''
          THEN CAST((julianday(m.contract_end_date) - julianday('now')) AS INTEGER)
          ELSE NULL
        END as days_until_contract_end
      FROM mobile_devices m
      LEFT JOIN employees e ON m.employee_id = e.id
      LEFT JOIN departments d ON COALESCE(m.department_id, e.department_id) = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filtro Poka-Yoke: Si el usuario solo puede ver su departamento
    if (user && user.onlyOwnDepartment && user.departmentId) {
      sql += ` AND (m.department_id = ? OR e.department_id = ?)`;
      params.push(user.departmentId, user.departmentId);
    } else if (departmentId) {
      sql += ` AND (m.department_id = ? OR e.department_id = ?)`;
      params.push(departmentId, departmentId);
    }

    if (status) {
      sql += ` AND m.status = ?`;
      params.push(status);
    }

    if (carrier) {
      sql += ` AND UPPER(m.carrier) = UPPER(?)`;
      params.push(carrier);
    }

    if (search) {
      sql += ` AND (
        m.device_code LIKE ? OR 
        m.brand LIKE ? OR 
        m.model LIKE ? OR 
        m.phone_number LIKE ? OR 
        m.imei LIKE ? OR 
        m.serial_number LIKE ? OR
        m.mac_address LIKE ? OR
        m.sim_iccid LIKE ? OR
        m.contract_number LIKE ? OR
        m.plan_name LIKE ? OR
        e.full_name LIKE ?
      )`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }

    sql += ` ORDER BY m.device_code ASC`;

    const devices = await query(sql, params);

    // Parsear el JSON de notes_history y filtrar por vencimiento de contrato si aplica
    let formatted = devices.map((d: any) => {
      let notes = [];
      try {
        notes = d.notes_history ? JSON.parse(d.notes_history) : [];
      } catch {
        notes = [];
      }
      return {
        ...d,
        monthly_cost: Number(d.monthly_cost || 0),
        notesHistory: notes,
      };
    });

    if (contractFilter === 'EXPIRED') {
      formatted = formatted.filter((d: any) => d.days_until_contract_end !== null && d.days_until_contract_end < 0);
    } else if (contractFilter === 'EXPIRING') {
      formatted = formatted.filter((d: any) => d.days_until_contract_end !== null && d.days_until_contract_end >= 0 && d.days_until_contract_end <= 45);
    }

    return NextResponse.json({ devices: formatted });
  } catch (error: any) {
    console.error('Error al listar celulares:', error);
    return NextResponse.json({ error: 'Error al consultar dispositivos móviles.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      brand,
      model,
      serialNumber,
      macAddress,
      employeeId,
      departmentId,
      phoneNumber,
      imei,
      simIccid,
      carrier = 'Tigo',
      planName,
      monthlyCost = 0,
      contractNumber,
      contractStartDate,
      contractEndDate,
      renewalAlertDays = 30,
      deliveryDate,
      initialNote,
    } = body;

    // Validación Poka-Yoke
    if (!brand || !model || !phoneNumber || !imei || !deliveryDate) {
      return NextResponse.json(
        { error: 'Campos obligatorios: Marca, Modelo, Número Telefónico, IMEI y Fecha de Entrega.' },
        { status: 400 }
      );
    }

    // Verificar unicidad de IMEI
    const existingImei = await queryOne(
      `SELECT id FROM mobile_devices WHERE imei = ?`,
      [imei.trim()]
    );
    if (existingImei) {
      return NextResponse.json(
        { error: `El número IMEI "${imei}" ya está registrado en otro dispositivo.` },
        { status: 400 }
      );
    }

    // Generar correlativo automático CEL-XXX seguro
    const allCodes = await query<any>(`SELECT device_code FROM mobile_devices`);
    let maxNum = 0;
    for (const c of allCodes) {
      const m = c.device_code?.match(/CEL-(\d+)/i);
      if (m && m[1]) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    const nextSeq = (maxNum + 1).toString().padStart(3, '0');
    const deviceCode = `CEL-${nextSeq}`;
    const id = `cel-${Date.now()}`;

    // Historial inicial de notas
    const notesHistory = initialNote ? [
      {
        id: '1',
        date: deliveryDate,
        note: initialNote.trim(),
        author: user.fullName,
      }
    ] : [];

    await run(
      `INSERT INTO mobile_devices (
        id, device_code, brand, model, serial_number, mac_address,
        employee_id, department_id, phone_number, imei, sim_iccid,
        carrier, plan_name, monthly_cost, contract_number,
        contract_start_date, contract_end_date, renewal_alert_days,
        delivery_date, status, notes_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        deviceCode,
        brand.trim(),
        model.trim(),
        serialNumber?.trim() || null,
        macAddress?.trim() || null,
        employeeId || null,
        departmentId || null,
        phoneNumber.trim(),
        imei.trim(),
        simIccid?.trim() || null,
        carrier?.trim() || 'Tigo',
        planName?.trim() || null,
        parseFloat(monthlyCost) || 0,
        contractNumber?.trim() || null,
        contractStartDate || deliveryDate || null,
        contractEndDate || null,
        parseInt(renewalAlertDays, 10) || 30,
        deliveryDate,
        employeeId ? 'ASIGNADO' : 'DISPONIBLE',
        JSON.stringify(notesHistory),
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_CELULAR',
      module: 'CELULARES',
      entityId: id,
      entityName: `${deviceCode} - ${brand} ${model} (${phoneNumber})`,
      afterState: { deviceCode, brand, model, phoneNumber, imei, carrier, contractEndDate },
      reason: `Registro de nuevo celular y línea corporativa IMEI ${imei}`,
    });

    return NextResponse.json({ success: true, id, deviceCode });
  } catch (error: any) {
    console.error('Error al registrar celular:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar celular.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      brand,
      model,
      serialNumber,
      macAddress,
      employeeId,
      departmentId,
      phoneNumber,
      imei,
      simIccid,
      carrier,
      planName,
      monthlyCost,
      contractNumber,
      contractStartDate,
      contractEndDate,
      renewalAlertDays,
      deliveryDate,
      status,
      addNote,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de celular requerido' }, { status: 400 });
    }

    const current = await queryOne<any>(`SELECT * FROM mobile_devices WHERE id = ?`, [id]);
    if (!current) {
      return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 });
    }

    // Gestionar historial de notas
    let notes = [];
    try {
      notes = current.notes_history ? JSON.parse(current.notes_history) : [];
    } catch {
      notes = [];
    }

    if (addNote && addNote.trim()) {
      notes.push({
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        note: addNote.trim(),
        author: user.fullName,
      });
    }

    // Si cambió de empleado, registrar nota automática
    if (employeeId !== undefined && employeeId !== current.employee_id) {
      if (employeeId) {
        const emp = await queryOne<any>(`SELECT full_name FROM employees WHERE id = ?`, [employeeId]);
        notes.push({
          id: (Date.now() + 1).toString(),
          date: new Date().toISOString().split('T')[0],
          note: `Reasignado a empleado: ${emp ? emp.full_name : employeeId}`,
          author: user.fullName,
        });
      } else {
        notes.push({
          id: (Date.now() + 1).toString(),
          date: new Date().toISOString().split('T')[0],
          note: `Liberado a Bodega / Disponible (sin empleado asignado)`,
          author: user.fullName,
        });
      }
    }

    const nextEmployeeId = employeeId !== undefined ? (employeeId || null) : current.employee_id;
    const nextStatus = status || (nextEmployeeId ? 'ASIGNADO' : 'DISPONIBLE');

    await run(
      `UPDATE mobile_devices SET
        brand = ?,
        model = ?,
        serial_number = ?,
        mac_address = ?,
        employee_id = ?,
        department_id = ?,
        phone_number = ?,
        imei = ?,
        sim_iccid = ?,
        carrier = ?,
        plan_name = ?,
        monthly_cost = ?,
        contract_number = ?,
        contract_start_date = ?,
        contract_end_date = ?,
        renewal_alert_days = ?,
        delivery_date = ?,
        status = ?,
        notes_history = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        brand !== undefined ? brand.trim() : current.brand,
        model !== undefined ? model.trim() : current.model,
        serialNumber !== undefined ? (serialNumber?.trim() || null) : current.serial_number,
        macAddress !== undefined ? (macAddress?.trim() || null) : current.mac_address,
        nextEmployeeId,
        departmentId !== undefined ? (departmentId || null) : current.department_id,
        phoneNumber !== undefined ? phoneNumber.trim() : current.phone_number,
        imei !== undefined ? imei.trim() : current.imei,
        simIccid !== undefined ? (simIccid?.trim() || null) : current.sim_iccid,
        carrier !== undefined ? (carrier?.trim() || 'Tigo') : current.carrier,
        planName !== undefined ? (planName?.trim() || null) : current.plan_name,
        monthlyCost !== undefined ? (parseFloat(monthlyCost) || 0) : current.monthly_cost,
        contractNumber !== undefined ? (contractNumber?.trim() || null) : current.contract_number,
        contractStartDate !== undefined ? (contractStartDate || null) : current.contract_start_date,
        contractEndDate !== undefined ? (contractEndDate || null) : current.contract_end_date,
        renewalAlertDays !== undefined ? (parseInt(renewalAlertDays, 10) || 30) : current.renewal_alert_days,
        deliveryDate || current.delivery_date,
        nextStatus,
        JSON.stringify(notes),
        id,
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'MODIFICAR_CELULAR',
      module: 'CELULARES',
      entityId: id,
      entityName: current.device_code,
      reason: 'Actualización de datos de línea móvil, contrato o reasignación de dispositivo',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar celular:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUBADMIN')) {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar registros de líneas móviles.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const current = await queryOne<any>(`SELECT * FROM mobile_devices WHERE id = ?`, [id]);
    if (!current) {
      return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 });
    }

    await run(`DELETE FROM mobile_devices WHERE id = ?`, [id]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ELIMINAR_CELULAR',
      module: 'CELULARES',
      entityId: id,
      entityName: `${current.device_code} (${current.phone_number})`,
      reason: 'Eliminación de registro de dispositivo/línea móvil',
    });

    return NextResponse.json({ success: true, message: 'Línea y dispositivo móvil eliminados correctamente.' });
  } catch (error: any) {
    console.error('Error al eliminar celular:', error);
    return NextResponse.json({ error: 'Error al eliminar celular.' }, { status: 500 });
  }
}
