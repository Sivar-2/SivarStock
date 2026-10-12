const http = require('http');

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function testPendingReturn() {
  console.log('--- TEST: FLUJO DE DEVOLUCIÓN PENDIENTE EN BAJA DE EMPLEADO ---');

  // 1. Login
  const loginRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'alexander7tm', password: 'admin123' });

  const cookie = loginRes.headers && loginRes.headers['set-cookie'] 
    ? loginRes.headers['set-cookie'][0].split(';')[0] 
    : '';

  // 2. Crear empleado temporal
  const empRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/employees', method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, {
    fullName: 'Empleado Auditoría Temporal',
    departmentId: 'dept-log',
    email: 'auditor.temp@persiluz.com',
  });
  const empId = empRes.json?.employeeId;
  const empCode = empRes.json?.employeeCode;
  console.log('1. Empleado temporal creado:', empId, empCode);

  // 3. Asignar producto de Bodega al empleado
  const asgRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/products', method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, {
    action: 'ASSIGN_TO_EMPLOYEE',
    productId: 'prod-cin-emb',
    employeeId: empId,
    quantity: 1,
    reason: 'Asignación de prueba para validar flujo de baja'
  });
  console.log('2. Asignación directa creada:', asgRes.json?.success, asgRes.json?.message);

  // 4. Ejecutar BAJA del empleado
  const exitRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/employees', method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, {
    id: empId,
    action: 'EXIT',
    exitReason: 'Fin de contrato temporal auditado',
    exitDate: '2026-10-10'
  });
  console.log('3. Baja de empleado ejecutada:', exitRes.json?.message);

  // 5. Verificar estado en base de datos mediante API
  const asgListRes = await request({
    hostname: 'localhost', port: 3000, path: '/api/reports/query', method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie }
  }, { module: 'ASIGNACIONES' });
  
  const empAssignments = (asgListRes.json?.data || []).filter(a => a.employee_id === empId);
  console.log('4. Total asignaciones del empleado dado de baja encontradas:', empAssignments.length);

  const pending = empAssignments.every(a => a.status === 'DEVOLUCION_PENDIENTE');
  if (pending && empAssignments.length > 0) {
    console.log('  [PASS] ¡CORRECTO! Todas las asignaciones están en estado DEVOLUCION_PENDIENTE (no fueron marcadas como devueltas automáticamente).');
  } else {
    console.log('  [INFO] Asignaciones registradas con estado:', empAssignments.map(a => a.status));
  }
}

testPendingReturn().catch(console.error);
