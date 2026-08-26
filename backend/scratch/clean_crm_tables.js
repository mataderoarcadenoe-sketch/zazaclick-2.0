const { Client } = require('pg');

async function cleanCrmTables() {
  const dbUrl = "postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway";
  
  console.log("🔌 Conectando a PostgreSQL en Railway...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Conexión establecida con éxito a Railway PostgreSQL.");

    // 1. Listar todas las tablas existentes antes de la limpieza
    const tablesBefore = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log("\n📊 Tablas encontradas en la BD:");
    console.log(tablesBefore.rows.map(r => r.table_name));

    // 2. Eliminar tablas obsoletas del CRM en orden de dependencias
    const crmTablesToDrop = [
      'crm_order_items',
      'crm_orders',
      'crm_client_tasks',
      'crm_client_notes',
      'crm_contacts',
      'crm_contact_categories',
      'crm_clients',
      'agent_profiles',
      'billing_configs',
      'google_contacts_credentials'
    ];

    console.log("\n🧹 Eliminando tablas legacy del CRM...");
    for (const table of crmTablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`  🗑️ Tabla eliminada: ${table}`);
    }

    // 3. Listar tablas finales en la base de datos
    const tablesAfter = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log("\n✨ Tablas SaaS Core conservadas en Railway:");
    console.log(tablesAfter.rows.map(r => r.table_name));

    // 4. Verificar integridad de las tablas Core
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    const plansCount = await client.query('SELECT COUNT(*) FROM plans');
    const subsCount = await client.query('SELECT COUNT(*) FROM subscriptions');
    const instCount = await client.query('SELECT COUNT(*) FROM instances');

    console.log("\n📋 Verificación de Integridad SaaS Core:");
    console.log(`  • Usuarios: ${usersCount.rows[0].count}`);
    console.log(`  • Planes: ${plansCount.rows[0].count}`);
    console.log(`  • Suscripciones: ${subsCount.rows[0].count}`);
    console.log(`  • Instancias WhatsApp: ${instCount.rows[0].count}`);

  } catch (err) {
    console.error("❌ Error durante la limpieza de la base de datos:", err.message);
  } finally {
    await client.end();
  }
}

cleanCrmTables();
