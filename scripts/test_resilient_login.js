const http = require('http');

async function testEndpoint() {
  console.log('Probando endpoint /api/auth/login en el servidor local...');

  function makeRequest(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const req = http.request(
        {
          hostname: 'localhost',
          port: 3000,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
            } catch {
              resolve({ status: res.statusCode, body, headers: res.headers });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  try {
    // 1. Paso 1: TurcoSivar + 12345679
    console.log('\n1. Test Paso 1: Usuario TurcoSivar y clave 12345679:');
    const r1 = await makeRequest({ username: 'TurcoSivar', password: '12345679' });
    console.log('Status:', r1.status);
    console.log('Response:', r1.data);
    if ((r1.data.requirePin || r1.data.requiresPin) && r1.status === 200) {
      console.log('-> [PASS] Paso 1 solicita PIN con HTTP 200 OK');
    } else {
      console.error('-> [FAIL] Respuesta inesperada:', r1);
    }

    // 2. Paso 2: PIN 2801
    console.log('\n2. Test Paso 2: Enviar PIN 2801:');
    const r2 = await makeRequest({
      username: 'TurcoSivar',
      tempToken: r1.data.tempToken,
      pin: '2801',
    });
    console.log('Status:', r2.status);
    console.log('User:', r2.data.user);
    const cookie = r2.headers['set-cookie'];
    console.log('Set-Cookie presente:', Boolean(cookie));
    if (r2.data.success && r2.status === 200 && r2.data.user?.role === 'SUPER_ADMIN') {
      console.log('-> [PASS] Super Admin autenticado con sesión JWT y rol SUPER_ADMIN');
    } else {
      console.error('-> [FAIL] Falló validación de PIN');
    }

    // 3. Inicio Rápido solo con PIN 2801
    console.log('\n3. Test Inicio Rápido directo con PIN 2801:');
    const r3 = await makeRequest({ pin: '2801' });
    if (r3.data.success && r3.data.user?.username === 'TurcoSivar') {
      console.log('-> [PASS] Inicio rápido directo con PIN 2801 exitoso');
    } else {
      console.error('-> [FAIL] Inicio rápido falló:', r3);
    }

  } catch (err) {
    console.log('Servidor en localhost:3000 no accesible directamente desde este proceso o dev server no escuchando aún:', err.message);
  }
}

testEndpoint();
