import { isRetiredCredential } from '../../config/security';
/**
 * Adapter Canónico para Evolution Go — Zaza Click 2.0
 */

import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import http from 'http';
import https from 'https';
import { WhatsAppEngine } from '../contracts/WhatsAppEngine';
import { EngineType, EngineCapabilities, EngineResult, EngineHealth } from '../contracts/engine.types';
import {
  SendTextMessageParams,
  SendMediaMessageParams,
  SendAudioMessageParams,
  SendLocationMessageParams,
  SendContactMessageParams
} from '../contracts/message.types';
import { CircuitBreaker } from '../core/CircuitBreaker';
import { EvolutionGoMapper } from './EvolutionGoMapper';
import { validateSafeUrl, normalizeBase64 } from '../../utils/ssrf.util';
import pool from '../../config/database';
import redis from '../../config/redis';

export class EvolutionGoEngine implements WhatsAppEngine {
  public readonly engineType: EngineType = 'evolution_go';
  public readonly capabilities: EngineCapabilities = {
    sendText: true,
    sendMedia: true,
    sendAudio: true,
    sendLocation: true,
    sendContact: true,
    webhooks: true,
    groups: true,
    chatsHistory: false
  };

  private circuitBreaker: CircuitBreaker;
  private api: AxiosInstance | null = null;

  constructor() {
    this.circuitBreaker = new CircuitBreaker('evolution_go', {
      failureThreshold: 5,
      cooldownPeriodMs: 30000
    });
    this.initHttpClient();
  }

  private initHttpClient(): void {
    const url = process.env.EVOLUTION_GO_URL;
    const key = process.env.EVOLUTION_GO_API_KEY || 'F2C43224-3975-46EC-954A-FB335F5C9FDA';
    const timeout = parseInt(process.env.EVOLUTION_GO_TIMEOUT || '10000', 10);

    if (url) {
      this.api = axios.create({
        baseURL: url,
        headers: {
          'apikey': key || '',
          'Content-Type': 'application/json'
        },
        timeout,
        httpAgent: new http.Agent({ keepAlive: true, maxSockets: 50 }),
        httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50 })
      });
    }
  }

  private getClient(): AxiosInstance {
    if (!this.api) {
      this.initHttpClient();
    }
    if (!this.api) {
      throw new Error('[EvolutionGoEngine] EVOLUTION_GO_URL no configurado.');
    }
    return this.api;
  }

  private getGlobalApiKey(): string {
    const key = process.env.EVOLUTION_GO_API_KEY || 'F2C43224-3975-46EC-954A-FB335F5C9FDA';
    if (!key || isRetiredCredential(key)) throw new Error('EVOLUTION_GO_API_KEY no configurada.');
    return key;
  }

  /**
   * Resuelve el ID UUID y el token específico de la instancia en PostgreSQL.
   * Evolution Go autentica los endpoints de instancia exclusivamente mediante el header `apikey: <instance_token>`.
   */
  private async resolveInstanceAuth(instanceName: string): Promise<{
    id: string | null;
    token: string;
    connected: boolean;
    jid: string;
    qrcode: string;
  }> {
    const globalKey = this.getGlobalApiKey();
    try {
      const res = await pool.query(
        `SELECT id, token, api_key, connected, jid, qrcode
         FROM instances
         WHERE instance_name = $1 OR name = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [instanceName]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const token = row.token || row.api_key || globalKey;
        return {
          id: row.id || null,
          token,
          connected: Boolean(row.connected),
          jid: row.jid || '',
          qrcode: row.qrcode ? String(row.qrcode).split('|')[0] : ''
        };
      }
    } catch (err: any) {
      console.warn(`[EvolutionGoEngine] Error consultando auth de instancia "${instanceName}":`, err.message);
    }
    return {
      id: null,
      token: globalKey,
      connected: false,
      jid: '',
      qrcode: ''
    };
  }

  /**
   * Resuelve el ID interno UUID de la instancia en Evolution Go (en memoria/Go DB).
   * Evolution Go indexa internamente con su propio UUID, independiente de PostgreSQL.
   */
  private async resolveEvolutionGoId(instanceName: string): Promise<string | null> {
    try {
      const client = this.getClient();
      const globalKey = this.getGlobalApiKey();
      const allRes = await client.get('/instance/all', {
        headers: { apikey: globalKey },
        timeout: 4000
      });
      const list = Array.isArray(allRes.data?.data) ? allRes.data.data : [];
      const found = list.find((i: any) => i.name === instanceName || i.instance_name === instanceName);
      return found?.id || null;
    } catch (err: any) {
      console.warn(`[EvolutionGoEngine] Error resolviendo GoId para "${instanceName}":`, err.message);
      return null;
    }
  }

  public async createInstance(instanceName: string): Promise<EngineResult<{ token: string; qrcode?: string; instance?: any }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const globalKey = this.getGlobalApiKey();
      const BACKEND_URL = process.env.BACKEND_URL || 'https://api.zazaclick.sbs';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;

      // 1. Verificar si ya existe la instancia en BD o en Evolution Go
      const existing = await this.resolveInstanceAuth(instanceName);
      let instanceToken = (existing.id && existing.token && existing.token !== globalKey)
        ? existing.token
        : crypto.randomUUID().toUpperCase();

      // Verificar en Evolution Go /instance/all si ya está cargada en memoria
      try {
        const allRes = await client.get('/instance/all', { headers: { apikey: globalKey } });
        const list = Array.isArray(allRes.data?.data) ? allRes.data.data : [];
        const foundInGo = list.find((item: any) => item.name === instanceName || item.instance_name === instanceName);
        if (foundInGo) {
          const foundToken = foundInGo.token || instanceToken;
          await pool.query(
            `UPDATE instances SET token = $1, api_key = $1, webhook = $2, events = 'ALL', updated_at = CURRENT_TIMESTAMP
             WHERE instance_name = $3 OR name = $3`,
            [foundToken, webhookUrl, instanceName]
          ).catch(() => {});
          this.circuitBreaker.recordSuccess();
          return EvolutionGoMapper.mapSuccess({
            token: foundToken,
            qrcode: foundInGo.qrcode ? String(foundInGo.qrcode).split('|')[0] : undefined,
            instance: foundInGo
          }, Date.now() - start);
        }
      } catch {}

      // Si existía en Go pero necesitamos recrearla limpia, eliminarla usando el ID real de Go
      const orphanGoId = await this.resolveEvolutionGoId(instanceName);
      if (orphanGoId) {
        try {
          await client.delete(`/instance/delete/${orphanGoId}`, { headers: { apikey: globalKey }, timeout: 4000 });
        } catch {}
      }

      const payload = {
        name: instanceName,
        token: instanceToken,
        webhook: webhookUrl,
        events: ['ALL']
      };

      const response = await client.post('/instance/create', payload, {
        headers: { apikey: globalKey }
      });

      const latencyMs = Date.now() - start;
      const data = response.data?.data || response.data;
      const token = data?.token || instanceToken;
      const rawQr = data?.qrcode || data?.Qrcode || data?.base64;
      const qrcode = rawQr ? String(rawQr).split('|')[0] : undefined;

      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess({
        token,
        qrcode,
        instance: data
      }, latencyMs);
    } catch (err: any) {
      // Si Evolution Go responde que ya existe en BD (duplicate key), adoptarla limpiamente
      const errMsg = String(err.response?.data?.error || err.message || '');
      if (errMsg.includes('duplicate') || errMsg.includes('already exists') || err.response?.status === 409) {
        const recovered = await this.resolveInstanceAuth(instanceName);
        if (recovered.id) {
          this.circuitBreaker.recordSuccess();
          return EvolutionGoMapper.mapSuccess({
            token: recovered.token,
            qrcode: recovered.qrcode || undefined,
            instance: { id: recovered.id, name: instanceName, token: recovered.token }
          }, Date.now() - start);
        }
      }
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async deleteInstance(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const globalKey = this.getGlobalApiKey();
      const auth = await this.resolveInstanceAuth(instanceName);

      // 1. Primero desconectar/cerrar sesión si estaba activa
      if (auth.token) {
        try {
          await client.delete('/instance/logout', { headers: { apikey: auth.token }, timeout: 3000 });
        } catch {}
      }

      // 2. Buscar el ID real de la instancia en Evolution Go y purgarla
      const targetGoId = await this.resolveEvolutionGoId(instanceName);
      if (targetGoId) {
        await client.delete(`/instance/delete/${targetGoId}`, { headers: { apikey: globalKey }, timeout: 4000 });
        console.log(`🗑️ [EvolutionGoEngine] Instancia "${instanceName}" (GoID=${targetGoId}) eliminada del motor.`);
      }

      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(true, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getConnectionState(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean; phone?: string }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);

      const response = await client.get('/instance/status', {
        headers: { apikey: auth.token }
      });

      const latencyMs = Date.now() - start;
      const resData = response?.data?.data || response?.data;
      const isLoggedIn = Boolean(resData?.LoggedIn === true || (auth.connected && auth.jid));
      const isSocketOpen = Boolean(resData?.Connected === true);
      const state = isLoggedIn ? 'connected' : (isSocketOpen ? 'connecting' : 'disconnected');
      const phone = auth.jid ? auth.jid.split('@')[0].split(':')[0] : undefined;

      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess({ state, isConnected: isLoggedIn, phone }, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapSuccess({ state: 'disconnected', isConnected: false }, latencyMs);
    }
  }

  public async reconnect(instanceName: string): Promise<EngineResult<{ state: string; isConnected: boolean; requiresQr?: boolean }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);

      // Si la instancia nunca ha vinculado un JID (no tiene sesión previa), no llamar a reconnect
      if (!auth.jid) {
        return EvolutionGoMapper.mapSuccess({
          state: 'disconnected',
          isConnected: false,
          requiresQr: true
        }, Date.now() - start);
      }

      let reconnectedOk = false;
      try {
        const recRes = await client.post('/instance/reconnect', {}, { headers: { apikey: auth.token } });
        if (recRes.status === 200) reconnectedOk = true;
      } catch (recErr: any) {
        const errDetail = String(recErr.response?.data?.error || recErr.message || '');
        console.warn(`[EvolutionGoEngine] /instance/reconnect para "${instanceName}" falló (${errDetail}). Activando fallback /instance/connect...`);
      }

      // Si /instance/reconnect falló o el cliente estaba cerrado en Whatsmeow, llamar a /instance/connect
      if (!reconnectedOk) {
        try {
          await client.post(
            '/instance/connect',
            {
              subscribe: ['MESSAGE', 'READ_RECEIPT', 'PRESENCE', 'CHAT_PRESENCE', 'CALL'],
              immediate: true
            },
            { headers: { apikey: auth.token } }
          );
        } catch (connErr: any) {
          console.warn(`[EvolutionGoEngine] /instance/connect en reconnect fallback falló:`, connErr.message);
        }
      }

      // Esperar que whatsmeow restaure el socket
      let state = 'connecting';
      let isConnected = false;

      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const stateRes = await this.getConnectionState(instanceName);
        if (stateRes.data?.isConnected) {
          isConnected = true;
          state = 'connected';
          break;
        }
      }

      if (isConnected) {
        this.circuitBreaker.recordSuccess();
      }

      return EvolutionGoMapper.mapSuccess({
        state,
        isConnected,
        requiresQr: false
      }, Date.now() - start);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  /**
   * Auto-Curación: Recicla el socket y cliente Go en memoria de Evolution Go sin reiniciar el contenedor.
   * Elimina el cliente zombi trabado de la memoria RAM de Go, recrea el runtime con las mismas
   * credenciales y reconecta el socket limpiamente.
   */
  public async recycleInstanceSocket(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const globalKey = this.getGlobalApiKey();
      const BACKEND_URL = process.env.BACKEND_URL || 'https://api.zazaclick.sbs';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;

      // 1. Resolver token de la instancia
      const auth = await this.resolveInstanceAuth(instanceName);
      const instanceToken = (auth.token && auth.token !== globalKey) ? auth.token : crypto.randomUUID().toUpperCase();

      // 2. Resolver el ID real en Evolution Go y purgar el descriptor zombi de la RAM de Go
      const targetGoId = await this.resolveEvolutionGoId(instanceName);
      if (targetGoId) {
        try {
          await client.delete(`/instance/delete/${targetGoId}`, { headers: { apikey: globalKey }, timeout: 4000 });
          console.log(`🧹 [EvolutionGoEngine] Socket zombi de "${instanceName}" (GoID=${targetGoId}) purgado de memoria.`);
        } catch (delErr: any) {
          console.warn(`[EvolutionGoEngine] Advertencia purgando socket zombi:`, delErr.message);
        }
      }

      // 3. Recrear el runtime fresco en Evolution Go con el mismo token
      const payload = {
        name: instanceName,
        token: instanceToken,
        webhook: webhookUrl,
        events: ['ALL']
      };

      try {
        await client.post('/instance/create', payload, { headers: { apikey: globalKey }, timeout: 5000 });
      } catch (createErr: any) {
        const errMsg = String(createErr.response?.data?.error || createErr.message || '');
        if (!errMsg.includes('duplicate') && !errMsg.includes('already exists')) {
          console.warn(`[EvolutionGoEngine] Error al recrear instancia en create:`, errMsg);
        }
      }

      // 4. Reconectar inmediatamente con webhookUrl y suscripciones completas
      try {
        await client.post(
          '/instance/connect',
          {
            webhookUrl,
            subscribe: ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'PRESENCE', 'HISTORY_SYNC', 'CHAT_PRESENCE', 'CALL', 'CONNECTION', 'LABEL', 'CONTACT', 'GROUP', 'NEWSLETTER', 'QRCODE', 'BUTTON_CLICK', 'PICTURE', 'USER_ABOUT'],
            immediate: true
          },
          { headers: { apikey: instanceToken }, timeout: 5000 }
        );
      } catch {}

      // 5. Sincronizar en base de datos
      await pool.query(
        `UPDATE instances 
         SET token = $1, api_key = $1, status = 'disconnected', qrcode = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE instance_name = $2 OR name = $2`,
        [instanceToken, instanceName]
      ).catch(() => {});

      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(true, Date.now() - start);
    } catch (err: any) {
      console.error(`❌ [EvolutionGoEngine] Error en recycleInstanceSocket para "${instanceName}":`, err.message);
      return EvolutionGoMapper.mapFailure(err, Date.now() - start);
    }
  }

  public async getQRCode(instanceName: string): Promise<EngineResult<{ qrcode: string; generating?: boolean; alreadyConnected?: boolean }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const globalKey = this.getGlobalApiKey();
      const BACKEND_URL = process.env.BACKEND_URL || 'https://api.zazaclick.sbs';
      const webhookUrl = `${BACKEND_URL}/api/webhooks/whatsapp`;

      let auth = await this.resolveInstanceAuth(instanceName);

      // 1. Si no existe en la base de datos o en Evolution Go, inicializarla
      if (!auth.id) {
        await this.createInstance(instanceName);
        auth = await this.resolveInstanceAuth(instanceName);
      }

      // 2. Si ya está conectada según la base de datos (con JID y connected=true), responder en <15ms
      if (auth.connected && auth.jid) {
        this.circuitBreaker.recordSuccess();
        return {
          success: true,
          engine: this.engineType,
          data: {
            qrcode: '',
            alreadyConnected: true,
            status: 'connected',
            state: 'connected',
            isConnected: true
          } as any,
          latencyMs: Date.now() - start
        };
      }

      // 3. Consultar rápidamente el estado del socket en Evolution Go (timeout estricto 1.5s)
      let isSocketConnected = false;
      let isLoggedIn = false;
      try {
        const statusRes = await client.get('/instance/status', {
          headers: { apikey: auth.token },
          timeout: 1500
        });
        const statusData = statusRes?.data?.data || statusRes?.data;
        isSocketConnected = Boolean(statusData?.Connected === true);
        isLoggedIn = Boolean(statusData?.LoggedIn === true);
      } catch (statusErr: any) {
        const stCode = statusErr.response?.status;
        if (stCode === 401 || stCode === 404) {
          console.log(`⚠️ [EvolutionGoEngine] Instancia "${instanceName}" no cargada en Evolution Go. Registrando...`);
          await this.createInstance(instanceName);
          auth = await this.resolveInstanceAuth(instanceName);
        }
      }

      // 4. Si ya inició sesión en WhatsApp en Go, sincronizar BD y responder
      if (isLoggedIn) {
        this.circuitBreaker.recordSuccess();
        await pool.query(
          "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1 OR name = $1",
          [instanceName]
        ).catch(() => {});
        return {
          success: true,
          engine: this.engineType,
          data: {
            qrcode: '',
            alreadyConnected: true,
            status: 'connected',
            state: 'connected',
            isConnected: true
          } as any,
          latencyMs: Date.now() - start
        };
      }

      // 5. Si ya tenemos un QR reciente válido en PostgreSQL, responder de inmediato (<15ms)
      if (auth.qrcode && auth.qrcode.length > 20) {
        this.circuitBreaker.recordSuccess();
        return EvolutionGoMapper.mapSuccess({ qrcode: auth.qrcode }, Date.now() - start);
      }

      // 6. Si el socket no está conectado en Go, lanzar /instance/connect con webhookUrl
      if (!isSocketConnected) {
        try {
          await client.post(
            '/instance/connect',
            {
              webhookUrl,
              subscribe: ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'PRESENCE', 'HISTORY_SYNC', 'CHAT_PRESENCE', 'CALL', 'CONNECTION', 'LABEL', 'CONTACT', 'GROUP', 'NEWSLETTER', 'QRCODE', 'BUTTON_CLICK', 'PICTURE', 'USER_ABOUT'],
              immediate: true
            },
            { headers: { apikey: auth.token }, timeout: 2500 }
          );
        } catch (connErr: any) {
          const errMsg = String(connErr.response?.data?.error || connErr.message || '');
          if (errMsg.includes('already logged in') || errMsg.includes('already connected')) {
            return {
              success: true,
              engine: this.engineType,
              data: {
                qrcode: '',
                alreadyConnected: true,
                status: 'connected',
                state: 'connected',
                isConnected: true
              } as any,
              latencyMs: Date.now() - start
            };
          }
        }
      }

      // 7. Polling ultra-rápido de /instance/qr (hasta 2 intentos con 600ms de pausa)
      let foundQr = '';
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          let response: any;
          try {
            response = await client.get('/instance/qr', {
              headers: { apikey: auth.token },
              timeout: 1800
            });
          } catch (qrErr: any) {
            if (qrErr.response?.status === 401 && auth.token !== globalKey) {
              response = await client.get('/instance/qr', {
                headers: { apikey: globalKey },
                timeout: 1800
              });
            } else {
              throw qrErr;
            }
          }

          const resData = response?.data?.data || response?.data;
          const rawQr = resData?.qrcode || resData?.Qrcode || resData?.base64 || response?.data?.qrcode;
          const cleanQr = rawQr ? String(rawQr).split('|')[0] : '';

          if (cleanQr && cleanQr.length > 20) {
            foundQr = cleanQr;
            break;
          }
        } catch (err: any) {
          const errMsg = String(err.response?.data?.error || err.message || '');
          if (errMsg.includes('already logged in') || errMsg.includes('already connected') || errMsg.includes('session already')) {
            this.circuitBreaker.recordSuccess();
            await pool.query(
              "UPDATE instances SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1 OR name = $1",
              [instanceName]
            ).catch(() => {});
            return {
              success: true,
              engine: this.engineType,
              data: {
                qrcode: '',
                alreadyConnected: true,
                status: 'connected',
                state: 'connected',
                isConnected: true
              } as any,
              latencyMs: Date.now() - start
            };
          }
        }

        // Consultar en BD si Whatsmeow ya persistió el QR por webhook en PostgreSQL
        try {
          const dbRes = await pool.query(
            "SELECT qrcode, connected, jid FROM instances WHERE instance_name = $1 OR name = $1 LIMIT 1",
            [instanceName]
          );
          if (dbRes.rows.length > 0) {
            const row = dbRes.rows[0];
            if (row.connected && row.jid) {
              return {
                success: true,
                engine: this.engineType,
                data: {
                  qrcode: '',
                  alreadyConnected: true,
                  status: 'connected',
                  state: 'connected',
                  isConnected: true
                } as any,
                latencyMs: Date.now() - start
              };
            }
            if (row.qrcode && String(row.qrcode).length > 20) {
              foundQr = String(row.qrcode).split('|')[0];
              break;
            }
          }
        } catch {}

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (foundQr) {
        await pool.query(
          "UPDATE instances SET qrcode = $1, status = 'connecting', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2 OR name = $2",
          [foundQr, instanceName]
        ).catch(() => {});
        this.circuitBreaker.recordSuccess();
        return EvolutionGoMapper.mapSuccess({ qrcode: foundQr }, Date.now() - start);
      }

      // 8. Si no está listo aún, NO bloquear por 30s ni responder 422:
      // Responder un 200 limpio con generating=true para que el frontend del cliente jamás sufra timeouts (latencia <2.5s)
      return {
        success: true,
        engine: this.engineType,
        data: {
          qrcode: '',
          generating: true,
          status: 'connecting',
          state: 'connecting',
          message: 'Inicializando canal seguro con WhatsApp. El código se está generando, pulsa "Actualizar QR" en unos segundos.'
        } as any,
        latencyMs: Date.now() - start
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async logout(instanceName: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);

      const response = await client.delete('/instance/logout', {
        headers: { apikey: auth.token }
      });

      await pool.query(
        "UPDATE instances SET status = 'logged_out', connected = false, jid = '', qrcode = '', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $1 OR name = $1",
        [instanceName]
      ).catch(() => {});

      const latencyMs = Date.now() - start;
      const success = response.status === 200 || response.status === 204;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(success, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async configureWebhook(instanceName: string, webhookUrl?: string): Promise<EngineResult<boolean>> {
    const start = Date.now();
    try {
      const url = webhookUrl || `${process.env.BACKEND_URL || 'https://api.zazaclick.sbs'}/api/webhooks/whatsapp`;
      await pool.query(
        "UPDATE instances SET webhook = $1, events = 'ALL', updated_at = CURRENT_TIMESTAMP WHERE instance_name = $2 OR name = $2",
        [url, instanceName]
      );
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapSuccess(true, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  /**
   * Control de Cadencia Industrial Anti-Baneo (Anti-Ban Pacing)
   * Espacia de manera inteligente las emisiones salientes de una misma instancia (mínimo 1.2s - 1.8s)
   * para evitar que los algoritmos de detección de spam de Meta/WhatsApp restrinjan o baneen el número.
   */
  private async applyAntiBanPacing(instanceName: string, minIntervalMs: number = 1200): Promise<void> {
    // No offline queue or unlimited wait on the critical path to the engine.
    if (redis.status !== 'ready') throw new Error('Pacing unavailable: Redis is not ready. No send attempted.');
    const interval = minIntervalMs + Math.floor(Math.random() * 300);
    const script = `
      local now = redis.call('TIME')
      local ms = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
      local slot = math.max(tonumber(redis.call('GET', KEYS[1]) or '0'), ms)
      local wait = slot - ms
      if wait > 6000 then return -1 end
      redis.call('SET', KEYS[1], slot + tonumber(ARGV[1]), 'PX', 30000)
      return wait
    `;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const wait = Number(await Promise.race([
        redis.eval(script, 1, `pacing:last_sent:${instanceName}`, String(interval)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Pacing timeout. No send attempted.')), 2000); })
      ]));
      if (!Number.isFinite(wait) || wait < 0 || wait > 6000) throw new Error('Pacing busy. No send attempted.');
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    } finally { if (timer) clearTimeout(timer); }
  }

  public async sendTextMessage(params: SendTextMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution Go debido a fallos continuos de red.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(params.instanceName);
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      await this.applyAntiBanPacing(params.instanceName);

      const response = await client.post('/send/text', {
        number: targetNumber,
        text: params.text
      }, {
        headers: { apikey: auth.token }
      });

      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        if (response.data?.success === false || response.data?.Success === false) {
          return EvolutionGoMapper.mapFailure({response: {status: 422, data: {message: 'El motor rechazó la operación.'}}}, latencyMs);
        }
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id || resData?.messageId;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendMediaMessage(params: SendMediaMessageParams): Promise<EngineResult> {
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_UNAVAILABLE',
          message: 'Circuito abierto para Evolution Go.',
          isRetryable: true,
          statusCode: 503
        }
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(params.instanceName);
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      let finalMedia = normalizeBase64(params.media);

      if (params.media.startsWith('http://') || params.media.startsWith('https://')) {
        const ssrfCheck = await validateSafeUrl(params.media);
        if (!ssrfCheck.safe) {
          return {
            success: false,
            engine: this.engineType,
            error: {
              code: 'ENGINE_INVALID_REQUEST',
              message: `Seguridad SSRF: ${ssrfCheck.error}`,
              isRetryable: false,
              statusCode: 400
            }
          };
        }
      }

      await this.applyAntiBanPacing(params.instanceName);

      const response = await client.post('/send/media', {
        number: targetNumber,
        url: finalMedia,
        media: finalMedia,
        type: params.mediatype,
        mediatype: params.mediatype,
        mimetype: params.mimetype,
        caption: params.caption,
        filename: params.fileName,
        fileName: params.fileName
      }, {
        headers: { apikey: auth.token }
      });

      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        if (response.data?.success === false || response.data?.Success === false) {
          return EvolutionGoMapper.mapFailure({response: {status: 422, data: {message: 'El motor rechazó la operación.'}}}, latencyMs);
        }
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id || resData?.messageId;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendAudioMessage(params: SendAudioMessageParams): Promise<EngineResult> {
    // Evolution Go maneja audio PTT a través de sendMedia con mediatype: 'audio'
    return this.sendMediaMessage({
      instanceName: params.instanceName,
      number: params.number,
      media: params.audio,
      mediatype: 'audio',
      mimetype: 'audio/mp4; codecs=opus'
    });
  }

  public async sendLocationMessage(params: SendLocationMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(params.instanceName);
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      await this.applyAntiBanPacing(params.instanceName);

      const response = await client.post('/send/location', {
        number: targetNumber,
        name: params.name,
        address: params.address,
        latitude: params.latitude,
        longitude: params.longitude
      }, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        if (response.data?.success === false || response.data?.Success === false) {
          return EvolutionGoMapper.mapFailure({response: {status: 422, data: {message: 'El motor rechazó la operación.'}}}, latencyMs);
        }
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id || resData?.messageId;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async sendContactMessage(params: SendContactMessageParams): Promise<EngineResult> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(params.instanceName);
      let targetNumber = params.number;
      if (!targetNumber.includes('@')) {
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
          cleanNumber = `51${cleanNumber}`;
        }
        targetNumber = cleanNumber;
      }

      await this.applyAntiBanPacing(params.instanceName);

      const response = await client.post('/send/contact', {
        number: targetNumber,
        contact: params.contact,
        vcard: params.contact
      }, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        if (response.data?.success === false || response.data?.Success === false) {
          return EvolutionGoMapper.mapFailure({response: {status: 422, data: {message: 'El motor rechazó la operación.'}}}, latencyMs);
        }
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id || resData?.messageId;
        return EvolutionGoMapper.mapSuccess(response.data, latencyMs, msgId);
      }

      return EvolutionGoMapper.mapFailure(response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getGroups(instanceName: string, getParticipants: boolean = true): Promise<EngineResult<any[]>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);
      const response = await client.get(`/group/list?getParticipants=${getParticipants}`, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;
      const data = response.data?.data || response.data || [];
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(Array.isArray(data) ? data : [], latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async createGroup(instanceName: string, subject: string, participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);
      const response = await client.post('/group/create', { subject, participants }, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async updateGroupParticipants(instanceName: string, groupJid: string, action: 'add' | 'remove' | 'promote' | 'demote', participants: string[]): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);
      const response = await client.post(`/group/participant?groupJid=${groupJid}`, {
        groupJid,
        action,
        participants
      }, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async getGroupInviteCode(instanceName: string, groupJid: string): Promise<EngineResult<any>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const auth = await this.resolveInstanceAuth(instanceName);
      const response = await client.get(`/group/invitelink?groupJid=${groupJid}`, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordSuccess();
      return EvolutionGoMapper.mapSuccess(response.data?.data || response.data, latencyMs);
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      this.circuitBreaker.recordFailure(err);
      return EvolutionGoMapper.mapFailure(err, latencyMs);
    }
  }

  public async healthCheck(): Promise<EngineHealth> {
    const isEnabled = process.env.EVOLUTION_GO_ENABLED === 'true';
    const isConfigured = Boolean(process.env.EVOLUTION_GO_URL && process.env.EVOLUTION_GO_API_KEY);

    if (!isEnabled) {
      return {
        engine: this.engineType,
        status: 'DISABLED',
        latencyMs: 0,
        configured: isConfigured,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: 'Evolution Go está deshabilitado en configuración (EVOLUTION_GO_ENABLED=false).'
      };
    }

    if (!isConfigured) {
      return {
        engine: this.engineType,
        status: 'NOT_CONFIGURED',
        latencyMs: 0,
        configured: false,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: 'EVOLUTION_GO_URL o EVOLUTION_GO_API_KEY no definidos.'
      };
    }

    const start = Date.now();
    try {
      const client = this.getClient();
      let response: any;
      try {
        response = await client.get('/instance/all', { timeout: 4000 });
      } catch {
        response = await client.get('/health', { timeout: 4000 });
      }
      const latencyMs = Date.now() - start;

      return {
        engine: this.engineType,
        status: (response.status === 200 || response.status === 204) ? 'ONLINE' : 'DEGRADED',
        latencyMs,
        version: response.data?.version || '1.0.0',
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        engine: this.engineType,
        status: 'OFFLINE',
        latencyMs,
        configured: true,
        lastCheck: new Date().toISOString(),
        capabilities: this.capabilities,
        error: err.message
      };
    }
  }
}

export const evolutionGoEngine = new EvolutionGoEngine();
