import axios from 'axios';
import * as dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import redis from '../config/redis';

dotenv.config();

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

if (!EVOLUTION_URL || !EVOLUTION_KEY) {
  console.warn('⚠️ [EvolutionService] EVOLUTION_API_URL o EVOLUTION_API_KEY no configurados.');
}

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'apikey': EVOLUTION_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 100 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 100 }),
});

export class EvolutionService {
  private static lidCache = new Map<string, string>();
  private static lastReadTimestamps = new Map<string, number>();

  /**
   * Extrae y formatea el mensaje de error de una excepción de Axios
   */
  private static parseError(err: any): string {
    if (err.response) {
      const data = err.response.data;
      if (data) {
        if (typeof data === 'string') {
          return data;
        }
        if (typeof data === 'object') {
          // NestJS/Evolution API anidan a veces el error en data.response (ej: response: { message: ["Invalid integration"] })
          const nested = data.response;
          let message = null;
          if (nested && typeof nested === 'object') {
            message = nested.message || nested.error || nested.err;
          }
          if (!message) {
            message = data.message || data.error || data.err;
          }

          if (message) {
            if (Array.isArray(message)) {
              return message.join(', ');
            }
            if (typeof message === 'object') {
              return JSON.stringify(message);
            }
            return String(message);
          }
        }
      }
      return `Error ${err.response.status}: ${err.response.statusText || 'Petición incorrecta'}`;
    }
    if (err.request) {
      return 'No se recibió respuesta del servidor de Evolution API. Verifica que esté en línea.';
    }
    return err.message;
  }

  /**
   * Crear una nueva instancia de WhatsApp para el cliente
   */
  public static async createInstance(instanceName: string): Promise<{ success: boolean; instance?: any; error?: string; status?: number }> {
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'https://zaza-click-20-production.up.railway.app';
      const response = await api.post('/instance/create', {
        instanceName,
        token: this.generateRandomToken(),
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: `${BACKEND_URL}/api/webhooks/whatsapp`,
        webhook_by_events: false,
        webhook_events: ['MESSAGES_UPSERT', 'CHATS_UPDATE', 'MESSAGES_UPDATE'],
        settings: {
          alwaysOnline: true,
          rejectCall: false,
          groupsIgnore: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false
        }
      });

      if (response.data?.instance) {
        const token = response.data.hash || response.data.instance.token || response.data.instance.apikey;
        return {
          success: true,
          instance: {
            ...response.data.instance,
            token
          }
        };
      }
      return { success: false, error: 'Respuesta inválida de Evolution API', status: 502 };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      const status = err.response?.status || 500;
      console.error(`[EvolutionService] Error creando instancia ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status };
    }
  }

  /**
   * Obtener el estado actual de la conexión (connected, disconnected, etc.)
   */
  public static async getConnectionState(instanceName: string): Promise<string> {
    try {
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      return response.data?.instance?.state || 'disconnected';
    } catch (err: any) {
      // Si devuelve 404, asumimos que no existe o está desconectada
      return 'disconnected';
    }
  }

  /**
   * Obtener el código QR en Base64 o JSON para escanear
   */
  public static async getQRCode(instanceName: string): Promise<{ success: boolean; qrcode?: string; error?: string }> {
    try {
      const response = await api.get(`/instance/connect/${instanceName}`);
      if (response.data?.base64) {
        return { success: true, qrcode: response.data.base64 };
      }
      return { success: false, error: 'No se generó el código QR' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Cerrar sesión (Logout) del número sin eliminar la instancia
   */
  public static async logout(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/logout/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Eliminar por completo la instancia de Evolution API
   */
  public static async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await api.delete(`/instance/delete/${instanceName}`);
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Enviar un mensaje de texto a través de una instancia específica
   */
  public static async sendTextMessage(instanceName: string, number: string, text: string): Promise<boolean> {
    try {
      let cleanNumber = number.replace(/\D/g, '');
      if (cleanNumber.length === 9 && cleanNumber.startsWith('9')) {
        cleanNumber = `51${cleanNumber}`;
      }
      const response = await api.post(`/message/sendText/${instanceName}`, {
        number: cleanNumber,
        text: text,
      });
      return response.status === 200 || response.status === 201;
    } catch (err: any) {
      console.error(`[EvolutionService] Error enviando mensaje a ${number}:`, err.message);
      return false;
    }
  }

  /**
   * Obtener el estado actual de la licencia de Evolution API
   */
  public static async getLicenseStatus(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get('/license/status');
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error obteniendo estado de licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generar la URL de registro de licencia
   */
  public static async registerLicense(redirectUri: string): Promise<{ success: boolean; registerUrl?: string; error?: string }> {
    try {
      const response = await api.get(`/license/register?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (response.data?.register_url || response.data?.url) {
        return { success: true, registerUrl: response.data.register_url || response.data.url };
      }
      return { success: false, error: 'No se generó la URL de registro.' };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error registrando licencia:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Activar la licencia usando el código de callback
   */
  public static async activateLicense(code: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.get(`/license/activate?code=${code}`);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error('[EvolutionService] Error activando licencia con código:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener chats activos de la instancia
   */
  public static async getChats(instanceName: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/chat/findChats/${instanceName}`, {});
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo chats para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Obtener mensajes de un chat específico
   */
  public static async getChatMessages(instanceName: string, remoteJid: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    try {
      const response = await api.post(`/chat/findMessages/${instanceName}`, {
        where: {
          key: {
            remoteJid: remoteJid
          }
        },
        limit: 100
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo mensajes para ${instanceName}:`, errorMsg);
      return { success: false, error: errorMsg, status: err.response?.status };
    }
  }

  /**
   * Obtener el Base64 de un archivo multimedia
   */
  public static async getMediaMessageBase64(instanceName: string, messageKey: any, messageContent: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await api.post(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: messageKey,
          message: messageContent
        }
      });
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error obteniendo base64 de multimedia:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generador de tokens aleatorios para asegurar las instancias de los clientes
   */
  private static generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Resuelve un LID de WhatsApp (@lid) a su número de teléfono real (@s.whatsapp.net) llamando a fetchProfile
   */
  public static async resolveLidToPhone(instanceName: string, lid: string): Promise<string> {
    try {
      if (this.lidCache.has(lid)) {
        return this.lidCache.get(lid)!;
      }

      console.log(`[EvolutionService] Resolviendo LID ${lid} a teléfono real mediante API...`);
      const response = await api.post(`/chat/fetchProfile/${instanceName}`, {
        number: lid
      });

      const resolvedJid = response.data?.jid || response.data?.remoteJid || response.data?.id;
      if (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) {
        this.lidCache.set(lid, resolvedJid);
        console.log(`[EvolutionService] LID ${lid} resuelto exitosamente a ${resolvedJid}`);
        return resolvedJid;
      }
      
      // Si la API respondió pero no trajo un JID válido de teléfono, guardamos el LID en caché apuntando a sí mismo (evita reintentos infinitos)
      this.lidCache.set(lid, lid);
      return lid;
    } catch (err: any) {
      console.warn(`[EvolutionService] No se pudo resolver el LID ${lid}:`, err.message);
      // Guardar en caché el error para evitar reintentar en el próximo polling
      this.lidCache.set(lid, lid);
      return lid;
    }
  }

  /**
   * Unificar chats @lid con sus números reales para evitar conversaciones duplicadas
   */
  public static mergeChats(instanceName: string, chats: any[], dbUnreadCounts?: Map<string, number>): any[] {
    const mergedMap = new Map<string, any>();

    for (const chat of chats) {
      if (!chat || !chat.remoteJid) continue;
      if (chat.remoteJid === 'status@broadcast') continue;

      let realJid = chat.remoteJid;

      // Limpiar el sufijo de puerto :0 si existe
      if (realJid.includes(':0@s.whatsapp.net')) {
        realJid = realJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
      }

      // Si es un @lid, intentamos obtener su número real de múltiples lugares posibles
      if (realJid.endsWith('@lid')) {
        if (chat.remoteJidAlt && chat.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.remoteJidAlt;
        } else if (chat.jidAlt && chat.jidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.jidAlt;
        } else if (chat.lastMessage?.key?.remoteJidAlt && chat.lastMessage.key.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.lastMessage.key.remoteJidAlt;
        } else if (chat.lastMessage?.remoteJidAlt && chat.lastMessage.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.lastMessage.remoteJidAlt;
        } else if (chat.contact?.remoteJidAlt && chat.contact.remoteJidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.remoteJidAlt;
        } else if (chat.contact?.jidAlt && chat.contact.jidAlt.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.jidAlt;
        } else if (chat.contact?.id && chat.contact.id.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.id;
        } else if (chat.contact?.remoteJid && chat.contact.remoteJid.endsWith('@s.whatsapp.net')) {
          realJid = chat.contact.remoteJid;
        } else if (this.lidCache.has(realJid)) {
          realJid = this.lidCache.get(realJid)!;
        } else {
          // Lanzar resolución en segundo plano sin await para no colgar la UI del usuario
          const currentLid = realJid;
          this.resolveLidToPhone(instanceName, currentLid).catch(err => {
            console.warn(`[EvolutionService] Error en resolución background de LID ${currentLid}:`, err.message);
          });
        }
      }
      
      // Volver a limpiar por si el JID resuelto vino con :0
      if (realJid.includes(':0@s.whatsapp.net')) {
        realJid = realJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
      }

      // Obtener el contador de mensajes no leídos tolerando la base de datos de Zaza o la API de Evolution
      let unreadCountNum = 0;
      if (dbUnreadCounts) {
        const countReal = dbUnreadCounts.get(realJid) || 0;
        const countOrig = dbUnreadCounts.get(chat.remoteJid) || 0;
        unreadCountNum = Math.max(countReal, countOrig);
      } else {
        const chatUnread = (chat.unreadMessages !== undefined && chat.unreadMessages !== null) 
          ? chat.unreadMessages 
          : chat.unreadCount;
        unreadCountNum = Number(chatUnread) || 0;
      }

      // Aplicar el override del contador de mensajes no leídos si el último mensaje es anterior al timestamp de lectura marcado
      const cacheKeyReal = `${instanceName}:${realJid}`;
      const cacheKeyOrig = `${instanceName}:${chat.remoteJid}`;
      const lastReadReal = this.lastReadTimestamps.get(cacheKeyReal);
      const lastReadOrig = this.lastReadTimestamps.get(cacheKeyOrig);
      
      const lastRead = lastReadReal !== undefined ? lastReadReal : lastReadOrig;
      
      let finalUnreadCount = unreadCountNum;
      if (lastRead !== undefined) {
        let lastMsgTimestamp = chat.lastMessage?.messageTimestamp || 0;
        if (lastMsgTimestamp > 0 && lastMsgTimestamp < 10000000000) {
          // Convertir segundos a milisegundos
          lastMsgTimestamp = lastMsgTimestamp * 1000;
        }

        if (lastMsgTimestamp <= lastRead) {
          finalUnreadCount = 0;
        } else {
          // Ha llegado un mensaje nuevo después de marcar como leído, borrar caché
          this.lastReadTimestamps.delete(cacheKeyReal);
          this.lastReadTimestamps.delete(cacheKeyOrig);
        }
      }

      const existing = mergedMap.get(realJid);
      
      if (!existing) {
        // Primer vez que vemos este JID real
        const newChat = { 
          ...chat, 
          remoteJid: realJid, 
          originalJid: chat.remoteJid,
          unreadCount: finalUnreadCount
        };
        mergedMap.set(realJid, newChat);
      } else {
        // Fusionar si ya existía
        const currentTs = chat.lastMessage?.messageTimestamp || 0;
        const existingTs = existing.lastMessage?.messageTimestamp || 0;
        
        // Tomar el valor máximo en lugar de sumar para evitar duplicar el contador si ambos registros de chat lo traen
        const totalUnread = Math.max(Number(existing.unreadCount) || 0, finalUnreadCount);
        
        if (currentTs > existingTs) {
          const merged = { 
            ...chat, 
            remoteJid: realJid,
            originalJid: chat.remoteJid,
            profilePicUrl: chat.profilePicUrl || existing.profilePicUrl,
            pushName: chat.pushName || existing.pushName,
            unreadCount: totalUnread
          };
          mergedMap.set(realJid, merged);
        } else {
          existing.profilePicUrl = existing.profilePicUrl || chat.profilePicUrl;
          existing.pushName = existing.pushName || chat.pushName;
          existing.unreadCount = totalUnread;
          mergedMap.set(realJid, existing);
        }
      }
    }

    // Ordenar por el timestamp del último mensaje de forma descendente
    return Array.from(mergedMap.values()).sort((a, b) => {
      const tsA = a.lastMessage?.messageTimestamp || 0;
      const tsB = b.lastMessage?.messageTimestamp || 0;
      return tsB - tsA;
    });
  }

  /**
   * Registrar manualmente un timestamp de lectura para un JID (tanto original como unificado)
   */
  public static recordReadTimestamp(instanceName: string, remoteJid: string): void {
    let unifiedJid = remoteJid;
    if (unifiedJid.endsWith('@lid') && this.lidCache.has(unifiedJid)) {
      unifiedJid = this.lidCache.get(unifiedJid)!;
    }
    if (unifiedJid.includes(':0@s.whatsapp.net')) {
      unifiedJid = unifiedJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
    }

    const nowInMs = Date.now() + 2000; // Guardar en milisegundos con 2 segundos de margen
    this.lastReadTimestamps.set(`${instanceName}:${remoteJid}`, nowInMs);
    this.lastReadTimestamps.set(`${instanceName}:${unifiedJid}`, nowInMs);
    
    // Resetear contadores de no leídos en Redis al instante
    redis.set(`unread:${instanceName}:${remoteJid}`, 0).catch(err => console.error('[Redis] Error al resetear JID:', err.message));
    redis.set(`unread:${instanceName}:${unifiedJid}`, 0).catch(err => console.error('[Redis] Error al resetear JID unificado:', err.message));
    
    console.log(`[EvolutionService] Registrada marca de lectura para ${instanceName}:${remoteJid} / ${unifiedJid} a las ${nowInMs}`);
  }

  /**
   * Marcar mensajes como leídos
   */
  public static async markMessagesAsRead(instanceName: string, remoteJid: string, messageIds: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Resolver el JID unificado (teléfono real) para que coincida exactamente con las claves de mensajes de la base de datos de Evolution
      let unifiedJid = remoteJid;
      if (unifiedJid.endsWith('@lid') && this.lidCache.has(unifiedJid)) {
        unifiedJid = this.lidCache.get(unifiedJid)!;
      }
      if (unifiedJid.includes(':0@s.whatsapp.net')) {
        unifiedJid = unifiedJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
      }

      const readMessages: any[] = [];
      for (const id of messageIds) {
        readMessages.push({
          remoteJid: remoteJid, // JID original (puede ser LID)
          id,
          fromMe: false
        });
        if (unifiedJid !== remoteJid) {
          readMessages.push({
            remoteJid: unifiedJid, // JID unificado (teléfono)
            id,
            fromMe: false
          });
        }
      }
      
      const response = await api.post(`/chat/markMessageAsRead/${instanceName}`, {
        readMessages
      });

      // Guardar el timestamp actual de lectura
      this.recordReadTimestamp(instanceName, remoteJid);

      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMsg = this.parseError(err);
      console.error(`[EvolutionService] Error marcando mensajes como leídos para ${remoteJid}:`, errorMsg);
      
      // Registrar de todos modos de manera preventiva por si la API falla pero queremos limpiar la UI
      this.recordReadTimestamp(instanceName, remoteJid);
      
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtener los contadores de mensajes no leídos agrupados por remoteJid llamando a findMessages de la API (evita acceso directo a Postgres)
   */
  public static async getUnreadCountsFromApi(instanceName: string): Promise<Map<string, number>> {
    const unreadMap = new Map<string, number>();
    try {
      const pattern = `unread:${instanceName}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        // Consultar de forma masiva en pipeline para máxima velocidad (1ms)
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.get(key);
        }
        const results = await pipeline.exec();

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const val = results ? results[i][1] : null;
          const remoteJid = key.replace(`unread:${instanceName}:`, '');
          const count = Number(val) || 0;
          if (count > 0) {
            unreadMap.set(remoteJid, count);
          }
        }
      } else {
        // Fallback: Si Redis está vacío (ej: reinicio), poblar desde findMessages de la API
        console.log(`ℹ️ [Redis] Inicializando caché de no leídos para ${instanceName} desde mensajes históricos...`);
        const msgsResult = await api.post(`/chat/findMessages/${instanceName}`, { limit: 300 });
        const records = msgsResult.data?.messages?.records || msgsResult.data?.records || msgsResult.data || [];
        if (Array.isArray(records)) {
          const pipeline = redis.pipeline();
          for (const msg of records) {
            if (msg.key && msg.key.fromMe === false && msg.status !== 'READ') {
              const jid = msg.key.remoteJid;
              if (jid) {
                let cleanJid = jid;
                if (cleanJid.includes(':0@s.whatsapp.net')) {
                  cleanJid = cleanJid.replace(':0@s.whatsapp.net', '@s.whatsapp.net');
                }
                const redisKey = `unread:${instanceName}:${cleanJid}`;
                pipeline.incr(redisKey);
              }
            }
          }
          await pipeline.exec();

          // Obtener los datos recién ingresados a Redis
          const newKeys = await redis.keys(pattern);
          if (newKeys.length > 0) {
            const getPipeline = redis.pipeline();
            newKeys.forEach(k => getPipeline.get(k));
            const vals = await getPipeline.exec();
            for (let i = 0; i < newKeys.length; i++) {
              const rJid = newKeys[i].replace(`unread:${instanceName}:`, '');
              const count = Number(vals ? vals[i][1] : 0) || 0;
              unreadMap.set(rJid, count);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[EvolutionService] Error en getUnreadCountsFromApi (Redis):', err.message);
    }
    return unreadMap;
  }

  /**
   * Configurar webhook para una instancia existente en Evolution API
   */
  public static async configureWebhook(instanceName: string): Promise<boolean> {
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'https://zaza-click-20-production.up.railway.app';
      const response = await api.post(`/webhook/set/${instanceName}`, {
        enabled: true,
        url: `${BACKEND_URL}/api/webhooks/whatsapp`,
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT',
          'CHATS_UPDATE',
          'MESSAGES_UPDATE'
        ]
      });
      return response.status === 200 || response.data?.success === true;
    } catch (err: any) {
      console.error(`[EvolutionService] Error configurando webhook para ${instanceName}:`, err.message);
      return false;
    }
  }
}
