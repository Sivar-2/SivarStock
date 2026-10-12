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

    let sql = `
      SELECT 
        m.id, m.device_code, m.brand, m.model, m.employee_id, m.department_id,
        m.phone_number, m.imei, m.delivery_date, m.status, m.notes_history,
        m.created_at, m.updated_at,
        e.full_name as employee_name, e.employee_code, e.email as employee_email, e.initials as employee_initials,
        d.name as department_name, d.code as department_code
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

    if (search) {
      sql += ` AND (
        m.device_code LIKE ? OR 
        m.brand LIKE ? OR 
        m.model LIKE ? OR 
        m.phone_number LIKE ? OR 
        m.imei LIKE ? OR 
        e.full_name LIKE ?
      )`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s, s);
    }

    sql += ` ORDER BY m.device_code ASC`;

    const devices = await query(sql, params);

    // Parsear el JSON de notes_history de manera segura
    const formatted = devices.map((d: any) => {
      let notes = [];
      try {
        notes = d.notes_history ? JSON.parse(d.notes_history) : [];
      } catch {
        notes = [];
      }
      return {
        ...d,
        notesHistory: notes,
      };
    });

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
      employeeId,
      departmentId,
      phoneNumber,
      imei,
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

    // Generar correlativo automático CEL-XXX
    const countRow = await queryOne<any>(`SELECT COUNT(*) as total FROM mobile_devices`);
    const nextSeq = (countRow ? countRow.total + 1 : 1).toString().padStart(3, '0');
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
        id, device_code, brand, model, employee_id, department_id,
        phone_number, imei, delivery_date, status, notes_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        deviceCode,
        brand.trim(),
        model.trim(),
        employeeId || null,
        departmentId || null,
        phoneNumber.trim(),
        imei.trim(),
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
      entityName: `${deviceCode} - ${brand} ${model}`,
      reason: `Registro de nuevo celular corporativo IMEI ${imei}`,
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
      employeeId,
      departmentId,
      phoneNumber,
      imei,
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
    if (employeeId && employeeId !== current.employee_id) {
      const emp = await queryOne<any>(`SELECT full_name FROM employees WHERE id = ?`, [employeeId]);
      notes.push({
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        note: `Reasignado a empleado: ${emp ? emp.full_name : employeeId}`,
        author: user.fullName,
      });
    }

    await run(
      `UPDATE mobile_devices SET
        brand = ?,
        model = ?,
        employee_id = ?,
        department_id = ?,
        phone_number = ?,
        imei = ?,
        delivery_date = ?,
        status = ?,
        notes_history = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        brand || current.brand,
        model || current.model,
        employeeId !== undefined ? employeeId : current.employee_id,
        departmentId !== undefined ? departmentId : current.department_id,
        phoneNumber || current.phone_number,
        imei || current.imei,
        deliveryDate || current.delivery_date,
        status || (employeeId ? 'ASIGNADO' : 'DISPONIBLE'),
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
      reason: 'Actualización de datos o reasignación de dispositivo',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar celular:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}
