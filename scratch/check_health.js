async function checkHealth() {
  try {
    const res = await fetch("https://zaza-click-20-production.up.railway.app/");
    const json = await res.json();
    console.log("Health Check del Backend:", json);
  } catch (err) {
    console.error("Health check falló:", err.message);
  }
}
checkHealth();
