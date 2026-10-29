import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
        CASE 
          WHEN s.expiration_date IS NOT NULL AND s.expiration_date != ''
          THEN CAST((julianday(s.expiration_date) - julianday('now')) AS INTEGER)
          ELSE NULL
        END as days_until_expiration
      FROM digital_services s
      LEFT JOIN license_categories lc ON s.category_id = lc.id
      LEFT JOIN departments d_resp ON s.responsible_department_id = d_resp.id
      LEFT JOIN departments d_chg ON s.charged_department_id = d_chg.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (search.trim()) {
      sql += ` AND (s.name LIKE ? OR s.provider LIKE ? OR s.contract_number LIKE ? OR s.contact_name LIKE ? OR s.notes LIKE ? OR s.assigned_users_text LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
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

    // Listar categorías de licencias y contratos
    const categories = await query(`
      SELECT lc.*, 
        (SELECT COUNT(*) FROM digital_services ds WHERE ds.category_id = lc.id) as services_count,
        (SELECT COALESCE(SUM(ds.seats_used), 0) FROM digital_services ds WHERE ds.category_id = lc.id) as total_users_count
      FROM license_categories lc
      WHERE lc.is_active = 1
      ORDER BY lc.name ASC
    `);

    // Departamentos para vincular con la base de datos
    const departments = await query(`SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY name ASC`);

    return NextResponse.json({
      success: true,
      count: services.length,
      services,
      categories,
      departments,
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
    const { action, categoryName, categoryDescription } = body;

    // Crear nueva categoría de licencias o contratos dinámicamente
    if (action === 'CREATE_CATEGORY') {
      if (!categoryName || !categoryName.trim()) {
        return NextResponse.json({ error: 'El nombre de la categoría es obligatorio.' }, { status: 400 });
      }

      const catId = `lcat-${Date.now()}`;
      await run(
        `INSERT INTO license_categories (id, name, description, is_active) VALUES (?, ?, ?, 1)`,
        [catId, categoryName.trim(), categoryDescription ? categoryDescription.trim() : null]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'CREAR_CATEGORIA_LICENCIA',
        module: 'SERVICIOS_DIGITALES',
        entityId: catId,
        entityName: categoryName.trim(),
        reason: 'Creación de categoría para licencias, dominios o contratos de proveedores',
      });

      return NextResponse.json({ success: true, categoryId: catId });
    }

    const {
      name,
      categoryId,
      provider,
      contractNumber,
      contractType = 'LICENCIA_SAAS', // 'LICENCIA_SAAS', 'CONTRATO_PROVEEDOR', 'ENLACE_INTERNET', 'ARRENDAMIENTO_EQUIPO', 'SOPORTE_MANTENIMIENTO', 'DOMINIO_HOSTING'
      contactName,
      contactPhone,
      contactEmail,
      slaTerms,
      responsibleDepartmentId,
      chargedDepartmentId,
      planType,
      licenseType = 'USUARIOS',
      seatsContracted = 1,
      seatsUsed = 1,
      costPeriod, // 'MENSUAL', 'ANUAL', 'UNICO', 'GRATUITO'
      amount,
      currency = 'GTQ', // 'GTQ' o 'USD'
      startDate,
      expirationDate,
      renewalDate,
      autoRenew = 'SI',
      status = 'ACTIVA', // 'ACTIVA', 'GRATUITA', 'PAGO_UNICO', 'CADUCADA_INACTIVA'
      paymentMethodRef,
      invoiceNumber,
      warrantyDocumentUrl,
      invoiceDocumentUrl,
      assignedUsersText,
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

    await run(`
      INSERT INTO digital_services (
        id, name, category_id, provider, contract_number, contract_type,
        contact_name, contact_phone, contact_email, sla_terms,
        responsible_department_id, charged_department_id,
        plan_type, license_type, seats_contracted, seats_used, cost_period,
        amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date,
        auto_renew, status, payment_method_ref, invoice_number, warranty_document_url, invoice_document_url,
        assigned_users_text, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name.trim(), categoryId || null, provider.trim(),
      contractNumber?.trim() || null, contractType || 'LICENCIA_SAAS',
      contactName?.trim() || null, contactPhone?.trim() || null, contactEmail?.trim() || null, slaTerms?.trim() || null,
      responsibleDepartmentId || null, chargedDepartmentId || null,
      planType?.trim() || null, licenseType, parseInt(seatsContracted, 10) || 1, parseInt(seatsUsed, 10) || 1,
      costPeriod, costPeriod === 'GRATUITO' ? 0 : numAmount, monthlyEquivalent, currency,
      startDate || null, expirationDate || null, renewalDate || expirationDate || null,
      autoRenew, status, paymentMethodRef?.trim() || null, invoiceNumber?.trim() || null,
      warrantyDocumentUrl || null, invoiceDocumentUrl || null,
      assignedUsersText?.trim() || null, notes?.trim() || null
    ]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_SERVICIO_CONTRATO',
      module: 'SERVICIOS_DIGITALES',
      entityId: id,
      entityName: `${name} (${provider})`,
      reason: `Alta de ${contractType} con proveedor ${provider} (${currency} ${numAmount})`,
    });

    return NextResponse.json({ success: true, id });
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
      planType,
      seatsContracted,
      seatsUsed,
      costPeriod,
      amount,
      currency,
      startDate,
      expirationDate,
      renewalDate,
      autoRenew,
      status,
      assignedUsersText,
      notes,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const current = await queryOne<any>(`SELECT * FROM digital_services WHERE id = ?`, [id]);
    if (!current) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    const numAmount = amount !== undefined ? (parseFloat(amount) || 0) : current.amount;
    const effPeriod = costPeriod || current.cost_period;
    let monthlyEquivalent = 0;
    if (effPeriod === 'MENSUAL') monthlyEquivalent = numAmount;
    else if (effPeriod === 'ANUAL') monthlyEquivalent = Math.round((numAmount / 12) * 100) / 100;

    await run(`
      UPDATE digital_services SET
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
        auto_renew = ?,
        status = ?,
        assigned_users_text = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `, [
      name || current.name,
      categoryId !== undefined ? (categoryId || null) : current.category_id,
      provider || current.provider,
      contractNumber !== undefined ? (contractNumber?.trim() || null) : current.contract_number,
      contractType || current.contract_type || 'LICENCIA_SAAS',
      contactName !== undefined ? (contactName?.trim() || null) : current.contact_name,
      contactPhone !== undefined ? (contactPhone?.trim() || null) : current.contact_phone,
      contactEmail !== undefined ? (contactEmail?.trim() || null) : current.contact_email,
      slaTerms !== undefined ? (slaTerms?.trim() || null) : current.sla_terms,
      responsibleDepartmentId !== undefined ? (responsibleDepartmentId || null) : current.responsible_department_id,
      chargedDepartmentId !== undefined ? (chargedDepartmentId || null) : current.charged_department_id,
      planType !== undefined ? (planType || null) : current.plan_type,
      seatsContracted !== undefined ? (parseInt(seatsContracted, 10) || 1) : current.seats_contracted,
      seatsUsed !== undefined ? (parseInt(seatsUsed, 10) || 1) : current.seats_used,
      effPeriod,
      numAmount,
      monthlyEquivalent,
      currency || current.currency || 'GTQ',
      startDate !== undefined ? (startDate || null) : current.start_date,
      expirationDate !== undefined ? (expirationDate || null) : current.expiration_date,
      renewalDate !== undefined ? (renewalDate || null) : current.renewal_date,
      autoRenew || current.auto_renew,
      status || current.status,
      assignedUsersText !== undefined ? (assignedUsersText || null) : current.assigned_users_text,
      notes !== undefined ? (notes || null) : current.notes,
      id
    ]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'MODIFICAR_SERVICIO_DIGITAL',
      module: 'SERVICIOS_DIGITALES',
      entityId: id,
      entityName: name || current.name,
      reason: 'Actualización de contrato con proveedor, servicio digital o licencias',
    });

    return NextResponse.json({ success: true });
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
