import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com';

const client = new OAuth2Client(CLIENT_ID);

export class GoogleService {
  /**
   * Verificar y decodificar el token de identidad JWT provisto por Google
   */
  public static async verifyToken(token: string): Promise<{ email: string; email_verified?: boolean; name?: string; picture?: string } | null> {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (payload && payload.email) {
        return {
          email: payload.email,
          email_verified: payload.email_verified,
          name: payload.name,
          picture: payload.picture
        };
      }
      
      return null;
    } catch (err: any) {
      console.error('[GoogleService] Error verificando token de Google:', err.message);
      return null;
    }
  }
}
