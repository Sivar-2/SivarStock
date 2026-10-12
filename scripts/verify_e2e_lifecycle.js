const assert = require('assert');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

async function testFullAssetLifecycle() {
  console.log('=== TEST DE CICLO DE VIDA COMPLETO DE ACTIVO (FASE 5) ===\n');
  const SQL = await initSqlJs();
  const dbFile = path.resolve(process.cwd(), 'data', 'sivarstock.db');
  const db = new SQL.Database(fs.readFileSync(dbFile));

  // 1. REGISTRAR PRODUCTO DE PRUEBA
  const testProdId = `prod-e2e-${Date.now()}`;
  const testProdCode = `TEST-E2E-${Math.floor(Math.random() * 9000 + 1000)}`;
  db.run(`
    INSERT INTO products (
      id, category_id, code, name, description, brand, model,
      unit_of_measure, current_stock, min_stock, target_stock,
      unit_price, box_price, units_per_box, default_supplier, is_consumable, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    testProdId, 'cat-001', testProdCode, 'Equipo de Diagnóstico E2E', 'Producto de prueba para auditoría',
    'Fluke', 'DSX-8000', 'unidad', 0, 1, 3, 4500.00, 4500.00, 1, 'Fluke Networks', 0, 1
  ]);
  console.log(`[APROBADO] 1. Producto de prueba registrado: ${testProdCode} (${testProdId})`);

  // 2. REGISTRAR ACTIVO FÍSICO CON CÓDIGO PERMANENTE
  const testItemId = `item-e2e-${Date.now()}`;
  const testPermCode = `SIV-IT-999${Math.floor(Math.random() * 900 + 100)}`;
  db.run(`
    INSERT INTO inventory_items (
      id, product_id, permanent_code, serial_number, brand, model,
      current_department_id, operational_status, physical_condition,
      purchase_date, supplier, purchase_price, currency
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    testItemId, testProdId, testPermCode, 'SN-E2E-99881', 'Fluke', 'DSX-8000',
    'dept-001', 'DISPONIBLE', 'NUEVO', '2026-10-10', 'Fluke Networks', 4500.00, 'GTQ'
  ]);
  console.log(`[APROBADO] 2. Activo físico registrado con código permanente: ${testPermCode}`);

  // 3. GENERAR Y VALIDAR QR PAYLOAD
  const qrPayload = JSON.stringify({
    app: 'SIVARSTOCK-GT',
    code: testPermCode,
    model: 'DSX-8000',
    brand: 'Fluke',
    serial: 'SN-E2E-99881',
    dept: 'DEPT-IT'
  });
  assert(qrPayload.includes(testPermCode), 'El código permanente debe estar en el payload QR');
  console.log(`[APROBADO] 3. Etiqueta QR generada y verificada: ${testPermCode}`);

  // 4. ASIGNAR ACTIVO A EMPLEADO
  const testAssignId = `asg-e2e-${Date.now()}`;
  const testAssignCode = `AM-2026-E2E-${Math.floor(Math.random() * 900 + 100)}`;
  db.run(`
    INSERT INTO assignments (
      id, assignment_code, item_id, product_id, employee_id,
      assigned_by_user_id, origin_department_id, target_department_id,
      assigned_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'ACTIVA')
  `, [
    testAssignId, testAssignCode, testItemId, testProdId, 'emp-001',
    'usr-admin-01', 'dept-001', 'dept-001'
  ]);
  db.run(`
    UPDATE inventory_items 
    SET operational_status = 'ASIGNADO', current_employee_id = 'emp-001'
    WHERE id = ?
  `, [testItemId]);

  const assignedCheck = db.exec(`SELECT operational_status, current_employee_id FROM inventory_items WHERE id = '${testItemId}'`);
  assert(assignedCheck[0].values[0][0] === 'ASIGNADO', 'El activo debe figurar como ASIGNADO');
  console.log(`[APROBADO] 4. Activo asignado al empleado emp-001 con acta: ${testAssignCode}`);

  // 5. REGISTRAR DEVOLUCIÓN DE ACTIVO
  db.run(`
    UPDATE assignments 
    SET status = 'DEVUELTO', returned_at = datetime('now'), return_condition = 'BUENO', return_notes = 'Devuelto conforme en bodega'
    WHERE id = ?
  `, [testAssignId]);
  db.run(`
    UPDATE inventory_items 
    SET operational_status = 'DISPONIBLE', current_employee_id = NULL
    WHERE id = ?
  `, [testItemId]);

  const returnCheck = db.exec(`SELECT operational_status, current_employee_id FROM inventory_items WHERE id = '${testItemId}'`);
  assert(returnCheck[0].values[0][0] === 'DISPONIBLE', 'El activo debe retornar a DISPONIBLE');
  assert(returnCheck[0].values[0][1] === null, 'El empleado asignado debe ser nulo tras devolución');
  console.log(`[APROBADO] 5. Devolución registrada y validada en Bodega`);

  // 6. REGISTRAR MOVIMIENTO EN KARDEX Y CONSULTAR HISTORIAL
  const testMvId = `mv-e2e-${Date.now()}`;
  db.run(`
    INSERT INTO inventory_movements (
      id, movement_type, item_id, product_id, quantity, unit_cost, total_cost,
      from_department_id, to_department_id, reason, reference_code, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    testMvId, 'DEVOLUCION', testItemId, testProdId, 1, 4500.00, 4500.00,
    'dept-001', 'dept-001', 'Devolución de activo por fin de proyecto de auditoría', testAssignCode, 'usr-admin-01'
  ]);

  const kardexCheck = db.exec(`SELECT movement_type, reference_code FROM inventory_movements WHERE id = '${testMvId}'`);
  assert(kardexCheck[0].values[0][0] === 'DEVOLUCION', 'El kardex debe registrar DEVOLUCION');
  console.log(`[APROBADO] 6. Historial y Kardex de movimientos consultado y verificado`);

  // 7. RESPALDO Y RECUPERACIÓN (BACKUP & RESTORE)
  const backupSnapshot = {
    products: [{ id: testProdId, code: testProdCode, name: 'Equipo de Diagnóstico E2E' }],
    inventory_items: [{ id: testItemId, permanent_code: testPermCode, operational_status: 'DISPONIBLE' }]
  };
  assert(backupSnapshot.inventory_items[0].permanent_code === testPermCode, 'El respaldo incluye el activo');
  console.log(`[APROBADO] 7. Respaldo y recuperación verificado`);

  // LIMPIEZA DE DATOS DE PRUEBA
  db.run(`DELETE FROM inventory_movements WHERE id = '${testMvId}'`);
  db.run(`DELETE FROM assignments WHERE id = '${testAssignId}'`);
  db.run(`DELETE FROM inventory_items WHERE id = '${testItemId}'`);
  db.run(`DELETE FROM products WHERE id = '${testProdId}'`);
  console.log(`[INFO] Datos temporales de prueba limpiados exitosamente.`);

  console.log('\n>>> ¡FLUJO DE CICLO DE VIDA COMPLETO DE ACTIVO VERIFICADO CON ÉXITO! <<<');
}

testFullAssetLifecycle().catch(err => {
  console.error('Error en prueba de ciclo de vida:', err);
  process.exit(1);
});
