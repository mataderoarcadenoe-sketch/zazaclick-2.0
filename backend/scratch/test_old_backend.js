const axios = require('axios');

async function testOldBackend() {
  const url = 'https://zaza-click-20-production.up.railway.app/v1/messages/text';
  const payload = {
    instanceName: 'gym_guevara_alvarez_melanie__whatsapp',
    number: '51931175234',
    text: 'Prueba desde el backend de producción anterior'
  };
  const headers = {
    'Authorization': 'Bearer zc_partner_master_vivesfit_2026',
    'Content-Type': 'application/json'
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', err.response?.data || err.message);
  }
}

testOldBackend();
