const axios = require('axios');

async function testResolution() {
  const evUrl = "https://evolution-api-production-8b953.up.railway.app";
  const evKey = "lwJAq9M4NwHmtM5bqk1k";
  const instanceName = "NuevaPrueba01"; // Let's check this or another instance

  // We can try to get connected instances first
  try {
    const instRes = await axios.get(`${evUrl}/instance/fetchInstances`, {
      headers: { apikey: evKey }
    });
    console.log("Connected instances:", instRes.data.filter(i => i.connectionStatus === 'CONNECTED').map(i => i.instanceName));
  } catch (err) {
    console.error("Error fetching instances:", err.message);
  }

  // Let's test the LIDs
  const lids = ["161074661863530@lid", "171202396065822@lid", "100038948741313@lid"];
  const instances = ["NuevaPrueba01", "Zaza2"]; // Let's test these instance names

  for (const instance of instances) {
    console.log(`\n=================== TESTING INSTANCE: ${instance} ===================`);
    for (const lid of lids) {
      console.log(`\n--- LID: ${lid} ---`);
      
      // Method 1: POST /chat/fetchProfile
      try {
        const res = await axios.post(`${evUrl}/chat/fetchProfile/${instance}`, {
          number: lid
        }, {
          headers: { apikey: evKey }
        });
        console.log("Method 1 (fetchProfile) status:", res.status);
        console.log("Method 1 data:", JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.warn("Method 1 error:", err.response?.status, err.response?.data || err.message);
      }

      // Method 2: GET /contact/profile/{{remoteJid}} (Wait, in Evolution API, is it /contact/profile/{{instance}}?number={{number}} or /contact/profile/{{number}}?)
      // Actually, Evolution API contact profile endpoint is usually GET /contact/profile/[instance]?number=...
      try {
        const res = await axios.get(`${evUrl}/contact/profile/${instance}`, {
          params: { number: lid },
          headers: { apikey: evKey }
        });
        console.log("Method 2 (GET /contact/profile) status:", res.status);
        console.log("Method 2 data:", JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.warn("Method 2 error:", err.response?.status, err.response?.data || err.message);
      }
    }
  }
}

testResolution();
