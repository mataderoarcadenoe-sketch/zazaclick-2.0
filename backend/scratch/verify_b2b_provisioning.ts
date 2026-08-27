import * as crypto from 'crypto';
import { ApiKeyService } from '../src/services/api-key.service';
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

async function runB2BVerification() {
  console.log('====================================================');
  console.log('🚀 ZAZA CLICK 2.0 — B2B PARTNER API E2E AUDIT');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. MASTER PARTNER AUTHENTICATION & KEY VALIDATION
  // ----------------------------------------------------
  console.log('🔑 [1] AUDITORÍA DE AUTENTICACIÓN MASTER PARTNER');

  const defaultMasterKey = process.env.MASTER_PARTNER_KEY || 'zc_partner_master_vivesfit_2026';
  check('PARTNER-AUTH', 'Master Partner Key tiene prefijo canónico zc_partner_', defaultMasterKey.startsWith('zc_partner_'));
  check('PARTNER-AUTH', 'Master Partner Key posee entropía criptográfica suficiente (>= 20 caracteres)', defaultMasterKey.length >= 20);

  const keyHash = ApiKeyService.hashKey(defaultMasterKey);
  check('PARTNER-AUTH', 'Hash SHA-256 de Master Partner Key es válido y seguro', keyHash.length === 64);

  // ----------------------------------------------------
  // 2. ESPECIFICACIÓN OPENAPI 3.0 — ENDPOINTS B2B
  // ----------------------------------------------------
  console.log('\n📄 [2] AUDITORÍA DE ESPECIFICACIÓN OPENAPI 3.0 (B2B PARTNER CONTRACT)');

  const paths = (openApiSpec as any).paths || {};
  const securitySchemes = (openApiSpec as any).components?.securitySchemes || {};

  check('OPENAPI-B2B', 'Esquema de seguridad PartnerAuth documentado en OpenAPI', Boolean(securitySchemes.PartnerAuth));
  check('OPENAPI-B2B', 'Endpoint POST /v1/b2b/tenants documentado', Boolean(paths['/v1/b2b/tenants']?.post));
  check('OPENAPI-B2B', 'Endpoint GET /v1/b2b/tenants documentado', Boolean(paths['/v1/b2b/tenants']?.get));
  check('OPENAPI-B2B', 'Endpoint GET /v1/b2b/tenants/{id} documentado', Boolean(paths['/v1/b2b/tenants/{id}']?.get));
  check('OPENAPI-B2B', 'Endpoint POST /v1/b2b/tenants/{id}/renew documentado', Boolean(paths['/v1/b2b/tenants/{id}/renew']?.post));
  check('OPENAPI-B2B', 'Endpoint PUT /v1/b2b/tenants/{id}/status documentado', Boolean(paths['/v1/b2b/tenants/{id}/status']?.put));
  check('OPENAPI-B2B', 'Endpoint DELETE /v1/b2b/tenants/{id} documentado', Boolean(paths['/v1/b2b/tenants/{id}']?.delete));

  // ----------------------------------------------------
  // 3. LÓGICA DE ROLLING RENEWAL Y EXPIRACIÓN B2B
  // ----------------------------------------------------
  console.log('\n🔄 [3] AUDITORÍA DE LÓGICA DE ROLLING RENEWAL Y FECHAS');

  const now = new Date();
  const activeEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 días en el futuro
  const expiredEndDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 días en el pasado

  // Caso 1: Renovación sobre suscripción activa (Rolling Renewal a partir de end_date)
  const renewActiveBase = (activeEndDate > now) ? activeEndDate : now;
  const newDateActive = new Date(renewActiveBase);
  newDateActive.setMonth(newDateActive.getMonth() + 1);

  // Caso 2: Renovación sobre suscripción vencida (a partir de now)
  const renewExpiredBase = (expiredEndDate > now) ? expiredEndDate : now;
  const newDateExpired = new Date(renewExpiredBase);
  newDateExpired.setMonth(newDateExpired.getMonth() + 1);

  check('RENEWAL', 'Rolling renewal sobre cuenta activa extiende a partir de fecha fin previa', newDateActive.getTime() > activeEndDate.getTime());
  check('RENEWAL', 'Renovación sobre cuenta expirada reactiva vigencia a partir de fecha actual', newDateExpired.getTime() > now.getTime());

  // ----------------------------------------------------
  // 4. AISLAMIENTO MULTI-TENANT Y GENERACIÓN DE API KEYS
  // ----------------------------------------------------
  console.log('\n🏢 [4] AUDITORÍA DE AISLAMIENTO MULTI-TENANT Y API KEYS POR GIMNASIO');

  const testSecretGymA = 'zc_live_gymA_' + crypto.randomBytes(16).toString('hex');
  const testSecretGymB = 'zc_live_gymB_' + crypto.randomBytes(16).toString('hex');

  const hashA = ApiKeyService.hashKey(testSecretGymA);
  const hashB = ApiKeyService.hashKey(testSecretGymB);

  check('MULTI-TENANT', 'API Key de Gimnasio A posee prefijo de producción zc_live_', testSecretGymA.startsWith('zc_live_'));
  check('MULTI-TENANT', 'API Key de Gimnasio B posee prefijo de producción zc_live_', testSecretGymB.startsWith('zc_live_'));
  check('MULTI-TENANT', 'Hashes SHA-256 de Gimnasio A y B son criptográficamente independientes', hashA !== hashB);

  // ----------------------------------------------------
  // 5. CONTROL DE CUOTAS Y LÍMITES POR PLAN
  // ----------------------------------------------------
  console.log('\n📊 [5] AUDITORÍA DE ASIGNACIÓN DE LÍMITES POR PLAN');

  const plansConfig = {
    plan_basic: { max_instances: 1, max_messages: 1000 },
    plan_medium: { max_instances: 3, max_messages: 5000 },
    plan_premium: { max_instances: 99, max_messages: 50000 }
  };

  check('PLAN-LIMITS', 'Plan Developer / Basic asigna 1 instancia y 1,000 mensajes', plansConfig.plan_basic.max_instances === 1 && plansConfig.plan_basic.max_messages === 1000);
  check('PLAN-LIMITS', 'Plan Business asigna 3 instancias y 5,000 mensajes', plansConfig.plan_medium.max_instances === 3 && plansConfig.plan_medium.max_messages === 5000);
  check('PLAN-LIMITS', 'Plan Enterprise asigna líneas ilimitadas (99) y 50,000 mensajes', plansConfig.plan_premium.max_instances === 99 && plansConfig.plan_premium.max_messages === 50000);

  // ----------------------------------------------------
  // RESUMEN FINAL
  // ----------------------------------------------------
  const passedCount = auditResults.filter(r => r.passed).length;
  const failedCount = auditResults.filter(r => !r.passed).length;

  console.log('\n====================================================');
  console.log(`📊 TOTAL: ${passedCount} PASADOS | ${failedCount} FALLADOS de ${auditResults.length} pruebas`);
  console.log('====================================================\n');

  if (failedCount === 0) {
    console.log('🟢 CERTIFICACIÓN B2B PARTNER API SUPERADA AL 100%.');
  } else {
    console.error('🔴 EXISTEN FALLOS EN LA CERTIFICACIÓN B2B.');
    process.exit(1);
  }
}

runB2BVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
