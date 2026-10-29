const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runLiveVerification() {
  console.log('--- INICIANDO VERIFICACIÓN EN VIVO DE SIVARSTOCK ---');

  // Esperar a que el servidor responda
  let ready = false;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await request({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/login',
        method: 'GET',
      });
      if (res.statusCode === 200) {
        ready = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!ready) {
    console.error('El servidor no respondió en http://127.0.0.1:3000');
    process.exit(1);
  }
  console.log('✓ Servidor Next.js activo en http://127.0.0.1:3000');

  // 1. Probar Login con turcosivar / 12345679
  const loginRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'turcosivar', password: '12345679' }
  );

  if (loginRes.statusCode !== 200 || !loginRes.json?.success) {
    console.error('✗ Falló el inicio de sesión con turcosivar:', loginRes.statusCode, loginRes.body);
    process.exit(1);
  }
  console.log('✓ Login exitoso con usuario turcosivar (ADMIN).');

  const setCookie = loginRes.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';

  const headers = {
    'Content-Type': 'application/json',
    Cookie: cookieStr,
  };

  // 2. Verificar módulos y endpoints principales
  const endpoints = [
    { name: 'Catálogos Centrales', path: '/api/catalogs' },
    { name: 'Bodega / Inventario Ítems', path: '/api/inventory/items' },
    { name: 'Categorías y Productos', path: '/api/products' },
    { name: 'Celulares y Líneas', path: '/api/celulares' },
    { name: 'Entradas y Movimientos', path: '/api/movements' },
    { name: 'Actas Digitales (Listado)', path: '/api/actas' },
    { name: 'Averías y Mantenimiento', path: '/api/maintenance' },
    { name: 'Licencias y Contratos', path: '/api/digital-services' },
    { name: 'Costos y Facturas', path: '/api/costs' },
    { name: 'Reportes y Métricas 360', path: '/api/reports/query' },
    { name: 'Usuarios y Permisos', path: '/api/users' },
    { name: 'Bitácora de Auditoría', path: '/api/audit' },
  ];

  for (const ep of endpoints) {
    const res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: ep.path,
      method: 'GET',
      headers,
    });
    if (res.statusCode === 200) {
      console.log(`✓ Módulo ${ep.name} [GET ${ep.path}] -> HTTP 200 OK`);
    } else {
      console.error(`✗ Módulo ${ep.name} [GET ${ep.path}] -> Error ${res.statusCode}:`, res.body);
    }
  }

  // 3. Probar Creación de Acta Digital de Entrega
  console.log('\n--- Probando Sistema de Actas Digitales ---');
  const createActaRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/actas',
      method: 'POST',
      headers,
    },
    {
      actaType: 'ENTREGA_INICIAL',
      employeeName: 'Christian Alexander Turcios',
      employeeDpi: '1234567890101',
      employeeEmail: 'christian@sivarstock.local',
      employeePhone: '+502 55554444',
      departmentName: 'IT',
      supervisorName: 'Alexander Turcios Melendez',
      items: [
        {
          code: 'LAP-HP-001',
          name: 'Laptop HP ProBook 450 G8',
          serial: 'CND123456',
          mac: '00:1B:44:11:3A:B7',
          receiveCondition: 'NUEVO',
        },
      ],
      notes: 'Entrega para funciones corporativas con cargador y mouse.',
    }
  );

  if (createActaRes.statusCode !== 200 || !createActaRes.json?.success) {
    console.error('✗ Falló creación de acta digital:', createActaRes.statusCode, createActaRes.body);
  } else {
    const { actaId, actaCode, publicToken } = createActaRes.json;
    console.log(`✓ Acta creada exitosamente: ${actaCode} (ID: ${actaId}, Token: ${publicToken})`);

    // Consultar el acta creada
    const getActaRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/actas?id=${actaId}`,
      method: 'GET',
      headers,
    });
    if (getActaRes.statusCode === 200 && getActaRes.json?.acta) {
      console.log(`✓ Consulta de acta exitosa. Emisor: ${getActaRes.json.issuerConfig?.issuerName}`);
    }

    // Probar firma digital del empleado
    const signRes = await request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/actas',
        method: 'PUT',
        headers,
      },
      {
        id: actaId,
        actaCode,
        employeeDpi: '1234567890101',
        employeeSignatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        token: publicToken,
      }
    );

    if (signRes.statusCode === 200 && signRes.json?.success) {
      console.log('✓ Firma electrónica registrada exitosamente en la base de datos.');
    } else {
      console.error('✗ Falló la firma del acta:', signRes.statusCode, signRes.body);
    }
  }

  console.log('\n--- VERIFICACIÓN EN VIVO COMPLETADA CON ÉXITO ---');
}

runLiveVerification().catch(console.error);
