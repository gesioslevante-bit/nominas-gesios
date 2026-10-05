// ============================================================
// APP — navegación de pestañas y arranque de cada sección
// ============================================================

document.querySelectorAll(".tab-boton").forEach((boton) => {
  boton.addEventListener("click", () => cambiarTab(boton.dataset.tab));
});

// Cachés en memoria de las listas que usa el motor de cálculo,
// para no volver a pedirlas a Graph cada vez que se pulsa "Calcular".
let CACHE_EMPLEADOS = null;
let CACHE_DATOS_IRPF = null;
let CACHE_TABLA_SALARIAL = null;
let CACHE_PARAMETROS_ANUALES = null;

function cambiarTab(nombreTab) {
  document.querySelectorAll(".tab-boton").forEach((b) => b.classList.remove("activo"));
  document.querySelectorAll(".tab-contenido").forEach((c) => c.classList.add("oculto"));

  document.querySelector(`[data-tab="${nombreTab}"]`).classList.add("activo");
  document.getElementById(`tab-${nombreTab}`).classList.remove("oculto");

  if (nombreTab === "calculo") {
    poblarSelectEmpleados();
  }
}

async function cargarDatosIniciales() {
  try {
    const empleados = await leerListaCompleta(LISTS.empleados);
    CACHE_EMPLEADOS = empleados;
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

async function poblarSelectEmpleados() {
  const select = document.getElementById("select-empleado");
  if (select.dataset.poblado === "si") return; // evita recargar cada vez que se cambia de pestaña

  if (!CACHE_EMPLEADOS) {
    CACHE_EMPLEADOS = await leerListaCompleta(LISTS.empleados);
  }

  select.innerHTML = CACHE_EMPLEADOS
    .filter((e) => e.Activo === true || e.Activo === "Si" || e.Activo === "Sí" || e.Activo === undefined)
    .map((e) => `<option value="${e.Title}">${e.Title}</option>`)
    .join("");
  select.dataset.poblado = "si";
}

async function ejecutarCalculo() {
  const contenedorResultado = document.getElementById("resultado-calculo");
  contenedorResultado.innerHTML = "Calculando...";

  try {
    const nombreEmpleado = document.getElementById("select-empleado").value;
    const año = Number(document.getElementById("input-año").value);
    const mes = Number(document.getElementById("select-mes").value);
    const horasLS = Number(document.getElementById("input-horas-ls").value) || 0;
    const horasFest = Number(document.getElementById("input-horas-fest").value) || 0;

    // Cargar (o reutilizar) las listas que hacen falta
    if (!CACHE_DATOS_IRPF) CACHE_DATOS_IRPF = await leerListaCompleta(LISTS.datosIRPF);
    if (!CACHE_TABLA_SALARIAL) CACHE_TABLA_SALARIAL = await leerListaCompleta(LISTS.tablaSalarialAnual);
    if (!CACHE_PARAMETROS_ANUALES) CACHE_PARAMETROS_ANUALES = await leerListaCompleta(LISTS.parametrosAnuales);

    const empleado = CACHE_EMPLEADOS.find((e) => e.Title === nombreEmpleado);
    if (!empleado) throw new Error(`No se encontró el empleado "${nombreEmpleado}".`);

    const datosIRPF = CACHE_DATOS_IRPF.find((d) => (d.Empleado ?? d.Title) === nombreEmpleado) || {};

    const resultado = calcularNominaCompleta({
      empleado,
      datosIRPF,
      año,
      tablaSalarial: CACHE_TABLA_SALARIAL,
      parametrosAnuales: CACHE_PARAMETROS_ANUALES,
      horasExtraLaborable: horasLS,
      horasExtraFestivo: horasFest,
    });

    pintarResultadoCalculo(nombreEmpleado, año, mes, resultado);
  } catch (error) {
    contenedorResultado.innerHTML = `<div class="error-calculo">Error: ${error.message}</div>`;
    console.error(error);
  }
}

function pintarResultadoCalculo(nombreEmpleado, año, mes, r) {
  const nombresMes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const contenedor = document.getElementById("resultado-calculo");
  contenedor.innerHTML = `
    <div class="resultado-nomina">
      <h3>${nombreEmpleado} — ${nombresMes[mes]} ${año}</h3>

      <table>
        <thead><tr><th>Devengos</th><th>Importe</th></tr></thead>
        <tbody>
          <tr><td>Salario (base convenio + incentivo)</td><td>${fmt(r.devengos.salario)}</td></tr>
          <tr><td>Paga extra prorrateada</td><td>${fmt(r.devengos.pagaExtraProrrateada)}</td></tr>
          <tr><td>Plus transporte</td><td>${fmt(r.devengos.plusTransporte)}</td></tr>
          <tr><td>Plus conservación</td><td>${fmt(r.devengos.plusConservacion)}</td></tr>
          <tr><td>Horas extra</td><td>${fmt(r.devengos.importeHorasExtra)}</td></tr>
          <tr class="fila-total"><td>Total devengado</td><td>${fmt(r.devengos.totalDevengado)}</td></tr>
        </tbody>
      </table>

      <table>
        <thead><tr><th>Deducciones</th><th>Importe</th></tr></thead>
        <tbody>
          <tr><td>Cotización SS trabajador (${(r.cotizacionTrabajador.total / r.devengos.totalDevengado * 100).toFixed(2)}%)</td><td>${fmt(r.cotizacionTrabajador.total)}</td></tr>
          <tr><td>Retención IRPF (${r.irpf.tipo}%)</td><td>${fmt(r.retencionIRPFmes)}</td></tr>
          <tr class="fila-total"><td>Total a deducir</td><td>${fmt(r.totalDeducir)}</td></tr>
        </tbody>
      </table>

      <div class="liquido">Líquido a percibir: ${fmt(r.liquidoAPercibir)}</div>

      <p class="nota">Coste empresa este mes (cotizaciones a cargo de la empresa): ${fmt(r.cotizacionEmpresa.total)}</p>
    </div>`;
}

function fmt(numero) {
  return numero.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const observador = new MutationObserver(() => {
  const zonaApp = document.getElementById("zona-app");
  if (!zonaApp.classList.contains("oculto")) {
    cargarDatosIniciales();
    observador.disconnect();
  }
});
observador.observe(document.getElementById("zona-app"), { attributes: true });
