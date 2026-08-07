const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "ZAZA20";

async function run() {
  try {
    const res = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, {
      where: {
        key: {
          remoteJid: "199652041302076@lid"
        }
      },
      limit: 2
    }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log("Evolution API findMessages Response structure:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
