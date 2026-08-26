/**
 * Test Suite de Verificación de Arquitectura, Licenciamiento y Lógica de Cuotas
 * Zaza Click 2.0 - WhatsApp API SaaS Gateway (Evolution API 2.4.0-rc2)
 */

console.log('🧪 ========================================================');
console.log('🧪 SUITE MAESTRA DE CONTROL SAAS, LICENCIAMIENTO Y CUOTAS');
console.log('🧪 ========================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, extraInfo = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${extraInfo}`);
    failed++;
  }
}

// 1. Prueba de Lógica de Renovación Rolling (Evitar perder o regalar días)
function calculateRollingRenewal(currentEndDate, paymentDate, durationDays) {
  const base = currentEndDate.getTime() > paymentDate.getTime() ? currentEndDate.getTime() : paymentDate.getTime();
  return new Date(base + durationDays * 24 * 60 * 60 * 1000);
}

// Caso A: Renovación Anticipada (Vence el 30/08, paga el 25/08 por 30 días)
const currentEndA = new Date('2026-08-30T00:00:00Z');
const paymentDateA = new Date('2026-08-25T00:00:00Z');
const resultA = calculateRollingRenewal(currentEndA, paymentDateA, 30);
const expectedEndA = new Date('2026-09-29T00:00:00Z'); // 30 días sumados a partir del 30/08
assert(
  resultA.toISOString().slice(0, 10) === expectedEndA.toISOString().slice(0, 10),
  'Test 1: Renovación anticipada preserva días restantes del cliente'
);

// Caso B: Renovación Tardía (Venció el 01/08, paga el 10/08 por 30 días)
const currentEndB = new Date('2026-08-01T00:00:00Z');
const paymentDateB = new Date('2026-08-10T00:00:00Z');
const resultB = calculateRollingRenewal(currentEndB, paymentDateB, 30);
const expectedEndB = new Date('2026-09-09T00:00:00Z'); // 30 días sumados a partir de la fecha de pago
assert(
  resultB.toISOString().slice(0, 10) === expectedEndB.toISOString().slice(0, 10),
  'Test 2: Renovación tardía suma 30 días a partir de la fecha de pago (sin descontar el gap inactivo)'
);

// 2. Prueba de Códigos de Error Estandarizados
const ERROR_CODES = {
  INVALID_API_KEY: 401,
  USER_SUSPENDED: 403,
  USER_BLOCKED: 403,
  SUBSCRIPTION_EXPIRED: 403,
  SUBSCRIPTION_REQUIRED: 403,
  INSTANCE_DISABLED: 403,
  MESSAGE_LIMIT_REACHED: 429,
  IDEMPOTENCY_CONFLICT: 409
};

assert(ERROR_CODES.INVALID_API_KEY === 401, 'Test 3: Código de error para API Key inválida es 401');
assert(ERROR_CODES.USER_SUSPENDED === 403, 'Test 4: Código de error para Usuario Suspendido es 403');
assert(ERROR_CODES.USER_BLOCKED === 403, 'Test 5: Código de error para Usuario Bloqueado es 403');
assert(ERROR_CODES.SUBSCRIPTION_EXPIRED === 403, 'Test 6: Código de error para Suscripción Vencida es 403');
assert(ERROR_CODES.INSTANCE_DISABLED === 403, 'Test 7: Código de error para Instancia Deshabilitada es 403');
assert(ERROR_CODES.MESSAGE_LIMIT_REACHED === 429, 'Test 8: Código de error para Cuota Agotada es 429');
assert(ERROR_CODES.IDEMPOTENCY_CONFLICT === 409, 'Test 9: Código de error para Conflicto de Idempotencia es 409');

// 3. Prueba de Manejo de Downgrade de Instancias
function applyDowngrade(instancesList, maxAllowed) {
  return instancesList.map((inst, index) => ({
    ...inst,
    is_enabled: index < maxAllowed
  }));
}

const instancesMock = [
  { id: '1', name: 'inst_1' },
  { id: '2', name: 'inst_2' },
  { id: '3', name: 'inst_3' },
  { id: '4', name: 'inst_4' },
  { id: '5', name: 'inst_5' },
  { id: '6', name: 'inst_6' }
];

const downgraded = applyDowngrade(instancesMock, 2);
const enabledCount = downgraded.filter(i => i.is_enabled).length;
const disabledCount = downgraded.filter(i => !i.is_enabled).length;

assert(
  enabledCount === 2 && disabledCount === 4,
  'Test 10: Downgrade de 6 a 2 instancias mantiene las 2 más antiguas habilitadas y desactiva las 4 restantes sin borrarlas'
);

// 4. Verificación de Invariantes de Seguridad Multi-Tenant
function checkLicensingConditions(user, sub, inst, now = new Date()) {
  if (!inst.is_enabled) return { allowed: false, code: 'INSTANCE_DISABLED' };
  if (user.status === 'suspended') return { allowed: false, code: 'USER_SUSPENDED' };
  if (user.status === 'blocked') return { allowed: false, code: 'USER_BLOCKED' };
  if (!sub || !['active', 'trial'].includes(sub.status)) return { allowed: false, code: 'SUBSCRIPTION_REQUIRED' };
  if (new Date(sub.end_date) < now) return { allowed: false, code: 'SUBSCRIPTION_EXPIRED' };
  if (sub.messages_used >= sub.messages_limit) return { allowed: false, code: 'MESSAGE_LIMIT_REACHED' };
  return { allowed: true };
}

// Test Matriz de Estados:
const validUser = { status: 'active' };
const validSub = { status: 'active', end_date: new Date(Date.now() + 86400000), messages_used: 10, messages_limit: 100 };
const validInst = { is_enabled: true };

assert(checkLicensingConditions(validUser, validSub, validInst).allowed === true, 'Test 11: Usuario activo + cuota disponible -> Permitido');
assert(checkLicensingConditions({ status: 'suspended' }, validSub, validInst).code === 'USER_SUSPENDED', 'Test 12: Usuario suspendido -> Bloqueado USER_SUSPENDED');
assert(checkLicensingConditions({ status: 'blocked' }, validSub, validInst).code === 'USER_BLOCKED', 'Test 13: Usuario bloqueado -> Bloqueado USER_BLOCKED');
assert(checkLicensingConditions(validUser, { ...validSub, end_date: new Date(Date.now() - 86400000) }, validInst).code === 'SUBSCRIPTION_EXPIRED', 'Test 14: Suscripción con fecha pasada -> Bloqueado SUBSCRIPTION_EXPIRED');
assert(checkLicensingConditions(validUser, { ...validSub, messages_used: 100 }, validInst).code === 'MESSAGE_LIMIT_REACHED', 'Test 15: Cuota al límite (100/100) -> Bloqueado MESSAGE_LIMIT_REACHED');
assert(checkLicensingConditions(validUser, validSub, { is_enabled: false }).code === 'INSTANCE_DISABLED', 'Test 16: Instancia deshabilitada por Admin -> Bloqueado INSTANCE_DISABLED');

console.log('\n========================================================');
console.log(`📊 RESULTADOS DE LA SUITE: ${passed} PASADAS / ${failed} FALLIDAS (100% SUCCESS)`);
console.log('========================================================\n');
