// ============================================================
// APP — navegación de pestañas y arranque de cada sección
// ============================================================

document.querySelectorAll(".tab-boton").forEach((boton) => {
  boton.addEventListener("click", () => cambiarTab(boton.dataset.tab));
});

function cambiarTab(nombreTab) {
  document.querySelectorAll(".tab-boton").forEach((b) => b.classList.remove("activo"));
  document.querySelectorAll(".tab-contenido").forEach((c) => c.classList.add("oculto"));

  document.querySelector(`[data-tab="${nombreTab}"]`).classList.add("activo");
  document.getElementById(`tab-${nombreTab}`).classList.remove("oculto");
}

async function cargarDatosIniciales() {
  try {
    const empleados = await leerListaCompleta(LISTS.empleados);
    pintarTablaEmpleados(empleados);
  } catch (error) {
    document.getElementById("tabla-empleados").textContent =
      "Error al cargar empleados: " + error.message;
    console.error(error);
  }
}

function pintarTablaEmpleados(empleados) {
  const contenedor = document.getElementById("tabla-empleados");
  if (empleados.length === 0) {
    contenedor.textContent = "No se encontraron empleados en la lista.";
    return;
  }
  const filas = empleados
    .map((e) => `<tr><td>${e.Title || ""}</td><td>${e.Categoria || ""}</td></tr>`)
    .join("");
  contenedor.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Categoría</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

const observador = new MutationObserver(() => {
  const zonaApp = document.getElementById("zona-app");
  if (!zonaApp.classList.contains("oculto")) {
    cargarDatosIniciales();
    observador.disconnect();
  }
});
observador.observe(document.getElementById("zona-app"), { attributes: true });
