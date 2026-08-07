const axios = require('axios');

async function run() {
  const baseUrl = 'https://zaza-click-20-production.up.railway.app/api/instances';
  
  console.log('--- DIAGNOSTICOS EN PRODUCCION ---');

  try {
    console.log('\n1. Probando test-media/ZAZA20...');
    const payload = {
      messageKey: {
        id: "3EB0F5FD15C8FE71AF3499",
        fromMe: true,
        remoteJid: "96474008395889@lid"
      },
      messageContent: {
        imageMessage: {
          caption: "📦 *Facturación Electrónica Pro*\n💵 *Precio*: S/ 150.00\n\n📝 *Detalles*: Sistema ERP completo de facturación electrónica. Emite boletas, facturas y notas de crédito homologado por la SUNAT."
        }
      }
    };
    const rMedia = await axios.post(`${baseUrl}/test-media/ZAZA20`, payload);
    console.log('Respuesta test-media:', JSON.stringify(rMedia.data, null, 2));
  } catch (err) {
    console.error('Error en test-media:', err.message, err.response?.data || '');
  }
}

run();
