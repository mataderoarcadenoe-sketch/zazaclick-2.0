const axios = require('axios');

async function testDelivery() {
  const url = 'https://api.zazaclick.sbs/v1/messages/text';
  const payload = {
    instanceName: 'gym_guevara_alvarez_melanie__whatsapp',
    number: '51931175234',
    text: 'Hola! Mensaje de prueba de conectividad ZazaClick 2.0'
  };
  const headers = {
    'Authorization': 'Bearer zc_partner_master_vivesfit_2026',
    'Content-Type': 'application/json'
  };

  console.log('Sending request to:', url);
  console.log('Payload:', payload);

  try {
    const res = await axios.post(url, payload, { headers });
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', JSON.stringify(err.response?.data, null, 2));
    console.error('Error message:', err.message);
  }
}

testDelivery();
