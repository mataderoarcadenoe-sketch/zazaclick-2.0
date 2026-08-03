const realKey = 'B6D711FCDE4D4FD5936544120E713976';
const instance = 'Chat01';

async function checkWebhook() {
  try {
    console.log(`Consultando configuración del webhook para la instancia: ${instance}...`);
    const response = await fetch(`https://api.wps.sycompro.com/webhook/find/${instance}`, {
      method: 'GET',
      headers: {
        'apikey': realKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log("Configuración del Webhook devuelta por Evolution API:");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Error al consultar webhook:", err.message);
  }
}

checkWebhook();
