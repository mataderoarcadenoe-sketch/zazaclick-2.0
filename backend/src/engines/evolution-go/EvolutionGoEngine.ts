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
    const key = process.env.EVOLUTION_GO_API_KEY;
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
    return process.env.EVOLUTION_GO_API_KEY || 'F2C43224-3975-46EC-954A-FB335F5C9FDA';
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

      // Si existía una fila huérfana en BD que no está en la memoria de Evolution Go, eliminarla antes de que Go haga INSERT
      if (existing.id) {
        try {
          await client.delete(`/instance/delete/${existing.id}`, { headers: { apikey: globalKey } });
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

      // Primero desconectar/cerrar sesión si estaba activa
      if (auth.token) {
        try {
          await client.delete('/instance/logout', { headers: { apikey: auth.token } });
        } catch {}
      }

      let targetId = auth.id;
      if (!targetId) {
        try {
          const allRes = await client.get('/instance/all', { headers: { apikey: globalKey } });
          const list = Array.isArray(allRes.data?.data) ? allRes.data.data : [];
          const found = list.find((i: any) => i.name === instanceName);
          if (found?.id) targetId = found.id;
        } catch {}
      }

      if (targetId) {
        await client.delete(`/instance/delete/${targetId}`, { headers: { apikey: globalKey } });
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

      try {
        await client.post('/instance/reconnect', {}, { headers: { apikey: auth.token } });
      } catch {}

      // Esperar que whatsmeow restaure el socket
      let state = 'connecting';
      let isConnected = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
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

  public async getQRCode(instanceName: string): Promise<EngineResult<{ qrcode: string }>> {
    const start = Date.now();
    try {
      const client = this.getClient();
      let auth = await this.resolveInstanceAuth(instanceName);

      // 1. Si no existe en la base de datos o en Evolution Go, inicializarla una sola vez
      if (!auth.id) {
        await this.createInstance(instanceName);
        auth = await this.resolveInstanceAuth(instanceName);
      }

      // 2. Consultar el estado actual del socket en Evolution Go
      let isSocketConnected = false;
      let isLoggedIn = false;

      try {
        const statusRes = await client.get('/instance/status', {
          headers: { apikey: auth.token }
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

      // 3. Si ya inició sesión en WhatsApp, retornar alreadyConnected inmediatamente
      if (isLoggedIn || (auth.connected && auth.jid)) {
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

      // 4. CRÍTICO: Solo llamar a POST /instance/connect si el socket NO está ya abierto.
      // Llamar a /instance/connect cuando Connected === true envía una señal kill al socket en pleno escaneo de QR.
      if (!isSocketConnected) {
        try {
          await client.post(
            '/instance/connect',
            {
              subscribe: ['MESSAGE', 'READ_RECEIPT', 'PRESENCE', 'CHAT_PRESENCE', 'CALL'],
              immediate: false
            },
            { headers: { apikey: auth.token } }
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

      // 5. Obtener el QR activo sin reiniciar ni interrumpir el WebSocket (máx ~5 segundos)
      for (let attempt = 1; attempt <= 7; attempt++) {
        try {
          const response = await client.get('/instance/qr', {
            headers: { apikey: auth.token }
          });
          const resData = response?.data?.data || response?.data;
          const rawQr = resData?.qrcode || resData?.Qrcode || resData?.base64 || response?.data?.qrcode;
          const cleanQr = rawQr ? String(rawQr).split('|')[0] : '';

          if (cleanQr && cleanQr.length > 20) {
            this.circuitBreaker.recordSuccess();
            return EvolutionGoMapper.mapSuccess({ qrcode: cleanQr }, Date.now() - start);
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

        // Consultar en BD si Whatsmeow ya persistió el QR o completó el login
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
              const cleanDbQr = String(row.qrcode).split('|')[0];
              this.circuitBreaker.recordSuccess();
              return EvolutionGoMapper.mapSuccess({ qrcode: cleanDbQr }, Date.now() - start);
            }
          }
        } catch {}

        if (attempt < 7) {
          await new Promise(r => setTimeout(r, 700));
        }
      }

      return {
        success: false,
        engine: this.engineType,
        error: {
          code: 'ENGINE_SEND_FAILED',
          message: 'Generando código QR en Evolution Go. Por favor reintenta en unos segundos.',
          isRetryable: true,
          statusCode: 422
        },
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

      const response = await client.post('/send/text', {
        number: targetNumber,
        text: params.text
      }, {
        headers: { apikey: auth.token }
      });

      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
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
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
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
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
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

      const response = await client.post('/send/contact', {
        number: targetNumber,
        contact: params.contact,
        vcard: params.contact
      }, {
        headers: { apikey: auth.token }
      });
      const latencyMs = Date.now() - start;

      if (response.status === 200 || response.status === 201) {
        this.circuitBreaker.recordSuccess();
        const resData = response.data?.data || response.data;
        const msgId = resData?.Info?.ID || resData?.key?.id || resData?.id;
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
