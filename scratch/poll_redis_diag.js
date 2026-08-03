async function runRedisDiag() {
  const maxRetries = 15;
  const delay = 5000;

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`[Intento ${i}/${maxRetries}] Consultando redis-diag...`);
      const response = await fetch("https://zaza-click-20-production.up.railway.app/api/instances/redis-diag");
      if (response.status === 200) {
        const json = await response.json();
        console.log("\n✅ ¡ÉXITO! Datos de Redis leídos:");
        console.log(JSON.stringify(json, null, 2));
        return;
      }
    } catch (err) {
      console.log(`⚠️ Error: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  console.log("❌ El despliegue de redis-diag falló o tardó demasiado.");
}

runRedisDiag();
