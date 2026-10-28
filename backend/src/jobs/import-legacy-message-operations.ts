import type { Pool } from 'pg';
import type Redis from 'ioredis';

/** One-time cutover AFTER stopping old workers. Imports only tombstones, never sends. */
export async function importLegacyOperations(pool: Pool, redis: Redis) {
  let cursor = '0', imported = 0, skipped = 0;
  do {
    const batch = await redis.scan(cursor, 'MATCH', 'idemp:*', 'COUNT', 200);
    cursor = batch[0];
    for (const redisKey of batch[1]) {
      const match = /^idemp:([A-Za-z0-9_-]{1,255}):([A-Za-z0-9_.:-]{1,128})$/.exec(redisKey);
      const raw = match ? await redis.get(redisKey) : null;
      if (!match || !raw) { skipped++; continue; }
      let record: any;
      try { record = JSON.parse(raw); } catch { skipped++; continue; }
      if (!['SUCCESS','FAILED','IN_PROGRESS'].includes(record.status)) { skipped++; continue; }
      const result = await pool.query(`INSERT INTO message_operations
        (id,user_id,instance_id,subscription_id,idempotency_key,request_hash,environment,state,message_id)
        SELECT $1::uuid,i.user_id,i.id,COALESCE(s.id,'legacy-unassigned'),$3,$4,'live','UNKNOWN',$5
        FROM instances i LEFT JOIN LATERAL (SELECT id FROM subscriptions WHERE user_id=i.user_id ORDER BY created_at DESC LIMIT 1) s ON true
        WHERE i.instance_name=$2 AND i.user_id IS NOT NULL
        ON CONFLICT (user_id,instance_id,idempotency_key) DO NOTHING RETURNING id`,
        [(await import('crypto')).randomUUID(), match[1], match[2], '0'.repeat(64),
          typeof record.response?.messageId === 'string' ? record.response.messageId.slice(0,200) : null]);
      imported += result.rows.length;
    }
  } while (cursor !== '0');
  return {imported, skipped};
}

if (require.main === module) {
  if (!process.argv.includes('--confirm-stopped-old-workers')) {
    console.error('Detén y drena los workers antiguos antes de importar. Se requiere --confirm-stopped-old-workers.');
    process.exitCode = 1;
  } else {
    (async () => {
      const pool = (await import('../config/database')).default;
      const redis = (await import('../config/redis')).default;
      try { console.log(await importLegacyOperations(pool, redis)); }
      finally { await pool.end(); await redis.quit(); }
    })().catch(() => { console.error('La importación no terminó; no habilites el nuevo envío.'); process.exitCode = 1; });
  }
}
