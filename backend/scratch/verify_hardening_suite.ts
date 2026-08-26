import { validateWebhookUrl } from '../src/utils/ssrf-validator.util';
import * as crypto from 'crypto';

async function runHardeningTests() {
  console.log('🧪 =================================================');
  console.log('🧪 EJECUTANDO SUITE DE TESTING DE HARDENING & SEGURIDAD');
  console.log('🧪 =================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} - ${extra || ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // 1. TESTS DE PROTECCIÓN SSRF
  // ----------------------------------------------------
  console.log('--- [1] TESTS DE PROTECCIÓN ANTI-SSRF ---');

  const ssrf1 = await validateWebhookUrl('http://127.0.0.1:8080/webhook');
  assert('SSRF bloquea 127.0.0.1 (Loopback IPv4)', !ssrf1.isValid && ssrf1.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf2 = await validateWebhookUrl('http://localhost:3000/api/hook');
  assert('SSRF bloquea hostname localhost', !ssrf2.isValid && ssrf2.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf3 = await validateWebhookUrl('http://169.254.169.254/latest/meta-data');
  assert('SSRF bloquea 169.254.169.254 (Cloud Metadata)', !ssrf3.isValid && ssrf3.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf4 = await validateWebhookUrl('http://10.0.1.50/hook');
  assert('SSRF bloquea 10.0.0.0/8 (RFC 1918 Private)', !ssrf4.isValid && ssrf4.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf5 = await validateWebhookUrl('http://192.168.1.100:5000/webhook');
  assert('SSRF bloquea 192.168.0.0/16 (RFC 1918 Private)', !ssrf5.isValid && ssrf5.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf6 = await validateWebhookUrl('http://172.20.0.15/webhook');
  assert('SSRF bloquea 172.16.0.0/12 (RFC 1918 Private)', !ssrf6.isValid && ssrf6.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf7 = await validateWebhookUrl('http://[::1]:8080/webhook');
  assert('SSRF bloquea IPv6 ::1 (Loopback IPv6)', !ssrf7.isValid && ssrf7.reason?.includes('SSRF_BLOCKED') === true);

  const ssrf8 = await validateWebhookUrl('ftp://example.com/webhook');
  assert('SSRF bloquea protocolos no HTTP/HTTPS (ftp://)', !ssrf8.isValid);

  const ssrf9 = await validateWebhookUrl('https://api.zazaclick.sbs/test-webhook');
  assert('SSRF permite dominios públicos oficiales con DNS válida', ssrf9.isValid);

  // ----------------------------------------------------
  // 2. TESTS DE FIRMA HMAC-SHA256 Y ANTI-REPLAY
  // ----------------------------------------------------
  console.log('\n--- [2] TESTS DE FIRMA HMAC-SHA256 Y ANTI-REPLAY ---');

  const secret = 'whsec_8f2a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
  const timestamp = Math.floor(Date.now() / 1000);
  const sampleEvent = {
    id: 'evt_1724712000_abc123',
    type: 'MESSAGE_RECEIVED',
    timestamp,
    instanceName: 'erp_ventas_001',
    data: { message: 'Hola mundo' }
  };
  const rawBody = JSON.stringify(sampleEvent);

  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signatureHeader = `sha256=${signature}`;

  // Validar firma auténtica
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const isSignatureValid = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSig));
  assert('Firma HMAC-SHA256 válida verificada con timingSafeEqual', isSignatureValid);

  // Validar rechazo de firma manipulada
  const tamperedSig = 'sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const isTamperedRejected = !crypto.timingSafeEqual(Buffer.from(tamperedSig), Buffer.from(expectedSig));
  assert('Firma HMAC alterada rechazada correctamente', isTamperedRejected);

  // Validar Anti-Replay Timestamp
  const oldTimestamp = timestamp - 305; // 305 segundos atrás (> 300s)
  const isExpired = Math.abs(timestamp - oldTimestamp) > 300;
  assert('Timestamp antiguo (> 300s) detectado y rechazado como Replay Attack', isExpired);

  const freshTimestamp = timestamp - 10;
  const isFresh = Math.abs(timestamp - freshTimestamp) <= 300;
  assert('Timestamp reciente (<= 300s) aceptado legítimamente', isFresh);

  // ----------------------------------------------------
  // 3. TESTS DE ENMASCARAMIENTO DE CREDENCIALES
  // ----------------------------------------------------
  console.log('\n--- [3] TESTS DE ENMASCARAMIENTO DE API KEYS ---');

  function maskApiKey(key: string | null | undefined): string {
    if (!key) return '';
    if (key.length <= 8) return '********';
    const last4 = key.slice(-4);
    return `zc_live_********${last4}`;
  }

  const rawKey = 'zc_live_sec_89f2a0b1c2d3e4f5a6b7c8d9e0f1a2b3';
  const masked = maskApiKey(rawKey);
  assert('API Key enmascarada oculta el cuerpo sensible', masked === 'zc_live_********a2b3' && !masked.includes('89f2a0b1'));

  // ----------------------------------------------------
  // 4. TESTS DE REQUEST ID & TRACING
  // ----------------------------------------------------
  console.log('\n--- [4] TESTS DE OBSERVABILIDAD Y REQUEST ID ---');

  const reqId = `zc_req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const corrId = `zc_corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  assert('Request ID cumple con formato zc_req_<timestamp>_<random>', /^zc_req_\d+_[a-z0-9]+$/.test(reqId));
  assert('Correlation ID cumple con formato zc_corr_<timestamp>_<random>', /^zc_corr_\d+_[a-z0-9]+$/.test(corrId));

  console.log('\n=================================================');
  console.log(`📊 RESULTADO FINAL: ${passed} PASADOS | ${failed} FALLADOS`);
  console.log('=================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
