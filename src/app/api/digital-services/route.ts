import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DEFAULT_ISSUER_NAME, DEFAULT_ISSUER_ROLE, DEFAULT_LEGAL_NOTICE } from '@/lib/actas-constants';

const DEFAULT_CONTRACT_TYPES: Record<string, string> = {
  LICENCIA_SAAS: 'Licencia / Software SaaS',
  CONTRATO_PROVEEDOR: 'Contrato con Proveedor',
  ENLACE_INTERNET: 'Enlace Internet / Telecom',
  ARRENDAMIENTO_EQUIPO: 'Arrendamiento (Impresoras/Equipos)',
  SOPORTE_MANTENIMIENTO: 'Póliza Soporte / Mantenimiento',
  DOMINIO_HOSTING: 'Dominio Web / Hosting / SSL',
};

async function getContractTypesMap(): Promise<Record<string, string>> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'custom_contract_types_json'`
  );
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_CONTRACT_TYPES;
}

async function createLicenseActa(params: {
  employeeId?: string | null;
  recipientName?: string;
  licenseName: string;
  provider: string;
  contractNumber?: string;
  isRenewal?: boolean;
}) {
  const emp = params.employeeId
    ? await queryOne<any>(
        `SELECT e.*, d.name as department_name, s.full_name as supervisor_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         LEFT JOIN employees s ON e.supervisor_id = s.id
         WHERE e.id = ?`,
        [params.employeeId]
      )
    : null;

  const settingsRows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key IN ('acta_issuer_name', 'acta_issuer_role', 'acta_issuer_signature')`
  );
  const map: Record<string, string> = {};
  for (const r of settingsRows) map[r.key] = r.value;

  const issuerName = map['acta_issuer_name'] || DEFAULT_ISSUER_NAME;
  const issuerRole =
    !map['acta_issuer_role'] || map['acta_issuer_role'] === 'Jefe de IT / Administración de Inventario'
      ? DEFAULT_ISSUER_ROLE
      : map['acta_issuer_role'];
  const issuerSignature = map['acta_issuer_signature'] || null;

  const year = new Date().getFullYear();
  const countRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM delivery_actas`);
  const nextNum = ((countRow?.cnt || 0) + 1).toString().padStart(4, '0');
  const actaCode = `ACTA-${year}-${nextNum}`;
  const actaId = `acta-${Date.now()}`;
  const publicToken = `tok-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  const items = [
    {
      code: params.contractNumber || `LIC-${nextNum}`,
      name: `${params.isRenewal ? '[RENOVACIÓN] ' : ''}Licencia / Servicio Digital: ${params.licenseName}`,
      brand: params.provider,
      model: 'Licencia Digital Corporativa',
      serial_number: emp?.email || 'Acceso Digital',
      quantity: 1,
      receive_condition: 'NUEVO',
    },
  ];

  await run(
    `INSERT INTO delivery_actas (
      id, acta_code, acta_type, employee_id, employee_code, employee_name,
      employee_dpi, employee_email, employee_phone, department_name, supervisor_name,
      delivered_by_name, delivered_by_role, delivered_by_signature,
      items_json, delivery_date, status, public_token, legal_notice, notes
    ) VALUES (?, ?, 'ENTREGA_INICIAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE_FIRMA', ?, ?, ?)`,
    [
      actaId,
      actaCode,
      emp?.id || null,
      emp?.employee_code || null,
      emp?.full_name || params.recipientName || 'Colaborador Asignado',
      emp?.dpi || null,
      emp?.email || null,
      emp?.phone || null,
      emp?.department_name || 'General',
      emp?.supervisor_name || null,
      issuerName,
      issuerRole,
      issuerSignature,
      JSON.stringify(items),
      nowIso,
      publicToken,
      DEFAULT_LEGAL_NOTICE,
      params.isRenewal
        ? `Renovación de licencia / contrato digital (${params.licenseName})`
        : `Asignación de licencia / servicio digital (${params.licenseName})`,
    ]
  );

  return { actaId, actaCode, publicToken };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const contractType = searchParams.get('contractType');
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';

    let sql = `
      SELECT 
        s.*,
        lc.name as category_name,
        d_resp.name as responsible_department_name,
        d_chg.name as charged_department_name,
        e.full_name as assigned_employee_name,
        e.employee_code as assigned_employee_code,
        e.phone as assigned_employee_phone,
        e.email as assigned_employee_email,
        da.acta_code,
        da.status as acta_status,
        da.public_token as acta_token,
        CASE 
          WHEN s.no_expiration = 1 THEN NULL
          WHEN s.expiration_date IS NOT NULL AND s.expiration_date != ''
          THEN CAST((julianday(s.expiration_date) - julianday('now')) AS INTEGER)
          ELSE NULL
        END as days_until_expiration
      FROM digital_services s
      LEFT JOIN license_categories lc ON s.category_id = lc.id
      LEFT JOIN departments d_resp ON s.responsible_department_id = d_resp.id
      LEFT JOIN departments d_chg ON s.charged_department_id = d_chg.id
      LEFT JOIN employees e ON s.assigned_employee_id = e.id
      LEFT JOIN delivery_actas da ON s.acta_id = da.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (search.trim()) {
      sql += ` AND (s.name LIKE ? OR s.provider LIKE ? OR s.contract_number LIKE ? OR s.contact_name LIKE ? OR s.notes LIKE ? OR s.assigned_users_text LIKE ? OR e.full_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term, term);
    }

    if (categoryId) {
      sql += ` AND s.category_id = ?`;
      params.push(categoryId);
    }

    if (contractType) {
      sql += ` AND s.contract_type = ?`;
      params.push(contractType);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY s.expiration_date ASC`;

    const services = await query(sql, params);

    const categories = await query(`
      SELECT lc.*, 
        (SELECT COUNT(*) FROM digital_services ds WHERE ds.category_id = lc.id) as services_count,
        (SELECT COALESCE(SUM(ds.seats_used), 0) FROM digital_services ds WHERE ds.category_id = lc.id) as total_users_count
      FROM license_categories lc
      WHERE lc.is_active = 1
      ORDER BY lc.name ASC
    `);

    const departments = await query(`SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY name ASC`);
    const employees = await query(
      `SELECT id, employee_code, full_name, email, phone FROM employees WHERE status = 'ACTIVO' ORDER BY full_name ASC`
    );
    const contractTypes = await getContractTypesMap();

    return NextResponse.json({
      success: true,
      count: services.length,
      services,
      categories,
      departments,
      employees,
      contractTypes,
    });
  } catch (error: any) {
    console.error('Error al consultar servicios digitales y contratos:', error);
    return NextResponse.json({ error: 'Error al consultar servicios.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { action, categoryName, categoryDescription, categoryIdToDelete } = body;

    // 1. Crear nueva categoría en Ajustes
    if (action === 'CREATE_CATEGORY') {
      if (!categoryName || !categoryName.trim()) {
        return NextResponse.json({ error: 'El nombre de la categoría es obligatorio.' }, { status: 400 });
      }
      const catId = `lcat-${Date.now()}`;
      await run(
        `INSERT INTO license_categories (id, name, description, is_active) VALUES (?, ?, ?, 1)`,
        [catId, categoryName.trim(), categoryDescription ? categoryDescription.trim() : null]
      );
      return NextResponse.json({ success: true, categoryId: catId });
    }

    // 2. Eliminar categoría en Ajustes
    if (action === 'DELETE_CATEGORY') {
      if (!categoryIdToDelete) {
        return NextResponse.json({ error: 'ID de categoría requerido.' }, { status: 400 });
      }
      await run(`UPDATE digital_services SET category_id = NULL WHERE category_id = ?`, [categoryIdToDelete]);
      await run(`DELETE FROM license_categories WHERE id = ?`, [categoryIdToDelete]);
      return NextResponse.json({ success: true });
    }

    // 3. Agregar o Eliminar Tipo de Registro en Ajustes
    if (action === 'ADD_CONTRACT_TYPE') {
      const { typeLabel } = body;
      if (!typeLabel || !String(typeLabel).trim()) {
        return NextResponse.json({ error: 'El nombre del tipo de registro es obligatorio.' }, { status: 400 });
      }
      const currentMap = await getContractTypesMap();
      const key =
        String(typeLabel)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .slice(0, 24) || `TIPO_${Date.now()}`;
      currentMap[key] = String(typeLabel).trim();

      const exists = await queryOne(`SELECT key FROM system_settings WHERE key = 'custom_contract_types_json'`);
      if (exists) {
        await run(
          `UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = 'custom_contract_types_json'`,
          [JSON.stringify(currentMap)]
        );
      } else {
        await run(
          `INSERT INTO system_settings (key, value, description, updated_at) VALUES ('custom_contract_types_json', ?, 'Tipos de registro de licencias y contratos', datetime('now'))`,
          [JSON.stringify(currentMap)]
        );
      }
      return NextResponse.json({ success: true, contractTypes: currentMap });
    }

    if (action === 'DELETE_CONTRACT_TYPE') {
      const { typeKey } = body;
      const currentMap = await getContractTypesMap();
      delete currentMap[typeKey];
      await run(
        `INSERT OR REPLACE INTO system_settings (key, value, description, updated_at) VALUES ('custom_contract_types_json', ?, 'Tipos de registro de licencias y contratos', datetime('now'))`,
        [JSON.stringify(currentMap)]
      );
      return NextResponse.json({ success: true, contractTypes: currentMap });
    }

    const {
      name,
      categoryId,
      provider,
      contractNumber,
      contractType = 'LICENCIA_SAAS',
      contactName,
      contactPhone,
      contactEmail,
      slaTerms,
      responsibleDepartmentId,
      chargedDepartmentId,
      assignedEmployeeId,
      planType,
      licenseType = 'USUARIOS',
      seatsContracted = 1,
      seatsUsed = 1,
      costPeriod,
      amount,
      currency = 'GTQ',
      startDate,
      expirationDate,
      noExpiration = false,
      renewalDate,
      autoRenew = 'SI',
      status = 'ACTIVA',
      paymentMethodRef,
      invoiceNumber,
      warrantyDocumentUrl,
      invoiceDocumentUrl,
      assignedUsersText,
      requiresActa = false,
      notes,
    } = body;

    if (!name || !provider || !costPeriod) {
      return NextResponse.json({ error: 'Nombre, proveedor y período de costo son requeridos.' }, { status: 400 });
    }

    const id = `srv-${Date.now()}`;
    const numAmount = amount ? parseFloat(amount) : 0;

    let monthlyEquivalent = 0;
    if (costPeriod === 'MENSUAL') {
      monthlyEquivalent = numAmount;
    } else if (costPeriod === 'ANUAL') {
      monthlyEquivalent = Math.round((numAmount / 12) * 100) / 100;
    }

    let actaId: string | null = null;
    let actaCode: string | null = null;
    if (requiresActa) {
      const created = await createLicenseActa({
        employeeId: assignedEmployeeId || null,
        recipientName: assignedUsersText || 'Colaborador Asignado',
        licenseName: name.trim(),
        provider: provider.trim(),
        contractNumber: contractNumber?.trim(),
        isRenewal: false,
      });
      actaId = created.actaId;
      actaCode = created.actaCode;
    }

    await run(
      `INSERT INTO digital_services (
        id, name, category_id, provider, contract_number, contract_type,
        contact_name, contact_phone, contact_email, sla_terms,
        responsible_department_id, charged_department_id, assigned_employee_id,
        plan_type, license_type, seats_contracted, seats_used, cost_period,
        amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date,
        no_expiration, auto_renew, status, payment_method_ref, invoice_number,
        warranty_document_url, invoice_document_url, assigned_users_text,
        requires_acta, acta_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        categoryId || null,
        provider.trim(),
        contractNumber?.trim() || null,
        contractType || 'LICENCIA_SAAS',
        contactName?.trim() || null,
        contactPhone?.trim() || null,
        contactEmail?.trim() || null,
        slaTerms?.trim() || null,
        responsibleDepartmentId || null,
        chargedDepartmentId || null,
        assignedEmployeeId || null,
        planType?.trim() || null,
        licenseType,
        parseInt(seatsContracted, 10) || 1,
        parseInt(seatsUsed, 10) || 1,
        costPeriod,
        costPeriod === 'GRATUITO' ? 0 : numAmount,
        monthlyEquivalent,
        currency,
        startDate || null,
        noExpiration ? null : expirationDate || null,
        noExpiration ? null : renewalDate || expirationDate || null,
        noExpiration ? 1 : 0,
        noExpiration ? 'NO' : autoRenew,
        status,
        paymentMethodRef?.trim() || null,
        invoiceNumber?.trim() || null,
        warrantyDocumentUrl || null,
        invoiceDocumentUrl || null,
        assignedUsersText?.trim() || null,
        requiresActa ? 1 : 0,
        actaId,
        notes?.trim() || null,
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_SERVICIO_CONTRATO',
      module: 'SERVICIOS_DIGITALES',
      entityId: id,
      entityName: `${name} (${provider})`,
      reason: `Alta de ${contractType} con proveedor ${provider}${actaCode ? ` | Acta: ${actaCode}` : ''}`,
    });

    return NextResponse.json({ success: true, id, actaId, actaCode });
  } catch (error: any) {
    console.error('Error al registrar servicio digital o contrato:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar servicio.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      id,
      name,
      categoryId,
      provider,
      contractNumber,
      contractType,
      contactName,
      contactPhone,
      contactEmail,
      slaTerms,
      responsibleDepartmentId,
      chargedDepartmentId,
      assignedEmployeeId,
      planType,
      seatsContracted,
      seatsUsed,
      costPeriod,
      amount,
      currency,
      startDate,
      expirationDate,
      noExpiration,
      renewalDate,
      autoRenew,
      status,
      assignedUsersText,
      requiresActa,
      isRenewal = false,
      notes,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const current = await queryOne<any>(`SELECT * FROM digital_services WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    const numAmount = amount !== undefined ? parseFloat(amount) || 0 : current.amount;
    const effPeriod = costPeriod || current.cost_period;
    let monthlyEquivalent = 0;
    if (effPeriod === 'MENSUAL') monthlyEquivalent = numAmount;
    else if (effPeriod === 'ANUAL') monthlyEquivalent = Math.round((numAmount / 12) * 100) / 100;

    let newActaId = current.acta_id;
    let newActaCode: string | null = null;
    if (requiresActa) {
      const created = await createLicenseActa({
        employeeId: assignedEmployeeId !== undefined ? assignedEmployeeId : current.assigned_employee_id,
        recipientName: assignedUsersText || current.assigned_users_text || 'Colaborador Asignado',
        licenseName: name || current.name,
        provider: provider || current.provider,
        contractNumber: contractNumber || current.contract_number,
        isRenewal: Boolean(isRenewal),
      });
      newActaId = created.actaId;
      newActaCode = created.actaCode;
    }

    const effNoExp = noExpiration !== undefined ? (noExpiration ? 1 : 0) : current.no_expiration || 0;

    await run(
      `UPDATE digital_services SET
        name = ?,
        category_id = ?,
        provider = ?,
        contract_number = ?,
        contract_type = ?,
        contact_name = ?,
        contact_phone = ?,
        contact_email = ?,
        sla_terms = ?,
        responsible_department_id = ?,
        charged_department_id = ?,
        assigned_employee_id = ?,
        plan_type = ?,
        seats_contracted = ?,
        seats_used = ?,
        cost_period = ?,
        amount = ?,
        monthly_equivalent_cost = ?,
        currency = ?,
        start_date = ?,
        expiration_date = ?,
        renewal_date = ?,
        no_expiration = ?,
        auto_renew = ?,
        status = ?,
        assigned_users_text = ?,
        requires_acta = ?,
        acta_id = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || current.name,
        categoryId !== undefined ? categoryId || null : current.category_id,
        provider || current.provider,
        contractNumber !== undefined ? contractNumber?.trim() || null : current.contract_number,
        contractType || current.contract_type || 'LICENCIA_SAAS',
        contactName !== undefined ? contactName?.trim() || null : current.contact_name,
        contactPhone !== undefined ? contactPhone?.trim() || null : current.contact_phone,
        contactEmail !== undefined ? contactEmail?.trim() || null : current.contact_email,
        slaTerms !== undefined ? slaTerms?.trim() || null : current.sla_terms,
        responsibleDepartmentId !== undefined
          ? responsibleDepartmentId || null
          : current.responsible_department_id,
        chargedDepartmentId !== undefined ? chargedDepartmentId || null : current.charged_department_id,
        assignedEmployeeId !== undefined ? assignedEmployeeId || null : current.assigned_employee_id,
        planType !== undefined ? planType || null : current.plan_type,
        seatsContracted !== undefined ? parseInt(seatsContracted, 10) || 1 : current.seats_contracted,
        seatsUsed !== undefined ? parseInt(seatsUsed, 10) || 1 : current.seats_used,
        effPeriod,
        numAmount,
        monthlyEquivalent,
        currency || current.currency || 'GTQ',
        startDate !== undefined ? startDate || null : current.start_date,
        effNoExp ? null : expirationDate !== undefined ? expirationDate || null : current.expiration_date,
        effNoExp ? null : renewalDate !== undefined ? renewalDate || null : current.renewal_date,
        effNoExp,
        effNoExp ? 'NO' : autoRenew || current.auto_renew,
        status || current.status,
        assignedUsersText !== undefined ? assignedUsersText || null : current.assigned_users_text,
        requiresActa ? 1 : current.requires_acta || 0,
        newActaId || null,
        notes !== undefined ? notes || null : current.notes,
        id,
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: isRenewal ? 'RENOVAR_LICENCIA_CONTRATO' : 'MODIFICAR_SERVICIO_DIGITAL',
      module: 'SERVICIOS_DIGITALES',
      entityId: id,
      entityName: name || current.name,
      reason: `${isRenewal ? 'Renovación' : 'Actualización'} de licencia/contrato${newActaCode ? ` | Nueva Acta: ${newActaCode}` : ''}`,
    });

    return NextResponse.json({ success: true, actaId: newActaId, actaCode: newActaCode });
  } catch (error: any) {
    console.error('Error al actualizar servicio:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUBADMIN')) {
      return NextResponse.json({ error: 'No autorizado para eliminar contratos o licencias.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const current = await queryOne<any>(`SELECT * FROM digital_services WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });

    await run(`DELETE FROM digital_services WHERE id = ?`, [id]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ELIMINAR_SERVICIO_DIGITAL',
      module: 'SERVICIOS_DIGITALES',
      entityId: id,
      entityName: `${current.name} (${current.provider})`,
      reason: 'Eliminación de contrato o licencia digital',
    });

    return NextResponse.json({ success: true, message: 'Registro eliminado correctamente.' });
  } catch (error: any) {
    console.error('Error al eliminar servicio:', error);
    return NextResponse.json({ error: 'Error al eliminar servicio.' }, { status: 500 });
  }
}
