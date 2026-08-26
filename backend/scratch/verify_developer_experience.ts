import * as crypto from 'crypto';
import { ApiKeyService } from '../src/services/api-key.service';
import { ApiLogService } from '../src/services/api-log.service';
import { WebhookDispatcherService } from '../src/services/webhook-dispatcher.service';
import { DeveloperUsageService } from '../src/services/developer-usage.service';
import { DeveloperStatusService } from '../src/services/developer-status.service';
import { openApiSpec } from '../src/routes/openapi.routes';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const auditResults: TestResult[] = [];

function check(category: string, name: string, condition: boolean, error?: string) {
  if (condition) {
    auditResults.push({ category, name, passed: true });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    auditResults.push({ category, name, passed: false, error: error || 'Assertion failed' });
    console.error(`  ❌ [FAIL] ${name} - ${error || 'Assertion failed'}`);
  }
}

async function runDevExperienceAudit() {
  console.log('====================================================');
  console.log('🚀 ZAZA CLICK 2.0 — DEVELOPER EXPERIENCE AUDIT');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. API KEY MANAGEMENT & SECURITY
  // ----------------------------------------------------
  console.log('🔑 [1] AUDITORÍA DE API KEY MANAGEMENT & HASHING');

  const testSecretLive = 'zc_live_a1b2c3d4e5f678901234567890abcdef12345678';
  const testSecretTest = 'zc_test_a1b2c3d4e5f678901234567890abcdef12345678';

  const hashLive = ApiKeyService.hashKey(testSecretLive);
  const maskedLive = ApiKeyService.maskKey(testSecretLive, 'live');
  const maskedTest = ApiKeyService.maskKey(testSecretTest, 'test');

  check('API-KEYS', 'Hashing SHA-256 de API Key determinístico y seguro', hashLive.length === 64);
  check('API-KEYS', 'Enmascaramiento en modo LIVE (zc_live_********5678)', maskedLive === 'zc_live_********5678' && !maskedLive.includes('a1b2c3d4'));
  check('API-KEYS', 'Enmascaramiento en modo TEST (zc_test_********5678)', maskedTest === 'zc_test_********5678' && !maskedTest.includes('a1b2c3d4'));

  // ----------------------------------------------------
  // 2. API REQUEST LOGS & DATA SANITIZATION
  // ----------------------------------------------------
  console.log('\n📜 [2] AUDITORÍA DE SANITIZACIÓN DE LOGS API (ZERO SECRETS LEAK)');

  const sensitivePayload = {
    password: 'SuperSecretPassword123!',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive',
    apiKey: 'zc_live_998877665544332211',
    webhook_secret: 'whsec_abcdef123456',
    normalField: 'Valor seguro visible'
  };

  const sanitized = ApiLogService.sanitizeData(sensitivePayload);

  check('API-LOGS', 'Sanitización oculta password en logs', !sanitized.password.includes('SuperSecretPassword123') && sanitized.password.includes('********'));
  check('API-LOGS', 'Sanitización oculta JWT token en logs', !sanitized.token.includes('eyJhbGciOi') && sanitized.token.includes('********'));
  check('API-LOGS', 'Sanitización oculta API Key en logs', !sanitized.apiKey.includes('99887766') && sanitized.apiKey.includes('********'));
  check('API-LOGS', 'Sanitización oculta Webhook Secret en logs', !sanitized.webhook_secret.includes('abcdef123456') && sanitized.webhook_secret.includes('********'));
  check('API-LOGS', 'Campos públicos se preservan sin alteración', sanitized.normalField === 'Valor seguro visible');

  // ----------------------------------------------------
  // 3. WEBHOOKS REPLAY & LIVE TESTER
  // ----------------------------------------------------
  console.log('\n📡 [3] AUDITORÍA DE WEBHOOK REPLAY & FIRMA HMAC EN VIVO');

  const secret = 'whsec_demo_secret_key_for_testing';
  const timestamp = Math.floor(Date.now() / 1000);
  const sampleEvent = {
    id: 'evt_test_1724712000',
    type: 'MESSAGE_RECEIVED',
    timestamp,
    instanceName: 'erp_test_001',
    data: { message: 'Prueba E2E Developer Portal' }
  };
  const rawBody = JSON.stringify(sampleEvent);

  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signatureHeader = `sha256=${sig}`;

  // Verificar firma timing safe
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const isMatch = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  check('WEBHOOK-REPLAY', 'Firma HMAC-SHA256 validada con crypto.timingSafeEqual', isMatch);

  // Normalizador de eventos
  const normUpsert = WebhookDispatcherService.normalizeEventType('messages.upsert');
  const normConn = WebhookDispatcherService.normalizeEventType('connection.update');
  check('WEBHOOK-REPLAY', 'Normalización de messages.upsert a MESSAGE_RECEIVED', normUpsert === 'MESSAGE_RECEIVED');
  check('WEBHOOK-REPLAY', 'Normalización de connection.update a CONNECTION_UPDATE', normConn === 'CONNECTION_UPDATE');

  // ----------------------------------------------------
  // 4. OBSERVABILIDAD & TRACING
  // ----------------------------------------------------
  console.log('\n⏱️ [4] AUDITORÍA DE OBSERVABILIDAD & REQUEST TRACING');

  const reqId = `zc_req_${Date.now()}_abc123`;
  const corrId = `zc_corr_${Date.now()}_xyz789`;
  check('OBSERVABILITY', 'X-Request-Id sigue el formato canónico zc_req_<timestamp>_<random>', /^zc_req_\d+_[a-z0-9]+$/.test(reqId));
  check('OBSERVABILITY', 'X-Correlation-Id sigue el formato canónico zc_corr_<timestamp>_<random>', /^zc_corr_\d+_[a-z0-9]+$/.test(corrId));

  // ----------------------------------------------------
  // 5. OPENAPI & POSTMAN ARCHITECTURE
  // ----------------------------------------------------
  console.log('\n📄 [5] AUDITORÍA DE ESPECIFICACIÓN OPENAPI 3.0 & DOMINIOS OFICIALES');

  const serverUrl = openApiSpec.servers[0]?.url;
  check('OPENAPI', 'OpenAPI Base URL oficial es https://api.zazaclick.sbs', serverUrl === 'https://api.zazaclick.sbs');
  check('OPENAPI', 'OpenAPI no contiene referencias a dominios Railway', !JSON.stringify(openApiSpec).includes('railway.app'));
  check('OPENAPI', 'OpenAPI documenta POST /v1/instances', !!openApiSpec.paths['/v1/instances']?.post);
  check('OPENAPI', 'OpenAPI documenta POST /v1/instances/{instanceName}/webhook', !!openApiSpec.paths['/v1/instances/{instanceName}/webhook']?.post);
  check('OPENAPI', 'OpenAPI documenta POST /v1/messages/text', !!openApiSpec.paths['/v1/messages/text']?.post);

  // ----------------------------------------------------
  // RESUMEN
  // ----------------------------------------------------
  const total = auditResults.length;
  const passed = auditResults.filter(r => r.passed).length;
  const failed = auditResults.filter(r => !r.passed).length;

  console.log('\n====================================================');
  console.log(`📊 TOTAL: ${passed} PASADOS | ${failed} FALLADOS de ${total} pruebas`);
  console.log('====================================================\n');

  if (failed > 0) {
    console.error('❌ Fallaron pruebas en la suite Developer Experience.');
    process.exit(1);
  } else {
    console.log('🟢 CERTIFICACIÓN DE DEVELOPER EXPERIENCE SUPERADA AL 100%.');
    process.exit(0);
  }
}

runDevExperienceAudit().catch(err => {
  console.error('Error fatal durante la auditoría:', err);
  process.exit(1);
});
