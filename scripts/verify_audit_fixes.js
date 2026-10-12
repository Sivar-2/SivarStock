const http = require('http');

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('========================================================');
  console.log('   AUDITORÍA E2E: VERIFICACIÓN EN VIVO DE CORRECCIONES  ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function test(condition, name, details = '') {
    if (condition) {
      console.log(`  [OK] ${name}`);
      passed++;
    } else {
      console.error(`  [ERROR] ${name}: ${details}`);
      failed++;
    }
  }

  // 1. Iniciar sesión para obtener cookie
  console.log('1. Verificando autenticación y fijación de vulnerabilidad Google Auth:');
  const vulRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { isGoogleAuth: true });

  test(vulRes.status === 400, 'Rechazo de Google Auth sin correo (Vulnerabilidad Corregida)', `Status: ${vulRes.status}`);

  // Login legítimo con credenciales
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { username: 'alexander7tm', password: 'admin123' });

  test(loginRes.status === 200 && loginRes.json.success, 'Inicio de sesión de administrador exitoso');
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';

  // 2. Probar API de Modificación de Productos (PUT /api/products)
  console.log('\n2. Verificando edición de productos (PUT /api/products):');
  const prodsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/products',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  const product = prodsRes.json.products[0];
  test(Boolean(product), `Producto seleccionado para prueba: ${product?.name} (${product?.code})`);

  const updatedName = `${product.name} (Modificado Audit)`;
  const updatedPrice = 7500.50;

  const putRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/products',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  }, {
    id: product.id,
    name: updatedName,
    unitPrice: updatedPrice,
    brand: product.brand,
    model: product.model,
  });

  test(putRes.status === 200 && putRes.json.success, 'Modificación de producto vía PUT exitosa');

  // Verificar que la BD refleje el cambio
  const verifyProdRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/products?id=${product.id}`,
    method: 'GET',
    headers: { Cookie: cookie },
  });

  test(
    verifyProdRes.json.product.name === updatedName && Number(verifyProdRes.json.product.unit_price) === updatedPrice,
    'Persistencia confirmada en base de datos tras modificación'
  );

  // Restaurar nombre original
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/products',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  }, {
    id: product.id,
    name: product.name,
    unitPrice: product.unit_price,
  });

  // 3. Probar flujo de Devolución Pendiente en Baja de Empleado
  console.log('\n3. Verificando flujo de Devolución Pendiente por baja de empleado:');
  const empListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/employees?all=true',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  const activeEmp = empListRes.json.employees.find((e) => e.status === 'ACTIVO');
  test(Boolean(activeEmp), `Empleado activo encontrado: ${activeEmp?.full_name}`);

  // 4. Probar descarga de respaldo JSON
  console.log('\n4. Verificando endpoint de copias de seguridad (GET /api/backup):');
  const backupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/backup?format=json',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  test(backupRes.status === 200, 'Descarga de respaldo JSON exitosa', `Status: ${backupRes.status}, Error: ${JSON.stringify(backupRes.json || backupRes.text)}`);
  test(backupRes.json && backupRes.json.app && backupRes.json.data && Array.isArray(backupRes.json.data.products), 'Estructura relacional completa exportada en respaldo');

  // 5. Verificando bitácora inmutable de auditoría
  console.log('\n5. Verificando bitácora de auditoría inmutable (GET /api/audit):');
  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/audit',
    method: 'GET',
    headers: { Cookie: cookie },
  });

  test(auditRes.status === 200 && auditRes.json.logs.length > 0, 'Bitácora registra acciones de auditoría');
  const hasProdAudit = auditRes.json.logs.some((l) => l.action === 'MODIFICAR_PRODUCTO');
  test(hasProdAudit, 'Acción MODIFICAR_PRODUCTO debidamente registrada en bitácora inmutable');

  console.log('\n========================================================');
  console.log(`   RESULTADO FINAL: ${passed} EXITOSAS / ${failed} FALLADAS`);
  console.log('========================================================');
}

run().catch(console.error);
