const axios = require('axios');

async function testSend() {
  const evUrl = "https://evolution-api-production-8b953.up.railway.app";
  const evKey = "lwJAq9M4NwHmtM5bqk1k";
  const instanceName = "NuevaPrueba01";
  
  // Try sending to the LID format directly
  const targetJid = "100038948741313@lid";
  
  console.log(`Sending test message to ${targetJid} via Evolution API...`);
  try {
    const resSend = await axios.post(`${evUrl}/message/sendText/${instanceName}`, {
      number: targetJid,
      text: "Prueba de envio directo a JID LID"
    }, {
      headers: { 
        apikey: evKey,
        'Content-Type': 'application/json'
      }
    });
    console.log("Send Success:", resSend.status, resSend.data);
  } catch (err) {
    console.error("Send Error Detailed:");
    console.log(JSON.stringify(err.response?.data, null, 2));
  }
}

testSend();
