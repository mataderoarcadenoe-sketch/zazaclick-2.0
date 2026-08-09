const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "zaza_saas_jwt_secret_2026_super_key";
const backendUrl = "https://zaza-click-20-production.up.railway.app/api";

// Generar token para el usuario gymbra.eirl@gmail.com (id: user_1785654247524_367)
const token = jwt.sign({
  id: "user_1785654247524_367",
  tenantId: "user_1785654247524_367",
  role: "admin"
}, JWT_SECRET, { expiresIn: '1h' });

async function run() {
  const instanceName = "Zaza2";
  const remoteJid = "199652041302076@lid";
  const originalJid = "199652041302076@lid";

  console.log(`Calling production backend messages route for ${remoteJid}...`);
  try {
    const res = await axios.post(`${backendUrl}/instances/chats/${instanceName}/messages`, {
      remoteJid,
      originalJid
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("Response Status:", res.status);
    console.log("Response Data keys:", Object.keys(res.data));
    console.log("Success status:", res.data.success);
    if (res.data.success) {
      console.log("Returned messages count:", res.data.data?.length);
      if (res.data.data?.length > 0) {
        console.log("First message preview:", JSON.stringify(res.data.data[0], null, 2));
      }
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
