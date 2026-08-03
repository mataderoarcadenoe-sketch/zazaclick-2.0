const realKey = 'B6D711FCDE4D4FD5936544120E713976';
const instance = 'Chat01';

async function restartInstance() {
  try {
    console.log(`Enviando petición para reiniciar la instancia ${instance} en Evolution API...`);
    
    const response = await fetch(`https://api.wps.sycompro.com/instance/restart/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': realKey,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log(`Respuesta de la API (HTTP ${response.status}):`);
    console.log(text);

  } catch (err) {
    console.error("Error al reiniciar la instancia:", err.message);
  }
}

restartInstance();
