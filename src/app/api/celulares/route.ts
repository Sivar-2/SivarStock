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
    const assignmentMode = url.searchParams.get('assignmentMode');
    const incidentFilter = url.searchParams.get('incidentFilter');
    const contractFilter = url.searchParams.get('contractFilter'); // 'EXPIRING', 'EXPIRED', 'ACTIVE'

    let sql = `
      SELECT 
        m.id, m.device_code, m.brand, m.model, m.serial_number, m.mac_address,
        m.employee_id, m.department_id,
        m.phone_number, m.imei, m.sim_iccid, m.carrier, m.custom_carrier_note,
        m.plan_name, m.monthly_cost,
        m.contract_number, m.contract_start_date, m.contract_end_date, m.renewal_alert_days,
        m.assignment_mode, m.incident_type, m.incident_date, m.repair_details,
        m.delivery_date, m.status, m.notes_history,
        m.created_at, m.updated_at,
        e.full_name as employee_name, e.employee_code, e.email as employee_email, e.initials as employee_initials,
        d.name as department_name, d.code as department_code,
        CASE 
          WHEN m.contract_end_date IS NOT NULL AND m.contract_end_date != ''
          THEN CAST((julianday(m.contract_end_date) - julianday('now')) AS INTEGER)
          ELSE NULL
        END as days_until_contract_end,
        CASE
          WHEN m.incident_date IS NOT NULL AND m.incident_date != '' AND m.incident_type IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION', 'MANTENIMIENTO', 'TALLER_DESPERFECTO')
          THEN MAX(0, CAST((julianday('now') - julianday(m.incident_date)) AS INTEGER))
          ELSE NULL
        END as days_waiting_claro
      FROM mobile_devices m
      LEFT JOIN employees e ON m.employee_id = e.id
      LEFT JOIN departments d ON COALESCE(m.department_id, e.department_id) = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

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
      sql += ` AND UPPER(m.carrier) LIKE UPPER(?)`;
      params.push(`%${carrier}%`);
    }

    if (assignmentMode) {
      sql += ` AND COALESCE(m.assignment_mode, 'EQUIPO_Y_LINEA') = ?`;
      params.push(assignmentMode);
    }

    if (incidentFilter) {
      if (incidentFilter === 'WAITING_CLARO') {
        sql += ` AND m.incident_type IN ('ROBO_ASALTO', 'PERDIDA_REPOSICION')`;
      } else if (incidentFilter === 'IN_MAINTENANCE') {
        sql += ` AND (m.incident_type IN ('MANTENIMIENTO', 'TALLER_DESPERFECTO') OR m.status = 'EN_REPARACION')`;
      } else {
        sql += ` AND m.incident_type = ?`;
        params.push(incidentFilter);
      }
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

    let formatted = devices.map((d: any) => {
      let notes = [];
      try {
        notes = d.notes_history ? JSON.parse(d.notes_history) : [];
      } catch {
        notes = [];
      }
      return {
        ...d,
        carrier: d.carrier === 'Tigo' ? 'Claro Guatemala' : (d.carrier || 'Claro Guatemala'),
        assignment_mode: d.assignment_mode || 'EQUIPO_Y_LINEA',
        incident_type: d.incident_type || 'NINGUNO',
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
      assignmentMode = 'EQUIPO_Y_LINEA', // 'EQUIPO_Y_LINEA', 'SOLO_CHIP', 'PERSONAL_SIN_PLAN'
      brand,
      model,
      serialNumber,
      macAddress,
      employeeId,
      departmentId,
      phoneNumber,
      imei,
      simIccid,
      carrier = 'Claro Guatemala',
      customCarrierNote,
      planName,
      monthlyCost = 0,
      contractNumber,
      contractStartDate,
      contractEndDate,
      renewalAlertDays = 30,
      incidentType = 'NINGUNO',
      incidentDate,
      repairDetails,
      deliveryDate,
      initialNote,
    } = body;

    if (!phoneNumber || !deliveryDate) {
      return NextResponse.json(
        { error: 'El Número Telefónico y la Fecha de Registro/Entrega son obligatorios.' },
        { status: 400 }
      );
    }

    const effectiveBrand =
      assignmentMode === 'SOLO_CHIP'
        ? (brand?.trim() || 'Solo Chip SIM')
        : assignmentMode === 'PERSONAL_SIN_PLAN'
        ? (brand?.trim() || 'Teléfono Personal')
        : (brand?.trim() || 'Corporativo');

    const effectiveModel =
      assignmentMode === 'SOLO_CHIP'
        ? (model?.trim() || 'Tarjeta SIM Claro')
        : assignmentMode === 'PERSONAL_SIN_PLAN'
        ? (model?.trim() || 'Sin Plan Corporativo')
        : (model?.trim() || 'Estándar');

    const effectiveImei =
      imei && imei.trim()
        ? imei.trim()
        : `${assignmentMode === 'SOLO_CHIP' ? 'SIM' : 'PER'}-${Date.now().toString().slice(-8)}`;

    const existingImei = await queryOne(
      `SELECT id FROM mobile_devices WHERE imei = ?`,
      [effectiveImei]
    );
    if (existingImei) {
      return NextResponse.json(
        { error: `El identificador IMEI/SIM "${effectiveImei}" ya está registrado en otro dispositivo.` },
        { status: 400 }
      );
    }

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

    const modeLabel =
      assignmentMode === 'SOLO_CHIP'
        ? 'Solo Chip SIM (Sin dispositivo móvil)'
        : assignmentMode === 'PERSONAL_SIN_PLAN'
        ? 'Número Personal del Empleado (Sin plan corporativo)'
        : 'Equipo Móvil + Línea Corporativa';

    const notesHistory = [
      {
        id: '1',
        date: deliveryDate,
        note: initialNote?.trim()
          ? `[Alta: ${modeLabel}] ${initialNote.trim()}`
          : `Alta de registro en modalidad: ${modeLabel} (${phoneNumber.trim()})`,
        author: user.fullName || user.username,
      },
    ];

    const effectiveStatus =
      incidentType === 'MANTENIMIENTO' || incidentType === 'TALLER_DESPERFECTO'
        ? 'EN_REPARACION'
        : employeeId
        ? 'ASIGNADO'
        : 'DISPONIBLE';

    await run(
      `INSERT INTO mobile_devices (
        id, device_code, brand, model, serial_number, mac_address,
        employee_id, department_id, phone_number, imei, sim_iccid,
        carrier, custom_carrier_note, plan_name, monthly_cost, contract_number,
        contract_start_date, contract_end_date, renewal_alert_days,
        assignment_mode, incident_type, incident_date, repair_details,
        delivery_date, status, notes_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        deviceCode,
        effectiveBrand,
        effectiveModel,
        serialNumber?.trim() || null,
        macAddress?.trim() || null,
        employeeId || null,
        departmentId || null,
        phoneNumber.trim(),
        effectiveImei,
        simIccid?.trim() || null,
        carrier?.trim() || 'Claro Guatemala',
        customCarrierNote?.trim() || null,
        assignmentMode === 'PERSONAL_SIN_PLAN' ? 'Sin Plan (Número Personal)' : (planName?.trim() || null),
        assignmentMode === 'PERSONAL_SIN_PLAN' ? 0 : (parseFloat(monthlyCost) || 0),
        contractNumber?.trim() || null,
        contractStartDate || deliveryDate || null,
        assignmentMode === 'PERSONAL_SIN_PLAN' ? null : (contractEndDate || null),
        parseInt(renewalAlertDays, 10) || 30,
        assignmentMode,
        incidentType || 'NINGUNO',
        incidentDate || (incidentType !== 'NINGUNO' ? new Date().toISOString().split('T')[0] : null),
        repairDetails?.trim() || null,
        deliveryDate,
        effectiveStatus,
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
      entityName: `${deviceCode} - ${effectiveBrand} ${effectiveModel} (${phoneNumber})`,
      afterState: { deviceCode, assignmentMode, brand: effectiveBrand, model: effectiveModel, phoneNumber, imei: effectiveImei, carrier },
      reason: `Registro de celular/línea (${modeLabel})`,
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
      assignmentMode,
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
      customCarrierNote,
      planName,
      monthlyCost,
      contractNumber,
      contractStartDate,
      contractEndDate,
      renewalAlertDays,
      incidentType,
      incidentDate,
      repairDetails,
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

    let notes = [];
    try {
      notes = current.notes_history ? JSON.parse(current.notes_history) : [];
    } catch {
      notes = [];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const authorName = user.fullName || user.username;

    // Registrar automáticamente en bitácora si cambió de número telefónico
    if (phoneNumber !== undefined && phoneNumber.trim() !== current.phone_number) {
      notes.push({
        id: `${Date.now()}-num`,
        date: todayStr,
        note: `Cambio de número telefónico: anterior "${current.phone_number}" → nuevo "${phoneNumber.trim()}"`,
        author: authorName,
      });
    }

    // Registrar automáticamente si se actualizó el aparato/modelo o IMEI
    if (
      (brand !== undefined && brand.trim() !== current.brand) ||
      (model !== undefined && model.trim() !== current.model) ||
      (imei !== undefined && imei.trim() !== current.imei)
    ) {
      notes.push({
        id: `${Date.now()}-dev`,
        date: todayStr,
        note: `Actualización de equipo móvil: anterior [${current.brand} ${current.model} - IMEI ${current.imei}] → nuevo [${brand || current.brand} ${model || current.model} - IMEI ${imei || current.imei}]`,
        author: authorName,
      });
    }

    // Registrar automáticamente si cambió el estado de incidente (Mantenimiento / Taller / Robo o Pérdida)
    if (incidentType !== undefined && incidentType !== (current.incident_type || 'NINGUNO')) {
      const labels: Record<string, string> = {
        NINGUNO: 'Operativo Normal (Incidente resuelto / Equipo entregado)',
        MANTENIMIENTO: `En Mantenimiento (${repairDetails || 'En revisión técnica'})`,
        TALLER_DESPERFECTO: `Devuelto al Taller por Desperfecto (${repairDetails || 'Garantía / Taller'})`,
        ROBO_ASALTO: `Reporte por Asalto / Robo — En espera de reposición de equipo Claro (Fecha incidente: ${incidentDate || todayStr})`,
        PERDIDA_REPOSICION: `Reporte por Pérdida / Extravío — En espera de reposición de equipo Claro (Fecha incidente: ${incidentDate || todayStr})`,
      };
      notes.push({
        id: `${Date.now()}-inc`,
        date: todayStr,
        note: `Estado de Incidente/Soporte actualizado: ${labels[incidentType] || incidentType}`,
        author: authorName,
      });
    }

    // Si cambió de empleado, registrar en la bitácora
    if (employeeId !== undefined && employeeId !== current.employee_id) {
      if (employeeId) {
        const emp = await queryOne<any>(`SELECT full_name FROM employees WHERE id = ?`, [employeeId]);
        notes.push({
          id: `${Date.now()}-emp`,
          date: todayStr,
          note: `Reasignado a empleado: ${emp ? emp.full_name : employeeId}`,
          author: authorName,
        });
      } else {
        notes.push({
          id: `${Date.now()}-emp`,
          date: todayStr,
          note: `Liberado a Bodega / Disponible (sin empleado asignado)`,
          author: authorName,
        });
      }
    }

    if (addNote && addNote.trim()) {
      notes.push({
        id: Date.now().toString(),
        date: todayStr,
        note: addNote.trim(),
        author: authorName,
      });
    }

    const nextEmployeeId = employeeId !== undefined ? (employeeId || null) : current.employee_id;
    const nextIncidentType = incidentType !== undefined ? incidentType : (current.incident_type || 'NINGUNO');
    const nextIncidentDate =
      nextIncidentType === 'NINGUNO'
        ? null
        : (incidentDate || current.incident_date || todayStr);

    let nextStatus = status || current.status || (nextEmployeeId ? 'ASIGNADO' : 'DISPONIBLE');
    if (nextIncidentType === 'MANTENIMIENTO' || nextIncidentType === 'TALLER_DESPERFECTO') {
      nextStatus = 'EN_REPARACION';
    }

    await run(
      `UPDATE mobile_devices SET
        assignment_mode = ?,
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
        custom_carrier_note = ?,
        plan_name = ?,
        monthly_cost = ?,
        contract_number = ?,
        contract_start_date = ?,
        contract_end_date = ?,
        renewal_alert_days = ?,
        incident_type = ?,
        incident_date = ?,
        repair_details = ?,
        delivery_date = ?,
        status = ?,
        notes_history = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        assignmentMode !== undefined ? assignmentMode : (current.assignment_mode || 'EQUIPO_Y_LINEA'),
        brand !== undefined ? brand.trim() : current.brand,
        model !== undefined ? model.trim() : current.model,
        serialNumber !== undefined ? (serialNumber?.trim() || null) : current.serial_number,
        macAddress !== undefined ? (macAddress?.trim() || null) : current.mac_address,
        nextEmployeeId,
        departmentId !== undefined ? (departmentId || null) : current.department_id,
        phoneNumber !== undefined ? phoneNumber.trim() : current.phone_number,
        imei !== undefined ? imei.trim() : current.imei,
        simIccid !== undefined ? (simIccid?.trim() || null) : current.sim_iccid,
        carrier !== undefined ? (carrier?.trim() || 'Claro Guatemala') : current.carrier,
        customCarrierNote !== undefined ? (customCarrierNote?.trim() || null) : current.custom_carrier_note,
        planName !== undefined ? (planName?.trim() || null) : current.plan_name,
        monthlyCost !== undefined ? (parseFloat(monthlyCost) || 0) : current.monthly_cost,
        contractNumber !== undefined ? (contractNumber?.trim() || null) : current.contract_number,
        contractStartDate !== undefined ? (contractStartDate || null) : current.contract_start_date,
        contractEndDate !== undefined ? (contractEndDate || null) : current.contract_end_date,
        renewalAlertDays !== undefined ? (parseInt(renewalAlertDays, 10) || 30) : current.renewal_alert_days,
        nextIncidentType,
        nextIncidentDate,
        repairDetails !== undefined ? (repairDetails?.trim() || null) : current.repair_details,
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
      reason: 'Actualización de línea móvil, bitácora de empleado o estado de reposición Claro',
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
