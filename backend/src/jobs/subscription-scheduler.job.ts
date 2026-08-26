import pool from '../config/database';

/**
 * Tarea periódica de sincronización de vencimientos de suscripciones
 */
export async function checkExpiredSubscriptions(): Promise<number> {
  try {
    const updateRes = await pool.query(`
      UPDATE subscriptions
      SET status = 'expired'
      WHERE end_date < CURRENT_TIMESTAMP 
        AND status IN ('active', 'trial')
      RETURNING id, user_id;
    `);

    const count = updateRes.rowCount || 0;
    if (count > 0) {
      console.log(`⏰ [SubscriptionScheduler] Sincronización: Se marcaron ${count} suscripción(es) como 'expired'.`);
    }
    return count;
  } catch (err: any) {
    console.error('❌ [SubscriptionScheduler] Error al verificar suscripciones vencidas:', err.message);
    return 0;
  }
}

/**
 * Iniciar el scheduler en segundo plano (cada 5 minutos)
 */
export function startSubscriptionScheduler() {
  console.log('⏰ [SubscriptionScheduler] Iniciando servicio de verificación de vencimientos (Intervalo: 5 minutos)...');
  
  // Ejecutar una verificación inicial al arrancar
  checkExpiredSubscriptions();

  // Programar cada 5 minutos (300,000 ms)
  setInterval(() => {
    checkExpiredSubscriptions();
  }, 5 * 60 * 1000);
}
