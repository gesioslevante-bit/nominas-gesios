// ============================================================
// ACCESO A SHAREPOINT VÍA MICROSOFT GRAPH API
// ============================================================

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(ruta, opciones = {}) {
  const token = await obtenerTokenGraph();
  const respuesta = await fetch(`${GRAPH_BASE}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Graph API error ${respuesta.status}: ${detalle}`);
  }

  if (respuesta.status === 204) return null;
  return respuesta.json();
}

async function leerListaCompleta(nombreLista) {
  const ruta = `/sites/${SHAREPOINT_SITE_ID}/lists/${nombreLista}/items?expand=fields&$top=999`;
  const datos = await graphFetch(ruta);
  return datos.value.map((item) => ({ id: item.id, ...item.fields }));
}

async function crearElementoLista(nombreLista, campos) {
  const ruta = `/sites/${SHAREPOINT_SITE_ID}/lists/${nombreLista}/items`;
  return graphFetch(ruta, {
    method: "POST",
    body: JSON.stringify({ fields: campos }),
  });
}

async function actualizarElementoLista(nombreLista, idElemento, campos) {
  const ruta = `/sites/${SHAREPOINT_SITE_ID}/lists/${nombreLista}/items/${idElemento}/fields`;
  return graphFetch(ruta, {
    method: "PATCH",
    body: JSON.stringify(campos),
  });
}

async function eliminarElementoLista(nombreLista, idElemento) {
  const ruta = `/sites/${SHAREPOINT_SITE_ID}/lists/${nombreLista}/items/${idElemento}`;
  return graphFetch(ruta, { method: "DELETE" });
}
