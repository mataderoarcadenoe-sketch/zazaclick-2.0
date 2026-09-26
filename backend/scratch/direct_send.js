const axios = require('axios');

async function testDirectSend() {
  const evUrl = 'https://evolution-api-production-8b953.up.railway.app';
  const apikey = '4296088A962E3B1C5D4180A84D581F78';
  const instanceName = 'gym_guevara_alvarez_melanie__whatsapp';
  const number = '51931175234';
  const text = '¡Prueba directa de entrega de WhatsApp desde Zona Fit / Syscom!';

  console.log(`Enviando mensaje a ${number} vía ${instanceName}...`);
  try {
    const response = await axios.post(`${evUrl}/message/sendText/${instanceName}`, {
      number: number,
      text: text
    }, {
      headers: {
        'apikey': apikey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data || error.message);
  }
}

testDirectSend();
