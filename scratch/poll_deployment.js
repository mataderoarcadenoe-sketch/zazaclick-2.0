async function waitAndCheck() {
  const maxRetries = 15;
  const delay = 5000; // 5 segundos

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`[Intento ${i}/${maxRetries}] Consultando endpoint de diagnóstico...`);
      const response = await fetch("https://zaza-click-20-production.up.railway.app/api/instances/webhook-diag/Chat01");
      
      if (response.status === 200) {
        const json = await response.json();
        console.log("\n✅ ¡ÉXITO! Nueva versión del backend activa.");
        console.log(JSON.stringify(json, null, 2));
        return;
      } else if (response.status !== 404) {
        const errText = await response.text();
        console.log(`⚠️ Respuesta no esperada (HTTP ${response.status}): ${errText}`);
      } else {
        console.log("... El servidor sigue devolviendo 404 (código anterior). Esperando compilación...");
      }
    } catch (err) {
      console.log(`⚠️ Error de conexión: ${err.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log("❌ El despliegue de la nueva versión está tardando más de lo normal en Railway.");
}

waitAndCheck();
