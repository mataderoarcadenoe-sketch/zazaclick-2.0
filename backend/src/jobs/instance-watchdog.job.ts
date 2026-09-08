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

export async function runWatchdogCycle(): Promise<void> {
  try {
    const res = await pool.query(`
      SELECT instance_name, engine_type, status, user_id
      FROM instances
      ORDER BY updated_at ASC
    `);

    const instances = res.rows;
    if (!instances || instances.length === 0) return;

    for (const inst of instances) {
      const { instance_name, status, user_id } = inst;

      try {
        const engine = await engineRouter.getEngineForInstance(instance_name);
        const stateRes = await engine.getConnectionState(instance_name);
        const isLiveConnected = Boolean(stateRes.data?.isConnected);
        const liveState = stateRes.data?.state || (isLiveConnected ? 'connected' : 'disconnected');

        // Caso 1: La instancia está físicamente conectada pero en BD figuraba desconectada o reconectando
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

        // Caso 2: Si el estado en vivo no está conectado y el usuario no cerró sesión explícitamente (status !== 'logged_out')
        if (!isLiveConnected && status !== 'logged_out') {
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
          } else if (reconnectRes?.data?.requiresQr) {
            console.log(`⚠️ [Watchdog] Instancia "${instance_name}" requiere escaneo de QR (sesión expirada o desvinculada).`);
            await pool.query(
              "UPDATE instances SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1",
              [instance_name]
            );
          } else {
            // Mantener en estado reconnecting para que el frontend informe al usuario que está auto-recuperando
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
        }
      } catch (instErr: any) {
        // Ignorar fallos individuales para no interrumpir la verificación de otras instancias
        console.warn(`[Watchdog] Error evaluando instancia "${instance_name}":`, instErr.message);
      }
    }
  } catch (err: any) {
    console.error('❌ [Watchdog] Error general en ciclo de supervisión:', err.message);
  }
}

/**
 * Iniciar el centinela en segundo plano (Intervalo: cada 60 segundos)
 */
export function startInstanceWatchdog(): void {
  console.log('🐕 [Watchdog] Centinela de auto-reconexión iniciado (Intervalo: cada 60 segundos)...');

  // Ejecutar primer ciclo a los 15 segundos tras arrancar
  setTimeout(() => {
    runWatchdogCycle();
  }, 15000);

  // Intervalo recurrente cada 60 segundos (60,000 ms)
  setInterval(() => {
    runWatchdogCycle();
  }, 60 * 1000);
}
