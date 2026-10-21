const http = require('http');

async function testMovements() {
  console.log('Verificando acceso de TurcoSivar a /api/movements...');

  function request(options, data) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, body, headers: res.headers });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // 1. Iniciar sesión como TurcoSivar con PIN
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ username: 'TurcoSivar', pin: '2801' })
  );

  console.log('Login status:', loginRes.status);
  const cookie = loginRes.headers['set-cookie'];
  if (!cookie) {
    console.error('No se recibió cookie de sesión');
    process.exit(1);
  }
  const sessionCookie = cookie[0].split(';')[0];
  console.log('Cookie recibida:', sessionCookie.substring(0, 40) + '...');

  // 2. Probar GET /api/movements con la cookie
  const movRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/movements',
    method: 'GET',
    headers: {
      Cookie: sessionCookie,
    },
  });

  console.log('\nGET /api/movements status:', movRes.status);
  if (movRes.status === 200) {
    console.log('-> [PASS] ¡Acceso concedido a Entradas y Movimientos!');
    console.log('Total movimientos devueltos:', movRes.data?.movements?.length ?? 0);
  } else {
    console.error('-> [FAIL] Error al acceder a movimientos:', movRes.data);
    process.exit(1);
  }

  // 3. Probar GET /api/audit con la cookie
  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/audit',
    method: 'GET',
    headers: {
      Cookie: sessionCookie,
    },
  });

  console.log('\nGET /api/audit status:', auditRes.status);
  if (auditRes.status === 200) {
    console.log('-> [PASS] ¡Acceso concedido a Historial de Auditoría!');
  } else {
    console.error('-> [FAIL] Error al acceder a auditoría:', auditRes.data);
    process.exit(1);
  }

  // 4. Probar GET /api/backup con la cookie
  const backupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/backup?format=json',
    method: 'GET',
    headers: {
      Cookie: sessionCookie,
    },
  });

  console.log('\nGET /api/backup status:', backupRes.status);
  if (backupRes.status === 200) {
    console.log('-> [PASS] ¡Acceso concedido a Descarga de Copias de Seguridad!');
  } else {
    console.error('-> [FAIL] Error al acceder a backup:', backupRes.data);
    process.exit(1);
  }
}

testMovements().catch((err) => {
  console.error(err);
  process.exit(1);
});
