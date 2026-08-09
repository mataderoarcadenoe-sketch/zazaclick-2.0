import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import redis from '../config/redis';

const router = Router();
router.use(authMiddleware);

/**
 * Calcula la distancia de Levenshtein entre dos cadenas de texto.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (let i = 0; i <= alen; i++) tmp[i] = [i];
  for (let j = 0; j <= blen; j++) tmp[0][j] = j;
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

/**
 * Normaliza y compara palabras individuales permitiendo pequeños errores ortográficos.
 */
function fuzzyMatch(text: string, query: string): boolean {
  // Quitar acentos, convertir a minúsculas y limpiar caracteres raros
  const normText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const normQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (!normQuery) return true;
  if (normText.includes(normQuery)) return true;
  
  const textWords = normText.split(/[\s,.-]+/);
  const queryWords = normQuery.split(/[\s,.-]+/);
  
  // Cada palabra en la consulta de búsqueda debe tener alguna coincidencia aceptable
  for (const qWord of queryWords) {
    if (!qWord) continue;
    
    // Si la palabra es muy corta (1 o 2 letras), buscamos coincidencia exacta de subcadena
    if (qWord.length <= 2) {
      if (textWords.some(tWord => tWord.includes(qWord))) continue;
      return false;
    }
    
    let wordMatched = false;
    for (const tWord of textWords) {
      // Coincidencia de subcadena directa (ej: "shampu" contiene "sham")
      if (tWord.includes(qWord) || qWord.includes(tWord)) {
        wordMatched = true;
        break;
      }
      
      // Calcular distancia de edición para tolerar errores (typos)
      const dist = getLevenshteinDistance(tWord, qWord);
      // Permitimos distancia de 1 para palabras medianas (3-5 letras) y 2 para palabras largas (>5 letras)
      const maxAllowedDist = qWord.length > 5 ? 2 : 1;
      
      if (dist <= maxAllowedDist) {
        wordMatched = true;
        break;
      }
    }
    if (!wordMatched) return false;
  }
  return true;
}

// Token por defecto provisto por el usuario
const APIPERU_TOKEN = process.env.APIPERU_TOKEN || '76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b';

// Helper to resolve LID to real phone number using Evolution API Connection
async function getRealPhoneIfNeeded(userId: string | undefined, phone: string): Promise<string> {
  const cleanPhone = phone.split('@')[0].split(':')[0];
  if (!userId) return cleanPhone;
  const isLid = cleanPhone.startsWith('1000') && cleanPhone.length >= 13;
  if (isLid) {
    try {
      const userCheck = await pool.query("SELECT parent_id FROM users WHERE id = $1", [userId]);
      const parentId = userCheck.rows[0]?.parent_id || userId;
      const instRes = await pool.query(
        "SELECT instance_name FROM instances WHERE user_id = $1 LIMIT 1",
        [parentId]
      );
      if (instRes.rows.length > 0) {
        const instanceName = instRes.rows[0].instance_name;
        const { EvolutionService } = require('../services/evolution.service');
        const resolvedJid = await EvolutionService.resolveLidToPhone(instanceName, cleanPhone + '@lid');
        if (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) {
          const resolvedPhone = resolvedJid.split('@')[0];
          console.log(`[CRM Routes] Resolved LID ${cleanPhone} to real phone ${resolvedPhone}`);
          return resolvedPhone;
        }
      }
    } catch (err: any) {
      console.warn(`[CRM Routes] Error resolving LID ${phone}:`, err.message);
    }
  }
  return cleanPhone;
}


/**
 * GET /api/crm/categories - Listar categorías de contacto
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM crm_contact_categories WHERE user_id = $1 ORDER BY id ASC',
      [req.userId]
    );

    let categories = result.rows;

    // Si no existen categorías para el usuario, creamos las 3 por defecto
    if (categories.length === 0) {
      const defaultNames = ['Contacto Primario', 'Contacto Secundario', 'Contacto de Empresa (Trabajo)'];
      for (const name of defaultNames) {
        await pool.query(
          'INSERT INTO crm_contact_categories (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.userId, name]
        );
      }
      const refetched = await pool.query(
        'SELECT id, name FROM crm_contact_categories WHERE user_id = $1 ORDER BY id ASC',
        [req.userId]
      );
      categories = refetched.rows;
    }

    return res.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('[CRM Categories] Error en GET /categories:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener categorías.' });
  }
});

/**
 * POST /api/crm/categories - Crear una categoría personalizada
 */
router.post('/categories', async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'El nombre de la categoría es requerido.' });
  }

  try {
    const check = await pool.query(
      'SELECT id FROM crm_contact_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [req.userId, name.trim()]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'La categoría ya existe.' });
    }

    const result = await pool.query(
      'INSERT INTO crm_contact_categories (user_id, name) VALUES ($1, $2) RETURNING id, name',
      [req.userId, name.trim()]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[CRM Categories] Error en POST /categories:', error.message);
    return res.status(500).json({ success: false, error: 'Error al crear categoría.' });
  }
});

/**
 * PUT /api/crm/categories/:id - Editar/Renombrar categoría
 */
router.put('/categories/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'El nuevo nombre es requerido.' });
  }

  try {
    // Verificar propiedad
    const verify = await pool.query(
      'SELECT id FROM crm_contact_categories WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (verify.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Categoría no encontrada o no autorizada.' });
    }

    const check = await pool.query(
      'SELECT id FROM crm_contact_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [req.userId, name.trim(), id]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Ya existe otra categoría con ese nombre.' });
    }

    const result = await pool.query(
      'UPDATE crm_contact_categories SET name = $1 WHERE id = $2 RETURNING id, name',
      [name.trim(), id]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[CRM Categories] Error en PUT /categories/:id:', error.message);
    return res.status(500).json({ success: false, error: 'Error al actualizar la categoría.' });
  }
});

/**
 * DELETE /api/crm/categories/:id - Permite eliminar una categoría
 */
router.delete('/categories/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Verificar propiedad
    const verify = await pool.query(
      'SELECT id FROM crm_contact_categories WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (verify.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Categoría no encontrada o no autorizada.' });
    }

    // Eliminar la categoría
    await pool.query('DELETE FROM crm_contact_categories WHERE id = $1', [id]);

    return res.json({ success: true, message: 'Categoría eliminada con éxito.' });
  } catch (error: any) {
    console.error('[CRM Categories] Error en DELETE /categories/:id:', error.message);
    return res.status(500).json({ success: false, error: 'Error al eliminar la categoría.' });
  }
});

/**
 * POST /api/crm/validate-doc - Consultar DNI o RUC en APIPerú
 */
router.post('/validate-doc', async (req: AuthenticatedRequest, res: Response) => {
  const { docNumber } = req.body;
  if (!docNumber || (docNumber.length !== 8 && docNumber.length !== 11)) {
    return res.status(400).json({ success: false, error: 'Número de documento inválido. Debe tener 8 dígitos (DNI) u 11 dígitos (RUC).' });
  }

  try {
    if (docNumber.length === 8) {
      // DNI
      console.log(`[APIPeru] Consultando DNI: ${docNumber}`);
      const response = await axios.post(
        'https://api.apiperu.dev/dni',
        { dni: docNumber },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIPERU_TOKEN}`
          },
          timeout: 7000
        }
      );

      if (response.data && response.data.success) {
        return res.json({
          success: true,
          docType: 'DNI',
          docNumber: docNumber,
          name: response.data.data.nombre_completo,
          address: ''
        });
      } else {
        return res.status(404).json({ success: false, error: response.data?.message || 'DNI no encontrado en APIPerú.' });
      }
    } else {
      // RUC
      console.log(`[APIPeru] Consultando RUC: ${docNumber}`);
      const response = await axios.post(
        'https://api.apiperu.dev/ruc',
        { ruc: docNumber },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIPERU_TOKEN}`
          },
          timeout: 7000
        }
      );

      if (response.data && response.data.success) {
        const d = response.data.data;
        const completeAddress = [d.direccion, d.departamento].filter(Boolean).join(', ');
        return res.json({
          success: true,
          docType: 'RUC',
          docNumber: docNumber,
          name: d.nombre_o_razon_social,
          address: completeAddress || ''
        });
      } else {
        return res.status(404).json({ success: false, error: response.data?.message || 'RUC no encontrado en APIPerú.' });
      }
    }
  } catch (error: any) {
    console.error('[CRM APIPeru] Error en /validate-doc:', error.response?.data || error.message);
    const apiMsg = error.response?.data?.message || 'Error de comunicación con APIPerú.';
    return res.status(error.response?.status || 500).json({ success: false, error: apiMsg });
  }
});

/**
 * GET /api/crm/contacts/map - Obtener un mapa de { phoneNumber: clientName } para la UI de chats
 */
router.get('/contacts/map', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mapRes = await pool.query(
      `SELECT c.phone_number, cl.name
       FROM crm_contacts c
       INNER JOIN crm_clients cl ON c.client_id = cl.id
       WHERE c.user_id = $1`,
      [req.userId]
    );

    const contactMap: Record<string, string> = {};
    for (const row of mapRes.rows) {
      if (row.phone_number) {
        const cleanPhone = row.phone_number.split('@')[0].split(':')[0].replace('+', '');
        contactMap[cleanPhone] = row.name;
      }
    }

    return res.json({ success: true, data: contactMap });
  } catch (error: any) {
    console.error('[CRM Contacts Map] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener mapa de contactos CRM' });
  }
});

/**
 * GET /api/crm/contacts/tags-map - Obtener mapa de etiquetas de todos los contactos
 */
router.get('/contacts/tags-map', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT phone_number, tags FROM crm_contacts WHERE user_id = $1',
      [req.userId]
    );
    const tagsMap: Record<string, string[]> = {};
    result.rows.forEach(row => {
      const cleanPhone = row.phone_number.split(':')[0];
      let tgs = row.tags;
      if (typeof tgs === 'string') {
        try { tgs = JSON.parse(tgs); } catch(e) { tgs = []; }
      }
      tagsMap[cleanPhone] = Array.isArray(tgs) ? tgs : [];
    });
    return res.json({ success: true, data: tagsMap });
  } catch (error: any) {
    console.error('[CRM Tags Map] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener mapa de etiquetas.' });
  }
});

/**
 * GET /api/crm/contacts/agents-map - Obtener mapa de asignación de asesores
 */
router.get('/contacts/agents-map', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT c.phone_number, u.id as agent_id, ap.name as agent_name, ap.status as agent_status
      FROM crm_contacts c
      JOIN users u ON c.assigned_agent_id = u.id
      JOIN agent_profiles ap ON u.id = ap.user_id
      WHERE c.user_id = $1
    `, [req.userId]);

    const agentsMap: Record<string, { id: string, name: string, status: string }> = {};
    result.rows.forEach(row => {
      const cleanPhone = row.phone_number.split(':')[0];
      agentsMap[cleanPhone] = {
        id: row.agent_id,
        name: row.agent_name,
        status: row.agent_status
      };
    });

    return res.json({ success: true, data: agentsMap });
  } catch (error: any) {
    console.error('[CRM Agents Map] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener mapa de asignación de colaboradores.' });
  }
});

/**
 * GET /api/crm/contacts/:phoneNumber - Buscar cliente y datos de contacto de una línea
 */
router.get('/contacts/:phoneNumber', async (req: AuthenticatedRequest, res: Response) => {
  const { phoneNumber } = req.params;
  const cleanPhone = phoneNumber.split(':')[0];

  try {
    const resolvedPhone = await getRealPhoneIfNeeded(req.userId, cleanPhone);

    // Buscar contacto activo (con fallback para LID o real)
    const contactRes = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND (c.phone_number = $2 OR c.phone_number = $3)`,
      [req.userId, cleanPhone, resolvedPhone]
    );

    if (contactRes.rows.length > 0) {
      const contact = contactRes.rows[0];
      // Auto-actualizar LID a número real en DB si cambió
      if (contact.phone_number.startsWith('1000') && resolvedPhone && resolvedPhone !== contact.phone_number) {
        try {
          await pool.query(
            'UPDATE crm_contacts SET phone_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [resolvedPhone, contact.id]
          );
          contact.phone_number = resolvedPhone;
          console.log(`[CRM GET Contact] Auto-updated contact ID ${contact.id} from LID ${cleanPhone} to real number ${resolvedPhone}`);
        } catch (err: any) {
          console.warn(`[CRM GET Contact] Error auto-updating LID:`, err.message);
        }
      }
    }
if (contactRes.rows.length === 0) {
      return res.json({ success: true, contact: null, client: null });
    }

    const contact = contactRes.rows[0];
    if (contact && typeof contact.tags === 'string') {
      try { contact.tags = JSON.parse(contact.tags); } catch(e) { contact.tags = []; }
    }

    // Buscar cliente asociado
    const clientRes = await pool.query(
      'SELECT * FROM crm_clients WHERE user_id = $1 AND id = $2',
      [req.userId, contact.client_id]
    );

    // Buscar notas asociadas ordenadas por fecha desc
    let notes: any[] = [];
    if (contact.client_id) {
      const notesRes = await pool.query(
        `SELECT n.*, COALESCE(ap.name, u.email) as agent_name 
         FROM crm_client_notes n
         LEFT JOIN users u ON n.agent_id = u.id
         LEFT JOIN agent_profiles ap ON u.id = ap.user_id
         WHERE n.user_id = $1 AND n.client_id = $2
         ORDER BY n.created_at DESC`,
        [req.userId, contact.client_id]
      );
      notes = notesRes.rows;
    }

    return res.json({
      success: true,
      contact,
      client: clientRes.rows[0] || null,
      notes
    });
  } catch (error: any) {
    console.error('[CRM Contacts] Error en GET /contacts/:phoneNumber:', error.message);
    return res.status(500).json({ success: false, error: 'Error al buscar contacto.' });
  }
});

/**
 * POST /api/crm/link-doc - Crear o asociar un cliente (DNI/RUC) a un chat de WhatsApp con lógica de fusión
 */
router.post('/link-doc', async (req: AuthenticatedRequest, res: Response) => {
  const { phone_number, doc_type, doc_number, name, address, email, notes, categoryId, mergeAction, birthday, idioma } = req.body;

  if (!phone_number || !doc_type || !doc_number || !name) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phone_number, doc_type, doc_number, name).' });
  }

  try {
    const resolvedPhone = await getRealPhoneIfNeeded(req.userId, phone_number);
    // 1. Verificar si el DNI/RUC ya existe para este user_id
    const clientCheck = await pool.query(
      'SELECT id, name FROM crm_clients WHERE user_id = $1 AND doc_type = $2 AND doc_number = $3',
      [req.userId, doc_type, doc_number]
    );

    let clientId: number;
    let isMerged = false;

    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      isMerged = true;

      // Actualizar datos del cliente (dirección, notas, email opcionales)
      await pool.query(
        `UPDATE crm_clients 
         SET name = $1, address = COALESCE($2, address), email = COALESCE($3, email), notes = COALESCE($4, notes), birthday = COALESCE($5, birthday), idioma = COALESCE($6, idioma), updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [name, address || null, email || null, notes || null, birthday || null, idioma || null, clientId]
      );

      // Aplicar acción de fusión si hay conflicto de número
      if (mergeAction === 'promote') {
        // Opción 1: Nuevo primario. Degradar los anteriores activos a 'secondary'
        const secCat = await pool.query(
          "SELECT id FROM crm_contact_categories WHERE user_id = $1 AND name = 'Contacto Secundario'",
          [req.userId]
        );
        const secCatId = secCat.rows[0]?.id || null;

        await pool.query(
          'UPDATE crm_contacts SET category_id = $1 WHERE client_id = $2 AND user_id = $3',
          [secCatId, clientId, req.userId]
        );

        const primCat = await pool.query(
          "SELECT id FROM crm_contact_categories WHERE user_id = $1 AND name = 'Contacto Primario'",
          [req.userId]
        );
        const primCatId = categoryId || primCat.rows[0]?.id || null;

        await pool.query(
          `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
            VALUES ($1, $2, $3, $4, true) 
            ON CONFLICT (user_id, phone_number) 
            DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP` 
          , 
          [clientId, req.userId, resolvedPhone, primCatId]
        );

      } else if (mergeAction === 'deactivate') {
        // Opción 3: Desactivar los números anteriores vinculados a este cliente
        await pool.query(
          'UPDATE crm_contacts SET is_active = false WHERE client_id = $1 AND user_id = $2',
          [clientId, req.userId]
        );

        const primCat = await pool.query(
          "SELECT id FROM crm_contact_categories WHERE user_id = $1 AND name = 'Contacto Primario'",
          [req.userId]
        );
        const primCatId = categoryId || primCat.rows[0]?.id || null;

        await pool.query(
          `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
            VALUES ($1, $2, $3, $4, true) 
            ON CONFLICT (user_id, phone_number) 
            DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP` 
          , 
          [clientId, req.userId, resolvedPhone, primCatId]
        );

      } else {
        // Opción 2 ('keep'): Simplemente vincular este número con la categoría seleccionada
        await pool.query(
          `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
            VALUES ($1, $2, $3, $4, true) 
            ON CONFLICT (user_id, phone_number) 
            DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP` 
          , 
          [clientId, req.userId, resolvedPhone, categoryId || null]
        );
      }

    } else {
      // 2. Si no existe, creamos el cliente
      const clientRes = await pool.query(
        `INSERT INTO crm_clients (user_id, doc_type, doc_number, name, address, email, notes, birthday, idioma) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [req.userId, doc_type, doc_number, name, address || null, email || null, notes || null, birthday || null, idioma || 'Español']
      );
      clientId = clientRes.rows[0].id;

      let finalCatId = categoryId;
      if (!finalCatId) {
        const primCat = await pool.query(
          "SELECT id FROM crm_contact_categories WHERE user_id = $1 AND name = 'Contacto Primario'",
          [req.userId]
        );
        finalCatId = primCat.rows[0]?.id || null;
      }

      await pool.query(
        `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
            VALUES ($1, $2, $3, $4, true) 
            ON CONFLICT (user_id, phone_number) 
            DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP` 
          , 
          [clientId, req.userId, resolvedPhone, finalCatId]
      );
    }

    const clientInfo = await pool.query('SELECT * FROM crm_clients WHERE id = $1', [clientId]);
    const contactInfo = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND c.phone_number = $2` 
      , 
      [req.userId, resolvedPhone]
    );

    const contact = contactInfo.rows[0];
    if (contact && typeof contact.tags === 'string') {
      try { contact.tags = JSON.parse(contact.tags); } catch(e) { contact.tags = []; }
    }

    return res.json({
      success: true,
      isMerged,
      client: clientInfo.rows[0],
      contact
    });

  } catch (error: any) {
    console.error('[CRM Link Doc] Error en POST /link-doc:', error.message);
    return res.status(500).json({ success: false, error: 'Error al vincular el cliente y el contacto.' });
  }
});

/**
 * POST /api/crm/link-manual - Crear o asociar un cliente escribiendo el nombre manualmente (sin DNI/RUC obligatorio de inicio)
 */
router.post('/link-manual', async (req: AuthenticatedRequest, res: Response) => {
  const { phone_number, name, email, notes, categoryId, birthday, idioma } = req.body;

  if (!phone_number || !name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phone_number, name).' });
  }

  try {
    const resolvedPhone = await getRealPhoneIfNeeded(req.userId, phone_number);
    const contactCheck = await pool.query(
      'SELECT client_id FROM crm_contacts WHERE user_id = $1 AND phone_number = $2',
      [req.userId, resolvedPhone]
    );

    let clientId: number;

    if (contactCheck.rows.length > 0) {
      clientId = contactCheck.rows[0].client_id;
      await pool.query(
        `UPDATE crm_clients 
         SET name = $1, email = COALESCE($2, email), notes = COALESCE($3, notes), birthday = COALESCE($4, birthday), idioma = COALESCE($5, idioma), updated_at = CURRENT_TIMESTAMP 
         WHERE id = $6`,
        [name.trim(), email || null, notes || null, birthday || null, idioma || null, clientId]
      );

      if (categoryId) {
        await pool.query(
          'UPDATE crm_contacts SET category_id = $1 WHERE user_id = $2 AND phone_number = $3',
          [categoryId, req.userId, resolvedPhone]
        );
      }
    } else {
      const docNum = `MANUAL-${Date.now()}`;
      const clientRes = await pool.query(
        `INSERT INTO crm_clients (user_id, doc_type, doc_number, name, email, notes, birthday, idioma) 
         VALUES ($1, 'MANUAL', $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.userId, docNum, name.trim(), email || null, notes || null, birthday || null, idioma || 'Español']
      );
      clientId = clientRes.rows[0].id;

      let finalCatId = categoryId;
      if (!finalCatId) {
        const primCat = await pool.query(
          "SELECT id FROM crm_contact_categories WHERE user_id = $1 AND name = 'Contacto Primario'",
          [req.userId]
        );
        finalCatId = primCat.rows[0]?.id || null;
      }

      await pool.query(
        `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
            VALUES ($1, $2, $3, $4, true)` 
          , 
          [clientId, req.userId, resolvedPhone, finalCatId]
      );
    }

    const clientInfo = await pool.query('SELECT * FROM crm_clients WHERE id = $1', [clientId]);
    const contactInfo = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND c.phone_number = $2` 
      , 
      [req.userId, resolvedPhone]
    );

    const contact = contactInfo.rows[0];
    if (contact && typeof contact.tags === 'string') {
      try { contact.tags = JSON.parse(contact.tags); } catch(e) { contact.tags = []; }
    }

    return res.json({
      success: true,
      client: clientInfo.rows[0],
      contact
    });

  } catch (error: any) {
    console.error('[CRM Link Manual] Error en POST /link-manual:', error.message);
    return res.status(500).json({ success: false, error: 'Error al registrar contacto de forma manual.' });
  }
});

/**
 * GET /api/crm/clients - Listar todos los clientes del usuario (buscador de DNI/RUC/Nombre)
 */
router.get('/clients', async (req: AuthenticatedRequest, res: Response) => {
  const { search } = req.query;

  try {
    // Join the primary contact number for each client
    let query = `
      SELECT cl.*, 
             co.phone_number
      FROM crm_clients cl
      LEFT JOIN crm_contacts co ON cl.id = co.client_id AND co.user_id = cl.user_id AND co.is_active = true
      WHERE cl.user_id = $1
    `;
    const params: any[] = [req.userId];

    if (search && (search as string).trim()) {
      query += ' AND (cl.doc_number ILIKE $2 OR cl.name ILIKE $2 OR co.phone_number ILIKE $2)';
      params.push(`%${(search as string).trim()}%`);
    }

    query += ' ORDER BY cl.name ASC';
    const result = await pool.query(query, params);

    // Resolve any LIDs to real numbers and auto-update DB in the background/during execution
    const rows = result.rows;
    for (const row of rows) {
      if (row.phone_number && row.phone_number.startsWith('1000') && row.phone_number.length >= 13) {
        const resolved = await getRealPhoneIfNeeded(req.userId, row.phone_number);
        if (resolved && resolved !== row.phone_number) {
          try {
            await pool.query(
              'UPDATE crm_contacts SET phone_number = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND phone_number = $3',
              [resolved, req.userId, row.phone_number]
            );
            row.phone_number = resolved;
          } catch (e: any) {
            console.warn('[CRM GET Clients] Error auto-updating LID:', e.message);
          }
        }
      }
    }

    return res.json({ success: true, data: rows });  } catch (error: any) {
    console.error('[CRM Clients] Error en GET /clients:', error.message);
    return res.status(500).json({ success: false, error: 'Error al listar clientes.' });
  }
});

/**
 * PUT /api/crm/clients/:clientId/notes - Actualizar notas internas del cliente
 */
router.put('/clients/:clientId/notes', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.params;
  const { notes } = req.body;

  try {
    const clientCheck = await pool.query(
      'SELECT id FROM crm_clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado o sin permisos.' });
    }

    const result = await pool.query(
      'UPDATE crm_clients SET notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [notes !== undefined ? notes : null, clientId]
    );

    return res.json({ success: true, client: result.rows[0] });
  } catch (error: any) {
    console.error('[CRM Update Notes] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al actualizar las notas internas.' });
  }
});

/**
 * POST /api/crm/clients/:clientId/notes - Agregar una nota independiente
 */
router.post('/clients/:clientId/notes', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'La nota no puede estar vacía.' });
  }

  try {
    const clientCheck = await pool.query(
      'SELECT id FROM crm_clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado o sin permisos.' });
    }

    const noteRes = await pool.query(
      `INSERT INTO crm_client_notes (client_id, user_id, agent_id, content) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [clientId, req.userId, req.userId, content.trim()]
    );

    // Join with user table to return the agent name immediately
    const joinedRes = await pool.query(
      `SELECT n.*, COALESCE(ap.name, u.email) as agent_name 
       FROM crm_client_notes n
       LEFT JOIN users u ON n.agent_id = u.id
       LEFT JOIN agent_profiles ap ON u.id = ap.user_id
       WHERE n.id = $1`,
      [noteRes.rows[0].id]
    );

    return res.json({ success: true, note: joinedRes.rows[0] });
  } catch (error: any) {
    console.error('[CRM Add Note] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al agregar la nota.' });
  }
});

/**
 * DELETE /api/crm/clients/:clientId/notes/:noteId - Eliminar una nota independiente
 */
router.delete('/clients/:clientId/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId, noteId } = req.params;

  try {
    const check = await pool.query(
      'SELECT id FROM crm_client_notes WHERE id = $1 AND client_id = $2 AND user_id = $3',
      [noteId, clientId, req.userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Nota no encontrada o sin permisos.' });
    }

    await pool.query(
      'DELETE FROM crm_client_notes WHERE id = $1',
      [noteId]
    );

    return res.json({ success: true, message: 'Nota eliminada correctamente.' });
  } catch (error: any) {
    console.error('[CRM Delete Note] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al eliminar la nota.' });
  }
});

/**
 * GET /api/crm/clients/:clientId/contacts - Listar todos los contactos vinculados a un cliente
 */
router.get('/clients/:clientId/contacts', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.params;

  try {
    const clientCheck = await pool.query(
      'SELECT id, name FROM crm_clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado.' });
    }

    const contacts = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.client_id = $1 AND c.user_id = $2 
       ORDER BY c.is_active DESC, c.created_at ASC`,
      [clientId, req.userId]
    );

    return res.json({ success: true, data: contacts.rows });
  } catch (error: any) {
    console.error('[CRM Client Contacts] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al listar contactos del cliente.' });
  }
});

/**
 * GET /api/crm/pipeline - Obtener todos los contactos con su etapa en el pipeline comercial
 */
router.get('/pipeline', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    // Listar todos los contactos de este usuario con su información de cliente y categoría
    const contacts = await pool.query(
      `SELECT c.id as contact_id, c.phone_number, c.pipeline_stage, c.is_active, c.tags,
              cl.id as client_id, cl.name as client_name, cl.doc_type, cl.doc_number, cl.email, cl.notes,
              cat.name as category_name
       FROM crm_contacts c
       JOIN crm_clients cl ON c.client_id = cl.id
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id
       WHERE c.user_id = $1`,
      [userId]
    );

    return res.json({ success: true, data: contacts.rows });
  } catch (error: any) {
    console.error('[CRM Pipeline] Error en GET /pipeline:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener pipeline comercial.' });
  }
});

/**
 * POST /api/crm/pipeline/move - Cambiar o asignar la etapa del pipeline para un contacto/conversación
 */
router.post('/pipeline/move', async (req: AuthenticatedRequest, res: Response) => {
  const { remoteJid, stage, pushName } = req.body;
  if (!remoteJid || !stage) {
    return res.status(400).json({ success: false, error: 'remoteJid y stage son obligatorios.' });
  }

  const userId = req.userId;
  const phoneNumber = remoteJid.replace(/:\d+@s\.whatsapp\.net/g, '@s.whatsapp.net').split('@')[0];

  try {
    // 1. Buscar si el contacto ya existe
    const contactCheck = await pool.query(
      'SELECT id, client_id FROM crm_contacts WHERE user_id = $1 AND phone_number = $2',
      [userId, phoneNumber]
    );

    if (contactCheck.rows.length > 0) {
      // Ya existe, actualizamos su pipeline_stage
      await pool.query(
        'UPDATE crm_contacts SET pipeline_stage = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND phone_number = $3',
        [stage, userId, phoneNumber]
      );
      return res.json({ success: true, message: 'Etapa del pipeline actualizada exitosamente.' });
    } else {
      // No existe, creamos el cliente y contacto automáticamente
      const clientName = pushName || `Contacto ${phoneNumber}`;
      
      const clientResult = await pool.query(
        `INSERT INTO crm_clients (user_id, doc_type, doc_number, name, notes)
         VALUES ($1, 'MANUAL', $2, $3, 'Creado automáticamente desde el Pipeline Comercial')
         RETURNING id`,
        [userId, phoneNumber, clientName]
      );
      const clientId = clientResult.rows[0].id;

      await pool.query(
        `INSERT INTO crm_contacts (client_id, user_id, phone_number, pipeline_stage)
         VALUES ($1, $2, $3, $4)`,
        [clientId, userId, phoneNumber, stage]
      );

      return res.json({ success: true, message: 'Contacto registrado y asignado al pipeline exitosamente.' });
    }
  } catch (error: any) {
    console.error('[CRM Pipeline Move] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al mover el contacto en el pipeline.' });
  }
});

/**
 * POST /api/crm/contacts/tags - Actualizar etiquetas de un contacto
 */
router.post('/contacts/tags', async (req: AuthenticatedRequest, res: Response) => {
  const { phone_number, tags } = req.body;
  if (!phone_number || !Array.isArray(tags)) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phone_number, tags).' });
  }
  const cleanPhone = phone_number.split(':')[0];
  try {
    const contactCheck = await pool.query(
      'SELECT id FROM crm_contacts WHERE user_id = $1 AND phone_number = $2',
      [req.userId, cleanPhone]
    );

    if (contactCheck.rows.length === 0) {
      let clientRes = await pool.query(
        'SELECT id FROM crm_clients WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [req.userId]
      );
      let clientId;
      if (clientRes.rows.length === 0) {
        const tempDocNum = 'TEMP' + Date.now();
        const newClient = await pool.query(
          `INSERT INTO crm_clients (user_id, doc_type, doc_number, name) 
           VALUES ($1, 'DNI', $2, $3) RETURNING id`,
          [req.userId, tempDocNum, 'Cliente Temporal']
        );
        clientId = newClient.rows[0].id;
      } else {
        clientId = clientRes.rows[0].id;
      }

      await pool.query(
        `INSERT INTO crm_contacts (client_id, user_id, phone_number, tags) 
         VALUES ($1, $2, $3, $4)`,
        [clientId, req.userId, cleanPhone, JSON.stringify(tags)]
      );
    } else {
      await pool.query(
        'UPDATE crm_contacts SET tags = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND phone_number = $3',
        [JSON.stringify(tags), req.userId, cleanPhone]
      );
    }

    return res.json({ success: true, message: 'Etiquetas actualizadas correctamente.' });
  } catch (error: any) {
    console.error('[CRM Tags Update] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al actualizar etiquetas.' });
  }
});

// Helper function to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

/**
 * GET /api/crm/agents - Listar colaboradores
 */
router.get('/agents', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agents = await pool.query(`
      SELECT u.id, u.email, u.created_at, ap.name, ap.status, ap.response_time_sec,
        (SELECT COUNT(*) FROM crm_contacts WHERE assigned_agent_id = u.id AND is_active = true) as active_chats
      FROM users u
      JOIN agent_profiles ap ON u.id = ap.user_id
      WHERE u.parent_id = $1
      ORDER BY ap.name ASC
    `, [req.userId]);

    return res.json({ success: true, data: agents.rows });
  } catch (error: any) {
    console.error('[CRM List Agents] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al listar colaboradores.' });
  }
});

/**
 * POST /api/crm/agents - Crear colaborador
 */
router.post('/agents', async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (name, email, password).' });
  }

  try {
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado.' });
    }

    const agentId = generateId('user');
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('BEGIN');

    await pool.query(`
      INSERT INTO users (id, email, password, role, parent_id)
      VALUES ($1, $2, $3, 'agent', $4)
    `, [agentId, email.toLowerCase(), hashedPassword, req.userId]);

    await pool.query(`
      INSERT INTO agent_profiles (user_id, name, status)
      VALUES ($1, $2, 'available')
    `, [agentId, name]);

    await pool.query('COMMIT');

    return res.json({ success: true, message: 'Colaborador creado exitosamente.' });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('[CRM Create Agent] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al crear colaborador.' });
  }
});

/**
 * PUT /api/crm/agents/:agentId/status - Cambiar estado del colaborador
 */
router.put('/agents/:agentId/status', async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.params;
  const { status } = req.body;

  if (!status || !['available', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Estado inválido.' });
  }

  try {
    const agentCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [agentId, req.userId]);
    const isSelfUpdate = req.agentId === agentId;
    
    if (agentCheck.rows.length === 0 && !isSelfUpdate) {
      return res.status(403).json({ success: false, error: 'No autorizado para modificar este colaborador.' });
    }

    await pool.query(
      'UPDATE agent_profiles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [status, agentId]
    );

    return res.json({ success: true, message: 'Estado del colaborador actualizado.' });
  } catch (error: any) {
    console.error('[CRM Update Agent Status] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al cambiar estado del colaborador.' });
  }
});

/**
 * DELETE /api/crm/agents/:agentId - Eliminar colaborador
 */
router.delete('/agents/:agentId', async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.params;

  try {
    const agentCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [agentId, req.userId]);
    if (agentCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'No autorizado para eliminar este colaborador.' });
    }

    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE crm_contacts SET assigned_agent_id = NULL WHERE assigned_agent_id = $1',
      [agentId]
    );

    await pool.query('DELETE FROM users WHERE id = $1', [agentId]);

    await pool.query('COMMIT');

    return res.json({ success: true, message: 'Colaborador eliminado exitosamente.' });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    console.error('[CRM Delete Agent] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al eliminar colaborador.' });
  }
});

/**
 * POST /api/crm/contacts/assign - Asignar chat a un colaborador
 */
router.post('/contacts/assign', async (req: AuthenticatedRequest, res: Response) => {
  const { phone_number, agent_id } = req.body;
  if (!phone_number) {
    return res.status(400).json({ success: false, error: 'El parámetro phone_number es requerido.' });
  }

  const cleanPhone = phone_number.split('@')[0].split(':')[0];

  try {
    if (agent_id) {
      const agentCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [agent_id, req.userId]);
      if (agentCheck.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'El colaborador no existe o no pertenece a tu empresa.' });
      }
    }

    const contactCheck = await pool.query(
      'SELECT id FROM crm_contacts WHERE user_id = $1 AND phone_number = $2',
      [req.userId, cleanPhone]
    );

    if (contactCheck.rows.length === 0) {
      let clientRes = await pool.query(
        'SELECT id FROM crm_clients WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [req.userId]
      );
      let clientId;
      if (clientRes.rows.length === 0) {
        const tempDocNum = 'TEMP' + Date.now();
        const newClient = await pool.query(
          `INSERT INTO crm_clients (user_id, doc_type, doc_number, name) 
           VALUES ($1, 'DNI', $2, $3) RETURNING id`,
          [req.userId, tempDocNum, 'Cliente Temporal']
        );
        clientId = newClient.rows[0].id;
      } else {
        clientId = clientRes.rows[0].id;
      }

      await pool.query(
        `INSERT INTO crm_contacts (client_id, user_id, phone_number, assigned_agent_id) 
         VALUES ($1, $2, $3, $4)`,
        [clientId, req.userId, cleanPhone, agent_id]
      );
    } else {
      const contactId = contactCheck.rows[0].id;
      await pool.query(
        'UPDATE crm_contacts SET assigned_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [agent_id, contactId]
      );
    }

    return res.json({ success: true, message: 'Chat asignado correctamente.' });
  } catch (error: any) {
    console.error('[CRM Assign Chat] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al asignar el chat.' });
  }
});

/**
 * GET /api/crm/tasks - Listar todas las tareas del CRM de los clientes del usuario
 */
router.get('/tasks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasksRes = await pool.query(
      `SELECT t.id, t.title, t.completed, t.due_date, t.client_id, c.name as client_name 
       FROM crm_client_tasks t
       JOIN crm_clients c ON t.client_id = c.id
       WHERE c.user_id = $1
       ORDER BY t.due_date ASC, t.id ASC`,
      [req.userId]
    );

    return res.json({ success: true, data: tasksRes.rows });
  } catch (error: any) {
    console.error('[CRM Global Tasks] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener las tareas globales.' });
  }
});

/**
 * GET /api/crm/clients/:clientId/tasks - Listar o inicializar las tareas de un cliente
 */
router.get('/clients/:clientId/tasks', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.params;

  try {
    // Verificar que el cliente pertenezca al usuario
    const clientCheck = await pool.query(
      'SELECT id FROM crm_clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado.' });
    }

    // Consultar tareas existentes
    const tasksRes = await pool.query(
      'SELECT * FROM crm_client_tasks WHERE client_id = $1 ORDER BY id ASC',
      [clientId]
    );

    if (tasksRes.rows.length > 0) {
      return res.json({ success: true, tasks: tasksRes.rows });
    }

    // Si no tiene tareas, inicializar las 5 por defecto
    const defaultTasks = [
      'Llamarlo mañana',
      'Enviar factura',
      'Cobrar',
      'Renovación',
      'Programar visita'
    ];

    const insertedTasks = [];
    for (const title of defaultTasks) {
      const insRes = await pool.query(
        'INSERT INTO crm_client_tasks (client_id, title) VALUES ($1, $2) RETURNING *',
        [clientId, title]
      );
      insertedTasks.push(insRes.rows[0]);
    }

    return res.json({ success: true, tasks: insertedTasks });
  } catch (error: any) {
    console.error('[CRM Get Tasks] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener las tareas.' });
  }
});

/**
 * POST /api/crm/clients/:clientId/tasks - Crear una nueva tarea personalizada para el cliente
 */
router.post('/clients/:clientId/tasks', async (req: AuthenticatedRequest, res: Response) => {
  const { clientId } = req.params;
  const { title, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: 'El título de la tarea es obligatorio.' });
  }

  try {
    // Verificar que el cliente pertenezca al usuario
    const clientCheck = await pool.query(
      'SELECT id FROM crm_clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado.' });
    }

    const insRes = await pool.query(
      'INSERT INTO crm_client_tasks (client_id, title, due_date) VALUES ($1, $2, $3) RETURNING *',
      [clientId, title.trim(), due_date || null]
    );

    return res.json({ success: true, task: insRes.rows[0] });
  } catch (error: any) {
    console.error('[CRM Create Task] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al crear la tarea.' });
  }
});

/**
 * PUT /api/crm/tasks/:taskId - Actualizar una tarea (completado y/o fecha límite)
 */
router.put('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;
  const { completed, due_date } = req.body;

  try {
    // Verificar propiedad a través del cliente
    const taskCheck = await pool.query(
      `SELECT t.id, t.client_id 
       FROM crm_client_tasks t
       JOIN crm_clients c ON t.client_id = c.id
       WHERE t.id = $1 AND c.user_id = $2`,
      [taskId, req.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada o sin permisos.' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let valIdx = 1;

    if (completed !== undefined) {
      updates.push(`completed = $${valIdx++}`);
      values.push(completed);
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${valIdx++}`);
      values.push(due_date || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay campos para actualizar.' });
    }

    values.push(taskId);
    const updateQuery = `
      UPDATE crm_client_tasks 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${valIdx} 
      RETURNING *`;

    const result = await pool.query(updateQuery, values);
    return res.json({ success: true, task: result.rows[0] });
  } catch (error: any) {
    console.error('[CRM Update Task] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al actualizar la tarea.' });
  }
});

/**
 * DELETE /api/crm/tasks/:taskId - Eliminar una tarea
 */
router.delete('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.params;

  try {
    // Verificar propiedad
    const taskCheck = await pool.query(
      `SELECT t.id 
       FROM crm_client_tasks t
       JOIN crm_clients c ON t.client_id = c.id
       WHERE t.id = $1 AND c.user_id = $2`,
      [taskId, req.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada o sin permisos.' });
    }

    await pool.query('DELETE FROM crm_client_tasks WHERE id = $1', [taskId]);
    return res.json({ success: true, message: 'Tarea eliminada correctamente.' });
  } catch (error: any) {
    console.error('[CRM Delete Task] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al eliminar la tarea.' });
  }
});

// ==========================================
// INTEGRACIÓN DE FACTURACIÓN ELECTRÓNICA (MULTI-TENANT)
// ==========================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'zazaclick-encryption-key-32-chars-!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encryptToken(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptToken(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error('Error decrypting token:', err);
    return '';
  }
}

/**
 * GET /api/crm/billing/config - Obtener la configuración del facturador de la empresa
 */
router.get('/billing/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT billing_subdomain, billing_token FROM billing_configs WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, configured: false });
    }

    const { billing_subdomain, billing_token } = result.rows[0];
    const decrypted = decryptToken(billing_token);
    
    // Enmascarar el token para no exponerlo en el frontend
    const maskedToken = decrypted 
      ? decrypted.substring(0, 4) + '••••••••' + decrypted.substring(decrypted.length - 4)
      : '';

    return res.json({
      success: true,
      configured: true,
      subdomain: billing_subdomain,
      token: maskedToken
    });
  } catch (error: any) {
    console.error('[CRM Billing Config GET] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener la configuración de facturación.' });
  }
});

/**
 * POST /api/crm/billing/config - Crear o actualizar la configuración del facturador
 */
router.post('/billing/config', async (req: AuthenticatedRequest, res: Response) => {
  const { subdomain, token } = req.body;

  if (!subdomain || !token) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (subdomain, token).' });
  }

  // Limpiar el subdominio de URLs o caracteres raros (solo el slug)
  const cleanSubdomain = subdomain
    .replace(/https?:\/\//i, '')
    .split('.')[0]
    .trim()
    .toLowerCase();

  try {
    // Si envían un token enmascarado (ej. que ya estaba guardado), no lo sobreescribimos
    let finalToken = token;
    if (token.includes('••••')) {
      const existingRes = await pool.query('SELECT billing_token FROM billing_configs WHERE user_id = $1', [req.userId]);
      if (existingRes.rows.length > 0) {
        finalToken = decryptToken(existingRes.rows[0].billing_token);
      } else {
        return res.status(400).json({ success: false, error: 'Token inválido.' });
      }
    }

    const encryptedToken = encryptToken(finalToken);

    // Insertar o actualizar usando UPSERT (ON CONFLICT)
    await pool.query(
      `INSERT INTO billing_configs (user_id, billing_subdomain, billing_token, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET billing_subdomain = EXCLUDED.billing_subdomain, 
                     billing_token = EXCLUDED.billing_token, 
                     updated_at = CURRENT_TIMESTAMP`,
      [req.userId, cleanSubdomain, encryptedToken]
    );

    return res.json({ success: true, message: 'Configuración de facturación guardada exitosamente.' });
  } catch (error: any) {
    console.error('[CRM Billing Config POST] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al guardar la configuración de facturación.' });
  }
});

/**
 * DELETE /api/crm/billing/config - Eliminar/Desconectar la configuración de facturación
 */
router.delete('/billing/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM billing_configs WHERE user_id = $1', [req.userId]);
    
    // Limpiar las claves de caché de Redis para esta empresa
    const cacheKeys = await redis.keys(`billing:products:${req.userId}:*`);
    if (cacheKeys.length > 0) {
      await redis.del(cacheKeys);
    }
    
    return res.json({ success: true, message: 'Facturador electrónico desconectado exitosamente.' });
  } catch (error: any) {
    console.error('[CRM Billing Config DELETE] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al desconectar la configuración de facturación.' });
  }
});

/**
 * POST /api/crm/billing/test - Probar conexión con el facturador en vivo
 */
router.post('/billing/test', async (req: AuthenticatedRequest, res: Response) => {
  const { subdomain, token } = req.body;

  if (!subdomain || !token) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (subdomain, token).' });
  }

  const cleanSubdomain = subdomain
    .replace(/https?:\/\//i, '')
    .split('.')[0]
    .trim()
    .toLowerCase();

  let finalToken = token;
  // Si viene enmascarado, descifrar el existente de la base de datos
  if (token.includes('••••')) {
    try {
      const existingRes = await pool.query('SELECT billing_token FROM billing_configs WHERE user_id = $1', [req.userId]);
      if (existingRes.rows.length > 0) {
        finalToken = decryptToken(existingRes.rows[0].billing_token);
      } else {
        return res.status(400).json({ success: false, error: 'Token inválido para prueba.' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Error al verificar token existente.' });
    }
  }

  const targetUrl = `https://${cleanSubdomain}.syscomecosistemadigital.com/api/document/search-items`;

  try {
    const response = await axios.get(targetUrl, {
      params: { input: 'conexion_prueba_crm' }, // Evita descargar todo el catálogo al probar la conexión
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${finalToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000 // 10 segundos timeout
    });

    if (response.data && response.data.success) {
      return res.json({ 
        success: true, 
        message: '¡Conexión exitosa! El facturador respondió correctamente.'
      });
    }

    return res.status(400).json({ success: false, error: 'El facturador respondió pero el formato de respuesta es inválido.' });
  } catch (error: any) {
    console.warn('[CRM Billing Test] Connection failed:', error.message);
    const statusCode = error.response?.status;
    const errMessage = error.response?.data?.message || error.message;

    if (statusCode === 401) {
      return res.status(401).json({ success: false, error: 'Error de autenticación (401): El token provisto es inválido o expiró.' });
    }
    if (statusCode === 404) {
      return res.status(404).json({ success: false, error: 'Subdominio no encontrado (404): Verifica que el subdominio sea correcto.' });
    }
    return res.status(400).json({ success: false, error: `Error de conexión con el facturador: ${errMessage}` });
  }
});

/**
 * GET /api/crm/billing/products - Listar/Buscar productos desde el facturador en vivo
 */
router.get('/billing/products', async (req: AuthenticatedRequest, res: Response) => {
  const { search, refresh } = req.query;
  const searchQuery = typeof search === 'string' ? search.trim() : '';

  try {
    // 1. Clave de caché global para TODOS los productos de esta empresa
    const redisKey = `billing:products:${req.userId}:all`;
    let catalogProducts: any[] = [];
    let isFromCache = false;

    // Intentar leer del caché si no se solicita forzar la recarga
    if (refresh !== 'true') {
      try {
        const cached = await redis.get(redisKey);
        if (cached) {
          catalogProducts = JSON.parse(cached);
          isFromCache = true;
        }
      } catch (redisErr: any) {
        console.warn('[CRM Billing Products] Fallo al leer de Redis:', redisErr.message);
      }
    }

    // 2. Si no estaba en caché, consultar al facturador en vivo
    if (catalogProducts.length === 0) {
      const configRes = await pool.query(
        'SELECT billing_subdomain, billing_token FROM billing_configs WHERE user_id = $1',
        [req.userId]
      );

      if (configRes.rows.length === 0) {
        return res.json({ 
          success: true, 
          configured: false, 
          data: [] 
        });
      }

      const { billing_subdomain, billing_token } = configRes.rows[0];
      const decryptedToken = decryptToken(billing_token);

      if (!decryptedToken) {
        return res.status(500).json({ success: false, error: 'Error de desencripción del token del facturador.' });
      }

      const targetUrl = `https://${billing_subdomain}.syscomecosistemadigital.com/api/document/search-items`;

      // Llamada limpia: sin parámetros de búsqueda para traer el catálogo completo
      const response = await axios.get(targetUrl, {
        params: {}, // Catálogo completo
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${decryptedToken}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10 segundos timeout
      });

      if (response.data && response.data.success) {
        const itemsArray = Array.isArray(response.data.data) 
          ? response.data.data 
          : (response.data.data?.items || []);

        catalogProducts = itemsArray.map((item: any) => {
          let imageUrl = item.image_url || null;
          if (!imageUrl && item.image) {
            if (item.image.startsWith('http')) {
              imageUrl = item.image;
            } else {
              imageUrl = `https://${billing_subdomain}.syscomecosistemadigital.com/storage/uploads/items/${item.image}`;
            }
          }

          return {
            id: item.id || item.item_id || item.internal_id || Math.random().toString(),
            name: item.description || item.name || 'Producto sin nombre',
            price: `S/ ${(Number(item.sale_unit_price) || 0).toFixed(2)}`,
            originalPrice: Number(item.sale_unit_price) || 0,
            category: item.category || 'General',
            description: item.name || item.description || '',
            image: imageUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=120&auto=format&fit=crop&q=60',
            originalImage: imageUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
            stock: item.stock !== undefined ? Number(item.stock) : null
          };
        });

        // Guardar en Redis con un TTL corto de 2 minutos (120 segundos) para mantener datos frescos
        try {
          await redis.setex(redisKey, 120, JSON.stringify(catalogProducts));
        } catch (redisSetErr: any) {
          console.warn('[CRM Billing Products] Fallo al escribir en Redis:', redisSetErr.message);
        }
      }
    }

    // 3. Filtrar los productos localmente en memoria usando Búsqueda Difusa (Fuzzy Match)
    let filteredProducts = catalogProducts;
    if (searchQuery) {
      filteredProducts = catalogProducts.filter((prod: any) => 
        fuzzyMatch(prod.name, searchQuery) || fuzzyMatch(prod.description, searchQuery)
      );
    }

    return res.json({ 
      success: true, 
      configured: true, 
      data: filteredProducts,
      cached: isFromCache
    });

  } catch (error: any) {
    console.warn(`[CRM Billing Products] Fallo al consultar catálogo de la empresa ${req.userId}:`, error.message);
    
    // Fallback: Si falla la conexión, intentar servir los productos del caché global filtrados localmente
    try {
      const redisKey = `billing:products:${req.userId}:all`;
      const cached = await redis.get(redisKey);
      if (cached) {
        const cachedProducts = JSON.parse(cached);
        let filteredProducts = cachedProducts;
        if (searchQuery) {
          filteredProducts = cachedProducts.filter((prod: any) => 
            fuzzyMatch(prod.name, searchQuery) || fuzzyMatch(prod.description, searchQuery)
          );
        }

        return res.json({ 
          success: true, 
          configured: true, 
          data: filteredProducts,
          cached: true,
          warning: 'Mostrando datos locales de caché debido a problemas de conexión con el facturador.'
        });
      }
    } catch (e) {}

    return res.json({ 
      success: true, 
      configured: true, 
      error: 'No se pudo conectar con el facturador de la empresa en este momento.',
      data: [] 
    });
  }
});

export default router;
