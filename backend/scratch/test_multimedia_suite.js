const { isPrivateIp, validateSafeUrl, normalizeBase64 } = require('../dist/utils/ssrf.util');

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DE SEGURIDAD Y MULTIMEDIA API');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS]: ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL]: ${message}`);
      failed++;
    }
  }

  // --- 1. PRUEBAS DE SEGURIDAD SSRF ---
  console.log('🔒 1. Evaluando Detección de IPs Privadas (isPrivateIp)...');
  assert(isPrivateIp('127.0.0.1') === true, '127.0.0.1 detectada como privada (Loopback)');
  assert(isPrivateIp('10.0.1.50') === true, '10.0.1.50 detectada como privada (RFC 1918)');
  assert(isPrivateIp('192.168.1.1') === true, '192.168.1.1 detectada como privada (RFC 1918)');
  assert(isPrivateIp('172.20.0.5') === true, '172.20.0.5 detectada como privada (RFC 1918)');
  assert(isPrivateIp('169.254.169.254') === true, '169.254.169.254 detectada como Cloud Metadata');
  assert(isPrivateIp('::1') === true, '::1 detectada como IPv6 Loopback');
  assert(isPrivateIp('8.8.8.8') === false, '8.8.8.8 identificada como IP pública legítima');
  assert(isPrivateIp('1.1.1.1') === false, '1.1.1.1 identificada como IP pública legítima');

  console.log('\n🔒 2. Evaluando Validación Anti-SSRF de URLs (validateSafeUrl)...');
  const checkLocalhost = await validateSafeUrl('http://localhost:3000/secret');
  assert(checkLocalhost.safe === false, 'Bloqueada URL con hostname localhost');

  const checkLoopback = await validateSafeUrl('http://127.0.0.1:5432/db');
  assert(checkLoopback.safe === false, 'Bloqueada URL con IP 127.0.0.1');

  const checkMetadata = await validateSafeUrl('http://169.254.169.254/latest/meta-data');
  assert(checkMetadata.safe === false, 'Bloqueada URL de Metadata Cloud 169.254.169.254');

  const checkRailwayInternal = await validateSafeUrl('http://postgres.railway.internal:5432');
  assert(checkRailwayInternal.safe === false, 'Bloqueada URL interna *.railway.internal');

  const checkPrivateRange = await validateSafeUrl('http://192.168.0.100/config');
  assert(checkPrivateRange.safe === false, 'Bloqueada URL con IP de subred local 192.168.*');

  const checkNonHttp = await validateSafeUrl('file:///etc/passwd');
  assert(checkNonHttp.safe === false, 'Bloqueado protocolo arbitrario file://');

  const checkSafePublic = await validateSafeUrl('https://images.unsplash.com/photo-1579202673506-ca3ce28943ef');
  assert(checkSafePublic.safe === true, 'Permitida URL pública legítima de imagen en CDN');

  // --- 2. PRUEBAS DE NORMALIZACIÓN BASE64 ---
  console.log('\n📦 3. Evaluando Sanitización y Extracción de Base64...');
  const sampleDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const cleanBase64 = normalizeBase64(sampleDataUri);
  assert(!cleanBase64.startsWith('data:'), 'Prefijo Data URI removido con éxito');
  assert(cleanBase64.startsWith('iVBORw0KGgo'), 'Contenido Base64 puro preservado intacto');

  const directBase64 = 'aGVsbG8gd29ybGQ=';
  assert(normalizeBase64(directBase64) === 'aGVsbG8gd29ybGQ=', 'Base64 puro sin prefijo permanece inalterado');

  console.log('\n📊 ========================================================');
  console.log(`📊 RESULTADOS TOTALES: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log('📊 ========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error fatal en tests:', err);
  process.exit(1);
});
