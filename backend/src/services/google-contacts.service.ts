import { OAuth2Client } from 'google-auth-library';
import pool from '../config/database';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://zaza-click-20-production.up.railway.app/api/auth/google-contacts/callback';

export class GoogleContactsService {
  
  private static getOAuth2Client(): OAuth2Client {
    return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  /**
   * Generar la URL de autorización para el flujo OAuth2
   */
  public static getAuthUrl(state: string): string {
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/contacts'],
      prompt: 'consent',
      state: state // Guardamos el token de Zaza o userId para asociarlo en el callback
    });
  }

  /**
   * Intercambiar el código de autorización por tokens
   */
  public static async getTokensFromCode(code: string): Promise<any> {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Obtener un cliente OAuth2 autenticado y con token refrescado para el usuario
   */
  public static async getAuthenticatedClient(userId: string): Promise<OAuth2Client | null> {
    try {
      const res = await pool.query(
        'SELECT * FROM google_contacts_credentials WHERE user_id = $1',
        [userId]
      );

      if (res.rows.length === 0) {
        return null;
      }

      const creds = res.rows[0];
      const oauth2Client = this.getOAuth2Client();

      oauth2Client.setCredentials({
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
        expiry_date: Number(creds.expiry_date)
      });

      // Si el token expira pronto o ya expiró, refrescarlo
      const now = Date.now();
      if (Number(creds.expiry_date) <= now + 60000) {
        console.log(`🔄 [GoogleContacts] Refrescando token de acceso expirado para el usuario: ${userId}`);
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        const newAccessToken = credentials.access_token!;
        const newExpiryDate = credentials.expiry_date!;

        // Actualizar base de datos
        await pool.query(
          `UPDATE google_contacts_credentials 
           SET access_token = $1, expiry_date = $2, updated_at = NOW() 
           WHERE user_id = $3`,
          [newAccessToken, newExpiryDate, userId]
        );

        oauth2Client.setCredentials({
          access_token: newAccessToken,
          refresh_token: creds.refresh_token,
          expiry_date: newExpiryDate
        });
      }

      return oauth2Client;
    } catch (err: any) {
      console.error(`[GoogleContacts] Error al obtener cliente autenticado para el usuario ${userId}:`, err.message);
      return null;
    }
  }

  /**
   * Guardar o actualizar las credenciales de Google
   */
  public static async saveCredentials(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiryDate: number,
    googleEmail?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO google_contacts_credentials (user_id, access_token, refresh_token, expiry_date, google_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expiry_date = EXCLUDED.expiry_date,
         google_email = EXCLUDED.google_email,
         updated_at = NOW()`,
      [userId, accessToken, refreshToken, expiryDate, googleEmail]
    );
  }

  /**
   * Obtener lista de contactos de Google
   */
  public static async listContacts(userId: string): Promise<any[]> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) {
      throw new Error('Google Contactos no está conectado para este usuario.');
    }

    const accessToken = (await client.getAccessToken()).token;
    
    // Consultar Google People API
    const response = await axios.get(
      'https://people.googleapis.com/v1/people/me/connections',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          personFields: 'names,phoneNumbers,photos,metadata',
          pageSize: 1000,
          sortOrder: 'FIRST_NAME_ASCENDING'
        }
      }
    );

    const connections = response.data.connections || [];
    
    // Mapear respuesta a estructura limpia para nuestra UI
    return connections.map((person: any) => {
      const nameObj = person.names?.[0];
      const displayName = nameObj?.displayName || 'Sin Nombre';
      const givenName = nameObj?.givenName || '';
      const familyName = nameObj?.familyName || '';
      
      const phoneObj = person.phoneNumbers?.[0];
      const phoneNumber = phoneObj?.value || '';

      const photoObj = person.photos?.[0];
      const photoUrl = photoObj?.url || null;

      const resourceName = person.resourceName; // ID único de Google (ej: people/c12345)
      const etag = person.etag;

      return {
        resourceName,
        etag,
        displayName,
        givenName,
        familyName,
        phoneNumber,
        photoUrl
      };
    });
  }

  /**
   * Crear un nuevo contacto en Google
   */
  public static async createContact(userId: string, contact: { givenName: string; familyName?: string; phoneNumber: string }): Promise<any> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) {
      throw new Error('Google Contactos no está conectado.');
    }

    const accessToken = (await client.getAccessToken()).token;

    const payload = {
      names: [
        {
          givenName: contact.givenName,
          familyName: contact.familyName || ''
        }
      ],
      phoneNumbers: [
        {
          value: contact.phoneNumber,
          type: 'mobile'
        }
      ]
    };

    const response = await axios.post(
      'https://people.googleapis.com/v1/people:createContact',
      payload,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return response.data;
  }

  /**
   * Actualizar un contacto existente en Google
   */
  public static async updateContact(
    userId: string,
    resourceName: string,
    etag: string,
    contact: { givenName: string; familyName?: string; phoneNumber: string }
  ): Promise<any> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) {
      throw new Error('Google Contactos no está conectado.');
    }

    const accessToken = (await client.getAccessToken()).token;

    const payload = {
      etag,
      names: [
        {
          givenName: contact.givenName,
          familyName: contact.familyName || ''
        }
      ],
      phoneNumbers: [
        {
          value: contact.phoneNumber,
          type: 'mobile'
        }
      ]
    };

    const response = await axios.patch(
      `https://people.googleapis.com/v1/${resourceName}:updateContact`,
      payload,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          updatePersonFields: 'names,phoneNumbers'
        }
      }
    );

    return response.data;
  }

  /**
   * Eliminar un contacto en Google
   */
  public static async deleteContact(userId: string, resourceName: string): Promise<void> {
    const client = await this.getAuthenticatedClient(userId);
    if (!client) {
      throw new Error('Google Contactos no está conectado.');
    }

    const accessToken = (await client.getAccessToken()).token;

    await axios.delete(
      `https://people.googleapis.com/v1/${resourceName}:deleteContact`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
  }
}
