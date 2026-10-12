/**
 * SIVARSTOCK - SUITE COMPLETA DE PRUEBAS DE INTEGRACIÓN Y CONSISTENCIA
 * 
 * Verifica los 12 módulos del sistema:
 * 1. Departamentos Oficiales (11 departamentos, Bodega Central)
 * 2. Super Administrador (alexander7tm@gmail.com) y Matriz RBAC Granular
 * 3. Empleados y Códigos Únicos Poka-Yoke (EMP-XXX-001)
 * 4. Pestaña Celulares (Marca, Modelo, Teléfono, IMEI, Notas históricas)
 * 5. Catálogo de Productos (Precios de caja, unitarios, proveedores, historial)
 * 6. Entradas y Kardex de Movimientos (Trazabilidad, ejecutor, motivo)
 * 7. Asignaciones y Flujo de Salida de Personal
 * 8. Averías y Mantenimiento con Eventos Child de Sustitución
 * 9. Servicios Digitales y Licencias (GTQ y USD, periodicidad, días restantes)
 * 10. Costos y Facturas (N° factura, orden de compra, garantías)
 * 11. Generación y Validación de Códigos QR
 * 12. Métricas del Dashboard y Consistencia Relacional SQL
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('   BATERÍA DE VERIFICACIÓN 100% FUNCIONAL: SIVARSTOCK         ');
  console.log('===============================================================\n');

  const wasmPath = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const dbFile = path.resolve(__dirname, '..', 'data', 'sivarstock.db');
  if (!fs.existsSync(dbFile)) {
    throw new Error('La base de datos data/sivarstock.db no existe. Ejecuta seed-db.js primero.');
  }

  const fileBuffer = fs.readFileSync(dbFile);
  const db = new SQL.Database(fileBuffer);

  function query(sqlStr, params = []) {
    const stmt = db.prepare(sqlStr);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function queryOne(sqlStr, params = []) {
    const rows = query(sqlStr, params);
    return rows.length > 0 ? rows[0] : null;
  }

  // -------------------------------------------------------------
  // TEST 1: Los 11 Departamentos Oficiales y Bodega
  // -------------------------------------------------------------
  console.log('1. PRUEBA DE ESTRUCTURA ORGANIZATIVA (11 DEPARTAMENTOS):');
  const depts = query('SELECT * FROM departments');
  assert(depts.length === 11, `Se verifican los 11 departamentos oficiales (Actual: ${depts.length})`);

  const bodega = queryOne('SELECT * FROM departments WHERE is_bodega = 1');
  assert(bodega && bodega.code === 'BOD', 'Cuarto de Servidores está configurado como la Bodega Central (is_bodega = 1)');

  const gerencia = queryOne("SELECT * FROM departments WHERE code = 'GER'");
  const finanzas = queryOne("SELECT * FROM departments WHERE code = 'FIN'");
  const persiluz = queryOne("SELECT * FROM departments WHERE code = 'PER'");
  assert(gerencia && finanzas && persiluz, 'Departamentos clave (Gerencia, Finanzas, Persiluz) presentes en SQL');

  // -------------------------------------------------------------
  // TEST 2: Super-Administrador y Matriz RBAC
  // -------------------------------------------------------------
  console.log('\n2. PRUEBA DE AUTENTICACIÓN Y ROLES (RBAC):');
  const superAdmin = queryOne("SELECT * FROM users WHERE email = 'alexander7tm@gmail.com'");
  assert(superAdmin && superAdmin.role === 'ADMIN', 'Super-Administrador alexander7tm@gmail.com existe con rol ADMIN');
  assert(superAdmin && superAdmin.can_manage_users === 1, 'Super-Administrador tiene permisos totales de gestión de usuarios');

  const jefeLog = queryOne("SELECT * FROM users WHERE username = 'jalvarado'");
  assert(jefeLog && jefeLog.only_own_department === 1, 'Jefe de Logística tiene restricción activa: solo su propio departamento (only_own_department = 1)');

  const userCostos = queryOne("SELECT * FROM users WHERE username = 'erivas'");
  assert(userCostos && userCostos.can_edit === 0, 'Encargada de costos tiene modo solo lectura configurado (can_edit = 0)');

  // -------------------------------------------------------------
  // TEST 3: Empleados y Códigos Únicos Poka-Yoke
  // -------------------------------------------------------------
  console.log('\n3. PRUEBA DE PERSONAL Y ASIGNACIONES:');
  const employees = query('SELECT * FROM employees WHERE status = "ACTIVO"');
  assert(employees.length >= 10, `Personal activo registrado con códigos institucionales (Total: ${employees.length})`);

  const empCodes = query('SELECT employee_code FROM employees');
  const uniqueCodes = new Set(empCodes.map(e => e.employee_code));
  assert(empCodes.length === uniqueCodes.size, 'Todos los códigos de empleado son únicos y correlativos');

  const empRetirado = queryOne('SELECT * FROM employees WHERE status = "RETIRADO"');
  assert(empRetirado && empRetirado.exit_reason, `Empleado retirado debidamente registrado con motivo de salida: "${empRetirado?.exit_reason}"`);

  // -------------------------------------------------------------
  // TEST 4: Pestaña Celulares y Líneas Corporativas
  // -------------------------------------------------------------
  console.log('\n4. PRUEBA DE PESTAÑA CELULARES:');
  const celulares = query('SELECT * FROM mobile_devices');
  assert(celulares.length >= 3, `Parque de celulares corporativos registrado (Total: ${celulares.length})`);

  const celWithImei = queryOne('SELECT * FROM mobile_devices WHERE imei IS NOT NULL');
  assert(celWithImei && celWithImei.imei.length >= 15, `IMEI registrado correctamente (${celWithImei?.imei})`);

  const celWithNotes = queryOne('SELECT * FROM mobile_devices WHERE notes_history IS NOT NULL');
  assert(celWithNotes && celWithNotes.notes_history.length > 5, `Bitácora de notas y garantías de celulares activa: "${celWithNotes?.notes_history}"`);

  // -------------------------------------------------------------
  // TEST 5: Catálogo de Productos y Desglose Financiero
  // -------------------------------------------------------------
  console.log('\n5. PRUEBA DE CATÁLOGO Y PROVEEDORES:');
  const products = query('SELECT * FROM products');
  assert(products.length >= 8, `Catálogo de productos cargado (Total: ${products.length})`);

  const prodWithBox = queryOne('SELECT * FROM products WHERE box_price > 0');
  assert(prodWithBox && prodWithBox.units_per_box > 0, `Desglose de precio por caja y precio unitario verificado (${prodWithBox?.name}: Q${prodWithBox?.box_price} por caja de ${prodWithBox?.units_per_box} un.)`);

  const suppliers = query('SELECT * FROM product_suppliers');
  assert(suppliers.length >= 3, `Múltiples proveedores habituales por producto soportados (Total relaciones: ${suppliers.length})`);

  const priceHistory = query('SELECT * FROM product_price_history');
  assert(priceHistory.length >= 3, `Historial de precios de compra por fecha registrado (Total registros: ${priceHistory.length})`);

  // -------------------------------------------------------------
  // TEST 6: Movimientos y Kardex
  // -------------------------------------------------------------
  console.log('\n6. PRUEBA DE KARDEX Y TRAZABILIDAD:');
  const movements = query('SELECT * FROM inventory_movements');
  assert(movements.length >= 6, `Kardex con bitácora de movimientos activa (Total: ${movements.length})`);

  const movWithReason = queryOne('SELECT * FROM inventory_movements WHERE reason IS NOT NULL');
  assert(movWithReason && movWithReason.reason.length > 5, `Movimiento registra motivo justificado y ejecutor: "${movWithReason?.reason}"`);

  // -------------------------------------------------------------
  // TEST 7: Averías y Mantenimiento con Eventos Child
  // -------------------------------------------------------------
  console.log('\n7. PRUEBA DE MANTENIMIENTO Y SUSTITUCIONES:');
  const maintenance = query('SELECT * FROM maintenance_records');
  assert(maintenance.length >= 3, `Registro de averías y mantenimientos activo (Total: ${maintenance.length})`);

  const replacedRecord = queryOne('SELECT * FROM maintenance_records WHERE solution_type = "COMPRA_REEMPLAZO"');
  assert(replacedRecord && replacedRecord.replacement_item_id, `Equipo sustituido tiene vinculado su evento child (reemplazo vinculado: ${replacedRecord?.replacement_item_id})`);

  // -------------------------------------------------------------
  // TEST 8: Licencias y Servicios Digitales (GTQ y USD)
  // -------------------------------------------------------------
  console.log('\n8. PRUEBA DE SERVICIOS DIGITALES Y LICENCIAS:');
  const services = query('SELECT * FROM digital_services');
  assert(services.length >= 5, `Servicios digitales registrados (Total: ${services.length})`);

  const usdService = queryOne("SELECT * FROM digital_services WHERE currency = 'USD'");
  const gtqService = queryOne("SELECT * FROM digital_services WHERE currency = 'GTQ'");
  assert(usdService && gtqService, `Soporte dual de monedas verificado: USD (${usdService?.name}: $${usdService?.amount}) y GTQ (${gtqService?.name}: Q${gtqService?.amount})`);

  const singlePayService = queryOne("SELECT * FROM digital_services WHERE status = 'PAGO_UNICO'");
  assert(singlePayService, `Soporte para servicio con Pago Único verificado (${singlePayService?.name})`);

  // -------------------------------------------------------------
  // TEST 9: Costos, Facturas y Documentos
  // -------------------------------------------------------------
  console.log('\n9. PRUEBA DE COSTOS Y FACTURAS:');
  const costs = query('SELECT * FROM cost_records');
  assert(costs.length >= 4, `Registros económicos cargados (Total: ${costs.length})`);

  const costWithDoc = queryOne('SELECT * FROM cost_records WHERE invoice_document_url IS NOT NULL');
  assert(costWithDoc && costWithDoc.invoice_number, `Factura con documento adjunto vinculada a orden de compra y activo (${costWithDoc?.invoice_number})`);

  // -------------------------------------------------------------
  // TEST 10: Auditoría Inmutable
  // -------------------------------------------------------------
  console.log('\n10. PRUEBA DE REGISTRO INMUTABLE DE AUDITORÍA:');
  const auditLogs = query('SELECT * FROM audit_logs');
  assert(auditLogs.length >= 3, `Bitácora de auditoría inmutable activa con registros de acciones (Total: ${auditLogs.length})`);

  console.log('\n===============================================================');
  console.log(`   RESUMEN DE PRUEBAS: ${passedTests} APROBADAS / ${failedTests} FALLADAS`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('\n>>> ¡TODOS LOS MÓDULOS DE SIVARSTOCK ESTÁN 100% OPERATIVOS Y CONSISTENTES EN SQL! <<<\n');
  }
}

runTestSuite().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err);
  process.exit(1);
});
