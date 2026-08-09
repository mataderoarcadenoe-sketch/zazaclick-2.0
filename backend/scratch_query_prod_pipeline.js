const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "zaza_saas_jwt_secret_2026_super_key";
const backendUrl = "https://zaza-click-20-production.up.railway.app/api";

const token = jwt.sign({
  id: "user_1785654247524_367",
  tenantId: "user_1785654247524_367",
  role: "admin"
}, JWT_SECRET, { expiresIn: '1h' });

async function run() {
  console.log("Fetching pipeline from production backend...");
  try {
    const res = await axios.get(`${backendUrl}/crm/pipeline`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.data.success) {
      console.log("Pipeline data keys/length:", Array.isArray(res.data.data) ? res.data.data.length : Object.keys(res.data.data || {}));
      console.log("Sample of pipeline data:", JSON.stringify(res.data.data ? res.data.data.slice(0, 2) : null, null, 2));
      
      const allContacts = res.data.data || [];

      console.log(`Successfully fetched ${allContacts.length} contacts from pipeline.`);
      
      const matches = allContacts.filter(c => 
        (c.client_name && c.client_name.toLowerCase().includes('wiky')) ||
        (c.client_name && c.client_name.toLowerCase().includes('herrera'))
      );

      console.log(`Found ${matches.length} matches:`);
      matches.forEach((c, idx) => {
        console.log(`[${idx}] phone_number: ${c.phone_number} | client_name: ${c.client_name} | stage: ${c.stage} | category: ${c.category_name}`);
      });
      
      if (matches.length > 0) {
        console.log("\nDetails of the first match:", JSON.stringify(matches[0], null, 2));
      }

    } else {
      console.log("Failed to fetch pipeline:", res.data);
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
