const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";

async function testJid(jid) {
  console.log(`\nTesting fetch for JID: ${jid} on instance ${instanceName}...`);
  const startTime = Date.now();
  try {
    const res = await axios.post(`${evUrl}/chat/findMessages/${instanceName}`, {
      where: {
        key: {
          remoteJid: jid
        }
      },
      limit: 100
    }, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log(`- Success! Status: ${res.status} in ${Date.now() - startTime}ms`);
  } catch (err) {
    console.error(`- Error (Status ${err.response?.status}) in ${Date.now() - startTime}ms:`, err.response?.data || err.message);
  }
}

async function run() {
  await testJid("51900892668:0@s.whatsapp.net");
}

run();
