import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import axios from 'axios';

const router = Router();
router.use(authMiddleware);

// Token por defecto provisto por el usuario
const APIPERU_TOKEN = process.env.APIPERU_TOKEN || '76ca7246c8a8c464fd551b6555e780791a69ff89acb8887558d65b23f05ab81b';

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
        contactMap[row.phone_number] = row.name;
      }
    }

    return res.json({ success: true, data: contactMap });
  } catch (error: any) {
    console.error('[CRM Contacts Map] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Error al obtener mapa de contactos CRM' });
  }
});

/**
 * GET /api/crm/contacts/:phoneNumber - Buscar cliente y datos de contacto de una línea
 */
router.get('/contacts/:phoneNumber', async (req: AuthenticatedRequest, res: Response) => {
  const { phoneNumber } = req.params;
  const cleanPhone = phoneNumber.split(':')[0];

  try {
    // Buscar contacto activo
    const contactRes = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND c.phone_number = $2`,
      [req.userId, cleanPhone]
    );

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

    return res.json({
      success: true,
      contact,
      client: clientRes.rows[0] || null
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
  const { phone_number, doc_type, doc_number, name, address, email, notes, categoryId, mergeAction } = req.body;

  if (!phone_number || !doc_type || !doc_number || !name) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phone_number, doc_type, doc_number, name).' });
  }

  try {
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
         SET name = $1, address = COALESCE($2, address), email = COALESCE($3, email), notes = COALESCE($4, notes), updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [name, address || null, email || null, notes || null, clientId]
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
           DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP`,
          [clientId, req.userId, phone_number, primCatId]
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
           DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP`,
          [clientId, req.userId, phone_number, primCatId]
        );

      } else {
        // Opción 2 ('keep'): Simplemente vincular este número con la categoría seleccionada
        await pool.query(
          `INSERT INTO crm_contacts (client_id, user_id, phone_number, category_id, is_active) 
           VALUES ($1, $2, $3, $4, true) 
           ON CONFLICT (user_id, phone_number) 
           DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP`,
          [clientId, req.userId, phone_number, categoryId || null]
        );
      }

    } else {
      // 2. Si no existe, creamos el cliente
      const clientRes = await pool.query(
        `INSERT INTO crm_clients (user_id, doc_type, doc_number, name, address, email, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.userId, doc_type, doc_number, name, address || null, email || null, notes || null]
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
         DO UPDATE SET client_id = $1, category_id = $4, is_active = true, updated_at = CURRENT_TIMESTAMP`,
        [clientId, req.userId, phone_number, finalCatId]
      );
    }

    const clientInfo = await pool.query('SELECT * FROM crm_clients WHERE id = $1', [clientId]);
    const contactInfo = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND c.phone_number = $2`,
      [req.userId, phone_number]
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
  const { phone_number, name, email, notes, categoryId } = req.body;

  if (!phone_number || !name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (phone_number, name).' });
  }

  try {
    const contactCheck = await pool.query(
      'SELECT client_id FROM crm_contacts WHERE user_id = $1 AND phone_number = $2',
      [req.userId, phone_number]
    );

    let clientId: number;

    if (contactCheck.rows.length > 0) {
      clientId = contactCheck.rows[0].client_id;
      await pool.query(
        `UPDATE crm_clients 
         SET name = $1, email = COALESCE($2, email), notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [name.trim(), email || null, notes || null, clientId]
      );

      if (categoryId) {
        await pool.query(
          'UPDATE crm_contacts SET category_id = $1 WHERE user_id = $2 AND phone_number = $3',
          [categoryId, req.userId, phone_number]
        );
      }
    } else {
      const docNum = `MANUAL-${Date.now()}`;
      const clientRes = await pool.query(
        `INSERT INTO crm_clients (user_id, doc_type, doc_number, name, email, notes) 
         VALUES ($1, 'MANUAL', $2, $3, $4, $5) RETURNING id`,
        [req.userId, docNum, name.trim(), email || null, notes || null]
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
         VALUES ($1, $2, $3, $4, true)`,
        [clientId, req.userId, phone_number, finalCatId]
      );
    }

    const clientInfo = await pool.query('SELECT * FROM crm_clients WHERE id = $1', [clientId]);
    const contactInfo = await pool.query(
      `SELECT c.*, cat.name as category_name 
       FROM crm_contacts c 
       LEFT JOIN crm_contact_categories cat ON c.category_id = cat.id 
       WHERE c.user_id = $1 AND c.phone_number = $2`,
      [req.userId, phone_number]
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
    let query = 'SELECT * FROM crm_clients WHERE user_id = $1';
    const params: any[] = [req.userId];

    if (search && (search as string).trim()) {
      query += ' AND (doc_number ILIKE $2 OR name ILIKE $2)';
      params.push(`%${(search as string).trim()}%`);
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[CRM Clients] Error en GET /clients:', error.message);
    return res.status(500).json({ success: false, error: 'Error al listar clientes.' });
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

export default router;
