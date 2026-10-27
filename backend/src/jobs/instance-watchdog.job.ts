/**
 * Centinela de Auto-Reconexión Industrial de Instancias WhatsApp — Zaza Click 2.0
 * 
 * Monitorea de forma periódica en segundo plano todas las instancias registradas.
 * Si una instancia pierde el socket por tiempo de espera (408), reposo del teléfono (Doze Mode)
 * o reinicios del contenedor, este servicio la reconecta silenciosamente utilizando
 * las llaves criptográficas almacenadas en la base de datos sin requerir escaneo de QR.
 */

import pool from '../config/database';
import { engineRouter } from '../engines/core/EngineRouter';
import { getIO } from '../config/socket';
import redis from '../config/redis';

export async function runWatchdogCycle(): Promise<void> {
  try {
    const res = await pool.query(`
      SELECT instance_name, engine_type, status, user_id, jid, qrcode, connected
      FROM instances
      ORDER BY updated_at ASC
    `);

    const instances = res.rows;
    if (!instances || instances.length === 0) return;

    for (const inst of instances) {
      const { instance_name, status, user_id, jid, qrcode } = inst;

      // Si el usuario cerró sesión voluntariamente, no intentar reconectar
      if (status === 'logged_out') continue;

      const lockKey = `lock:reconnect:${instance_name}`;

      try {
        const engine = await engineRouter.getEngineForInstance(instance_name);
        const stateRes = await engine.getConnectionState(instance_name);
        const isLiveConnected = Boolean(stateRes.data?.isConnected);
        const liveState = stateRes.data?.state || (isLiveConnected ? 'connected' : 'disconnected');

        // Caso 1: La instancia está físicamente conectada en WhatsApp pero en BD figuraba desconectada o reconectando
        if (isLiveConnected && status !== 'connected') {
          console.log(`✅ [Watchdog] Instancia "${instance_name}" detectada viva. Sincronizando BD a 'connected'.`);
          await pool.query(
            "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
            [instance_name]
          );

          const io = getIO();
          if (io) {
            io.to(`user_${user_id}`).emit('connection_status', {
              instance: instance_name,
              status: 'connected',
              connectionState: 'open'
            });
          }
          continue;
        }

        // Si la instancia está en 'disconnected', está esperando escaneo de QR, o nunca ha vinculado un JID, NO forzar reconexión
        if (status === 'disconnected' || (qrcode && String(qrcode).length > 10) || !jid) {
          continue;
        }
        if (!isLiveConnected) {
          const acquired = await redis.set(lockKey, '1', 'PX', 45000, 'NX');
          if (acquired !== 'OK') {
            // Ya hay una reconexión activa por webhook o llamada previa
            continue;
          }

          console.log(`🐕 [Watchdog] Instancia "${instance_name}" sin conexión activa (liveState=${liveState}, status=${status}). Intentando reactivación silenciosa...`);

          let reconnectRes: any = null;
          if (typeof (engine as any).reconnect === 'function') {
            reconnectRes = await (engine as any).reconnect(instance_name);
          }

          const nowConnected = Boolean(reconnectRes?.data?.isConnected);
          if (nowConnected) {
            console.log(`🎉 [Watchdog] Instancia "${instance_name}" restablecida exitosamente sin nuevo QR.`);
            await pool.query(
              "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
              [instance_name]
            );

            const io = getIO();
            if (io) {
              io.to(`user_${user_id}`).emit('connection_status', {
                instance: instance_name,
                status: 'connected',
                connectionState: 'open'
              });
            }
          } else {
            // Mantener en 'reconnecting' para preservar la sesión persistida
            if (status !== 'reconnecting') {
              await pool.query(
                "UPDATE instances SET status = 'reconnecting', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
                [instance_name]
              );
              const io = getIO();
              if (io) {
                io.to(`user_${user_id}`).emit('connection_status', {
                  instance: instance_name,
                  status: 'reconnecting',
                  connectionState: 'connecting'
                });
              }
            }
          }

          try {
            await redis.del(lockKey);
          } catch {}
        }
      } catch (instErr: any) {
        try {
          await redis.del(lockKey);
        } catch {}
        console.warn(`[Watchdog] Error evaluando instancia "${instance_name}":`, instErr.message);
      }
    }
  } catch (err: any) {
    console.error('❌ [Watchdog] Error general en ciclo de supervisión:', err.message);
  }
}

/**
 * Iniciar el centinela en segundo plano (Intervalo: cada 90 segundos)
 */
export function startInstanceWatchdog(): void {
  console.log('🐕 [Watchdog] Centinela de auto-reconexión iniciado (Intervalo: cada 90 segundos)...');

  // Ejecutar primer ciclo a los 20 segundos tras arrancar
  setTimeout(() => {
    runWatchdogCycle();
  }, 20000);

  // Intervalo recurrente cada 90 segundos (90,000 ms)
  setInterval(() => {
    runWatchdogCycle();
  }, 90 * 1000);
}
