const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "lwJAq9M4NwHmtM5bqk1k";
const instanceName = "NuevaPrueba01";

async function run() {
  console.log("Testing POST markMessageAsRead...");
  const payload = {
    readMessages: [
      {
        remoteJid: "51931175234@s.whatsapp.net",
        id: "cmsj6p5pu0e5dp25rxpp1j3tf",
        fromMe: false
      }
    ]
  };

  try {
    const resPost = await axios.post(`${evUrl}/chat/markMessageAsRead/${instanceName}`, payload, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log("POST Success:", resPost.status, resPost.data);
  } catch (err) {
    console.error("POST Error:", err.response?.status, err.response?.data || err.message);
  }

  console.log("\nTesting PUT markMessageAsRead...");
  try {
    const resPut = await axios.put(`${evUrl}/chat/markMessageAsRead/${instanceName}`, payload, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log("PUT Success:", resPut.status, resPut.data);
  } catch (err) {
    console.error("PUT Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
