import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const chargedDeptId = searchParams.get('chargedDeptId');
    const costNature = searchParams.get('costNature');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search') || '';

    let sql = `
      SELECT 
        c.*,
        d_chg.name as charged_dept_name,
        d_orig.name as originating_dept_name,
        i.permanent_code as item_permanent_code,
        i.brand as item_brand,
        i.model as item_model,
        i.serial_number as item_serial_number,
        i.warranty_document_url as item_warranty_url,
        i.warranty_expiration as item_warranty_expiration,
        i.invoice_document_url as item_invoice_url,
        p.name as product_name,
        p.code as product_code,
        s.name as service_name,
        u.full_name as recorded_by_user_name
      FROM cost_records c
      LEFT JOIN departments d_chg ON c.charged_department_id = d_chg.id
      LEFT JOIN departments d_orig ON c.originating_department_id = d_orig.id
      LEFT JOIN inventory_items i ON c.item_id = i.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN digital_services s ON c.digital_service_id = s.id
      LEFT JOIN users u ON c.recorded_by_user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search.trim()) {
      sql += ` AND (c.concept LIKE ? OR c.supplier LIKE ? OR c.invoice_number LIKE ? OR c.purchase_order LIKE ? OR i.permanent_code LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (chargedDeptId) {
      sql += ` AND c.charged_department_id = ?`;
      params.push(chargedDeptId);
    }

    if (costNature) {
      sql += ` AND c.cost_nature = ?`;
      params.push(costNature);
    }

    if (fromDate) {
      sql += ` AND c.expense_date >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND c.expense_date <= ?`;
      params.push(toDate);
    }

    sql += ` ORDER BY c.expense_date DESC, c.created_at DESC`;

    const costs = await query(sql, params);

    let totalGeneral = 0;
    let totalImpuestos = 0;
    costs.forEach((c) => {
      totalGeneral += c.total_amount || 0;
      totalImpuestos += c.tax_amount || 0;
    });

    return NextResponse.json({
      success: true,
      count: costs.length,
      totals: {
        totalGeneral: Math.round(totalGeneral * 100) / 100,
        totalImpuestos: Math.round(totalImpuestos * 100) / 100,
      },
      costs,
    });
  } catch (error: any) {
    console.error('Error al consultar costos:', error);
    return NextResponse.json({ error: 'Error al consultar costos.' }, { status: 500 });
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
      itemId,
      productId,
      digitalServiceId,
      costNature,
      concept,
      amount,
      taxAmount = 0,
      discountAmount = 0,
      currency = 'GTQ',
      exchangeRate = 1.0,
      expenseDate = new Date().toISOString().split('T')[0],
      requestingDepartmentId,
      originatingDepartmentId,
      chargedDepartmentId,
      supplier,
      invoiceNumber,
      purchaseOrder,
      warrantyDocumentUrl,
      invoiceDocumentUrl,
      invoiceFileData,
      invoiceFileName,
      warrantyFileData,
      warrantyFileName,
      insuranceFileData,
      insuranceFileName,
      warrantyExpiration,
      costCenter,
      status = 'CONFIRMADO',
      notes,
    } = body;

    const baseAmount = parseFloat(amount);
    const tax = parseFloat(taxAmount) || 0;
    const discount = parseFloat(discountAmount) || 0;

    if (!concept || isNaN(baseAmount) || !costNature) {
      return NextResponse.json(
        { error: 'Concepto, importe y naturaleza de costo son obligatorios.' },
        { status: 400 }
      );
    }

    const totalAmount = Math.round((baseAmount + tax - discount) * 100) / 100;
    const costId = `cst-${Date.now()}`;

    await run(
      `INSERT INTO cost_records (
        id, item_id, product_id, digital_service_id, cost_nature, concept,
        amount, tax_amount, discount_amount, total_amount, currency, exchange_rate,
        expense_date, requesting_department_id, originating_department_id,
        charged_department_id, supplier, invoice_number, purchase_order,
        warranty_document_url, invoice_document_url,
        invoice_file_data, invoice_file_name,
        warranty_file_data, warranty_file_name,
        insurance_file_data, insurance_file_name,
        cost_center, status, notes, recorded_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        costId,
        itemId || null,
        productId || null,
        digitalServiceId || null,
        costNature,
        concept.trim(),
        baseAmount,
        tax,
        discount,
        totalAmount,
        currency,
        parseFloat(exchangeRate) || 1.0,
        expenseDate,
        requestingDepartmentId || null,
        originatingDepartmentId || null,
        chargedDepartmentId || null,
        supplier?.trim() || null,
        invoiceNumber?.trim() || null,
        purchaseOrder?.trim() || null,
        warrantyDocumentUrl || null,
        invoiceDocumentUrl || null,
        invoiceFileData || null,
        invoiceFileName || null,
        warrantyFileData || null,
        warrantyFileName || null,
        insuranceFileData || null,
        insuranceFileName || null,
        costCenter?.trim() || null,
        status,
        notes?.trim() || null,
        user.id,
      ]
    );

    // Si está vinculado a un inventario físico, actualizar también el ítem
    if (itemId) {
      await run(
        `UPDATE inventory_items SET
          purchase_price = COALESCE(?, purchase_price),
          invoice_number = COALESCE(?, invoice_number),
          purchase_order = COALESCE(?, purchase_order),
          warranty_expiration = COALESCE(?, warranty_expiration),
          warranty_document_url = COALESCE(?, warranty_document_url),
          invoice_document_url = COALESCE(?, invoice_document_url)
         WHERE id = ?`,
        [
          baseAmount,
          invoiceNumber || null,
          purchaseOrder || null,
          warrantyExpiration || null,
          warrantyFileData || warrantyDocumentUrl || null,
          invoiceFileData || invoiceDocumentUrl || null,
          itemId,
        ]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'REGISTRAR_COSTO',
      module: 'COSTOS',
      entityId: costId,
      entityName: concept,
      reason: `Registro de costo por Q${totalAmount}`,
    });

    return NextResponse.json({ success: true, id: costId, totalAmount });
  } catch (error: any) {
    console.error('Error al registrar costo:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar costo.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      action, // 'UPDATE_INVENTORY_COST', 'UPDATE_COST_RECORD'
      itemId,
      costId,
      purchasePrice,
      invoiceNumber,
      purchaseOrder,
      warrantyExpiration,
      warrantyDocumentUrl,
      invoiceDocumentUrl,
      invoiceFileData,
      invoiceFileName,
      warrantyFileData,
      warrantyFileName,
      insuranceFileData,
      insuranceFileName,
      supplier,
      notes,
    } = body;

    if (action === 'UPDATE_COST_RECORD' && costId) {
      const existing = await queryOne<any>(`SELECT * FROM cost_records WHERE id = ?`, [costId]);
      if (!existing) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

      await run(
        `UPDATE cost_records SET
          invoice_number = COALESCE(?, invoice_number),
          purchase_order = COALESCE(?, purchase_order),
          supplier = COALESCE(?, supplier),
          invoice_document_url = COALESCE(?, invoice_document_url),
          warranty_document_url = COALESCE(?, warranty_document_url),
          invoice_file_data = COALESCE(?, invoice_file_data),
          invoice_file_name = COALESCE(?, invoice_file_name),
          warranty_file_data = COALESCE(?, warranty_file_data),
          warranty_file_name = COALESCE(?, warranty_file_name),
          insurance_file_data = COALESCE(?, insurance_file_data),
          insurance_file_name = COALESCE(?, insurance_file_name),
          notes = COALESCE(?, notes)
         WHERE id = ?`,
        [
          invoiceNumber !== undefined ? invoiceNumber : null,
          purchaseOrder !== undefined ? purchaseOrder : null,
          supplier !== undefined ? supplier : null,
          invoiceDocumentUrl !== undefined ? invoiceDocumentUrl : null,
          warrantyDocumentUrl !== undefined ? warrantyDocumentUrl : null,
          invoiceFileData !== undefined ? invoiceFileData : null,
          invoiceFileName !== undefined ? invoiceFileName : null,
          warrantyFileData !== undefined ? warrantyFileData : null,
          warrantyFileName !== undefined ? warrantyFileName : null,
          insuranceFileData !== undefined ? insuranceFileData : null,
          insuranceFileName !== undefined ? insuranceFileName : null,
          notes !== undefined ? notes : null,
          costId,
        ]
      );

      if (existing.item_id) {
        await run(
          `UPDATE inventory_items SET
            invoice_number = COALESCE(?, invoice_number),
            purchase_order = COALESCE(?, purchase_order),
            warranty_expiration = COALESCE(?, warranty_expiration),
            warranty_document_url = COALESCE(?, warranty_document_url),
            invoice_document_url = COALESCE(?, invoice_document_url)
           WHERE id = ?`,
          [
            invoiceNumber || null,
            purchaseOrder || null,
            warrantyExpiration || null,
            warrantyFileData || warrantyDocumentUrl || null,
            invoiceFileData || invoiceDocumentUrl || null,
            existing.item_id,
          ]
        );
      }

      const updated = await queryOne<any>(
        `SELECT c.*,
          d_chg.name as charged_dept_name,
          i.permanent_code as item_permanent_code,
          i.brand as item_brand,
          i.model as item_model,
          i.serial_number as item_serial_number,
          i.warranty_document_url as item_warranty_url,
          i.warranty_expiration as item_warranty_expiration,
          i.invoice_document_url as item_invoice_url
         FROM cost_records c
         LEFT JOIN departments d_chg ON c.charged_department_id = d_chg.id
         LEFT JOIN inventory_items i ON c.item_id = i.id
         WHERE c.id = ?`,
        [costId]
      );

      return NextResponse.json({ success: true, cost: updated });
    }

    // Actualizar costo y documentos de un ítem de inventario
    if (action === 'UPDATE_INVENTORY_COST' && itemId) {
      await run(
        `UPDATE inventory_items SET
          purchase_price = ?,
          invoice_number = ?,
          purchase_order = ?,
          warranty_expiration = ?,
          warranty_document_url = ?,
          invoice_document_url = ?,
          supplier = ?
         WHERE id = ?`,
        [
          Number(purchasePrice) || 0,
          invoiceNumber || null,
          purchaseOrder || null,
          warrantyExpiration || null,
          warrantyFileData || warrantyDocumentUrl || null,
          invoiceFileData || invoiceDocumentUrl || null,
          supplier || null,
          itemId,
        ]
      );

      const itemInfo = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
      const existingCost = await queryOne<any>(`SELECT id FROM cost_records WHERE item_id = ? LIMIT 1`, [itemId]);

      if (existingCost) {
        await run(
          `UPDATE cost_records SET
            amount = ?,
            total_amount = ?,
            invoice_number = ?,
            purchase_order = ?,
            supplier = ?,
            warranty_document_url = COALESCE(?, warranty_document_url),
            invoice_document_url = COALESCE(?, invoice_document_url),
            invoice_file_data = COALESCE(?, invoice_file_data),
            invoice_file_name = COALESCE(?, invoice_file_name),
            warranty_file_data = COALESCE(?, warranty_file_data),
            warranty_file_name = COALESCE(?, warranty_file_name),
            insurance_file_data = COALESCE(?, insurance_file_data),
            insurance_file_name = COALESCE(?, insurance_file_name)
           WHERE id = ?`,
          [
            Number(purchasePrice) || 0,
            Number(purchasePrice) || 0,
            invoiceNumber || null,
            purchaseOrder || null,
            supplier || null,
            warrantyDocumentUrl || null,
            invoiceDocumentUrl || null,
            invoiceFileData || null,
            invoiceFileName || null,
            warrantyFileData || null,
            warrantyFileName || null,
            insuranceFileData || null,
            insuranceFileName || null,
            existingCost.id,
          ]
        );
      } else if (itemInfo) {
        const newCostId = `cst-${Date.now()}`;
        await run(
          `INSERT INTO cost_records (
            id, item_id, product_id, cost_nature, concept,
            amount, tax_amount, discount_amount, total_amount, currency, exchange_rate,
            expense_date, charged_department_id, supplier, invoice_number, purchase_order,
            warranty_document_url, invoice_document_url,
            invoice_file_data, invoice_file_name,
            warranty_file_data, warranty_file_name,
            insurance_file_data, insurance_file_name,
            status, recorded_by_user_id
          ) VALUES (?, ?, ?, 'ADQUISICION', ?, ?, 0, 0, ?, 'GTQ', 1.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADO', ?)`,
          [
            newCostId,
            itemId,
            itemInfo.product_id || null,
            `Adquisición ${itemInfo.brand || ''} ${itemInfo.model || ''} (${itemInfo.permanent_code})`.trim(),
            Number(purchasePrice) || 0,
            Number(purchasePrice) || 0,
            new Date().toISOString().split('T')[0],
            itemInfo.current_department_id || null,
            supplier || null,
            invoiceNumber || null,
            purchaseOrder || null,
            warrantyDocumentUrl || null,
            invoiceDocumentUrl || null,
            invoiceFileData || null,
            invoiceFileName || null,
            warrantyFileData || null,
            warrantyFileName || null,
            insuranceFileData || null,
            insuranceFileName || null,
            user.id,
          ]
        );
      }

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'ACTUALIZAR_FACTURA_INVENTARIO',
        module: 'COSTOS',
        entityId: itemId,
        entityName: invoiceNumber || 'Factura/Garantía',
        reason: 'Actualización de datos de factura, garantía, aseguranza y costo de activo',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al actualizar costos:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}
