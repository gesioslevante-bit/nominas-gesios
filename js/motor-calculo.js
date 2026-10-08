// ============================================================
// MOTOR DE CÁLCULO DE NÓMINAS
// ============================================================
// Toma los datos de un empleado (Empleados + DatosIRPF), el año
// vigente (TablaSalarialAnual + ParametrosAnuales de SharePoint,
// más PARAMETROS_FISCALES de parametros-fiscales.js) y devuelve
// el desglose completo de una nómina mensual.
// ============================================================

// ---- 1. Salario base según convenio y categoría --------------

// La lista "Empleados" (heredada de fichajes-gesios) usa nombres de
// categoría que no siempre coinciden literalmente con los del Anexo I
// del convenio. Esta tabla traduce de uno a otro. Si algún día se da
// de alta un empleado con una categoría nueva que no está aquí, se
// añade una línea más — el motor avisará con un error claro si falta.
const EQUIVALENCIAS_CATEGORIA = {
  "OFICIAL ADMINISTRATIVO": "Oficial administrativo",
  "TECNICA": "Tecnico diplomado",
  "OFICIAL JARDINERIA": "Oficial jardinero",
  "AUXILIAR JARDINERIA": "Auxiliar jardinero",
  "TECNICO": "Tecnico licenciado", // Fernando Flores
};

function traducirCategoria(categoriaEmpleado) {
  const clave = normalizar(categoriaEmpleado);
  return EQUIVALENCIAS_CATEGORIA[clave] || categoriaEmpleado;
}

function obtenerSalarioBaseConvenio(categoria, año, tablaSalarial) {
  const categoriaConvenio = traducirCategoria(categoria);
  const fila = tablaSalarial.find(
    (f) => normalizar(f.Categoria ?? f.Title) === normalizar(categoriaConvenio)
  );
  if (!fila) {
    throw new Error(
      `No se encontró la categoría "${categoria}" (traducida a "${categoriaConvenio}") en TablaSalarialAnual. ` +
        `Añádela a EQUIVALENCIAS_CATEGORIA en js/motor-calculo.js si el nombre no coincide.`
    );
  }
  const valor = obtenerValorAño(fila, año);
  if (valor === undefined || valor === null) {
    throw new Error(`No hay salario de convenio para "${categoriaConvenio}" en el año ${año}.`);
  }
  return Number(valor);
}

// SharePoint da a las columnas que empiezan por un número (como "2026")
// un nombre interno codificado tipo "_x0032_0_x0032_6". Esta función
// decodifica esa forma para comparar con el año que buscamos.
function decodificarClaveSharePoint(clave) {
  return clave.replace(/_x00([0-9a-fA-F]{2})_/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

// Busca en una fila el valor de la columna correspondiente a un año,
// sea cual sea el nombre interno real que le haya puesto SharePoint.
function obtenerValorAño(fila, año) {
  const objetivo = String(año);
  if (fila[objetivo] !== undefined) return fila[objetivo]; // caso simple, por si acaso
  for (const clave in fila) {
    if (decodificarClaveSharePoint(clave) === objetivo) return fila[clave];
  }
  return undefined;
}

function normalizar(texto) {
  return (texto || "")
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos
}

// ---- 2. Incentivo automático (diferencia con el pactado) -----

function calcularIncentivo(salarioTotalPactado, salarioBaseConvenio) {
  if (!salarioTotalPactado || salarioTotalPactado <= salarioBaseConvenio) return 0;
  return round2(salarioTotalPactado - salarioBaseConvenio);
}

// ---- 3. Un parámetro concreto de ParametrosAnuales ------------

function obtenerParametroAnual(concepto, año, parametrosAnuales) {
  const fila = parametrosAnuales.find(
    (f) => normalizar(f.Concepto ?? f.Title).includes(normalizar(concepto))
  );
  if (!fila) throw new Error(`No se encontró el concepto "${concepto}" en ParametrosAnuales.`);
  const valor = obtenerValorAño(fila, año);
  if (valor === undefined || valor === null) {
    throw new Error(`No hay valor para "${concepto}" en el año ${año}.`);
  }
  return Number(valor);
}

// ---- 4. Devengos del mes ---------------------------------------

// Jornada completa de referencia según el convenio de jardinería (40 h/semana).
const HORAS_SEMANALES_JORNADA_COMPLETA = 40;

function calcularFactorJornada(horasSemanalesEmpleado) {
  if (!horasSemanalesEmpleado) return 1; // sin dato → se asume jornada completa
  return horasSemanalesEmpleado / HORAS_SEMANALES_JORNADA_COMPLETA;
}

function calcularDevengos({
  categoria,
  año,
  salarioTotalPactado,
  horasSemanales,
  tablaSalarial,
  parametrosAnuales,
  horasExtraLaborable = 0,
  horasExtraFestivo = 0,
}) {
  const factorJornada = calcularFactorJornada(horasSemanales);

  const salarioBaseConvenioCompleta = obtenerSalarioBaseConvenio(categoria, año, tablaSalarial);
  const salarioBaseConvenio = round2(salarioBaseConvenioCompleta * factorJornada);

  // El incentivo se calcula sobre el salario de convenio YA proporcional a la
  // jornada, ya que el salario total pactado de un empleado a tiempo parcial
  // también está pactado en esos términos.
  const incentivo = calcularIncentivo(salarioTotalPactado, salarioBaseConvenio);

  const plusTransporte = round2(
    obtenerParametroAnual("Plus transporte", año, parametrosAnuales) * factorJornada
  );
  const plusConservacion = round2(
    obtenerParametroAnual("Plus conservacion", año, parametrosAnuales) * factorJornada
  );
  const precioHoraExtraLS = obtenerParametroAnual("Hora extra Lunes", año, parametrosAnuales);
  const precioHoraExtraFest = obtenerParametroAnual("Hora extra Domingo", año, parametrosAnuales);

  // Dos pagas extraordinarias (junio y diciembre), cada una de un mes de
  // salario base de convenio (ya proporcional a la jornada), prorrateadas
  // a lo largo de los 12 meses. GESIOS no aplica antigüedad.
  const pagaExtraProrrateada = round2(salarioBaseConvenio / 6);

  const importeHorasExtra = round2(
    horasExtraLaborable * precioHoraExtraLS + horasExtraFestivo * precioHoraExtraFest
  );

  const salario = round2(salarioBaseConvenio + incentivo);

  const totalDevengado = round2(
    salario + pagaExtraProrrateada + plusTransporte + plusConservacion + importeHorasExtra
  );

  return {
    factorJornada,
    salarioBaseConvenio,
    incentivo,
    salario,
    pagaExtraProrrateada,
    plusTransporte,
    plusConservacion,
    importeHorasExtra,
    totalDevengado,
  };
}

// ---- 5. Cotizaciones a la Seguridad Social ---------------------

function calcularCotizacionTrabajador(baseCotizacion, año) {
  const p = obtenerParametrosFiscales(año).cotizacionTrabajador;
  const detalle = {
    contingenciasComunes: round2(baseCotizacion * (p.contingenciasComunes / 100)),
    desempleo: round2(baseCotizacion * (p.desempleo / 100)),
    formacionProfesional: round2(baseCotizacion * (p.formacionProfesional / 100)),
    mei: round2(baseCotizacion * (p.mei / 100)),
  };
  detalle.total = round2(
    detalle.contingenciasComunes + detalle.desempleo + detalle.formacionProfesional + detalle.mei
  );
  return detalle;
}

function calcularCotizacionEmpresa(baseCotizacion, año, bonificacionMensual = 0) {
  const p = obtenerParametrosFiscales(año).cotizacionEmpresa;
  const detalle = {
    contingenciasComunes: round2(baseCotizacion * (p.contingenciasComunes / 100)),
    desempleo: round2(baseCotizacion * (p.desempleo / 100)),
    formacionProfesional: round2(baseCotizacion * (p.formacionProfesional / 100)),
    fogasa: round2(baseCotizacion * (p.fogasa / 100)),
    mei: round2(baseCotizacion * (p.mei / 100)),
    accidentesTrabajo: round2(baseCotizacion * (p.accidentesTrabajo / 100)),
  };
  const subtotal = round2(Object.values(detalle).reduce((a, b) => a + b, 0));
  // Bonificaciones (p. ej. por contratación indefinida de persona con
  // discapacidad) se restan de la cuota empresarial, nunca de la del
  // trabajador. Nunca puede dejar el coste en negativo.
  detalle.bonificacion = -Math.min(bonificacionMensual, subtotal);
  detalle.total = round2(subtotal + detalle.bonificacion);
  return detalle;
}

// ---- 6. IRPF — algoritmo oficial AEAT (art. 82-87 RIRPF) -------

function calcularCuotaEscala(base, escala) {
  if (base <= 0) return 0;
  for (let i = 0; i < escala.length; i++) {
    const limiteInferior = i === 0 ? 0 : escala[i - 1].hasta;
    if (base <= escala[i].hasta) {
      return round2(escala[i].cuota + (base - limiteInferior) * (escala[i].tipo / 100));
    }
  }
  const ultimo = escala[escala.length - 1];
  const limiteInferior = escala[escala.length - 2].hasta;
  return round2(ultimo.cuota + (base - limiteInferior) * (ultimo.tipo / 100));
}

// Clasifica el texto de la lista DatosIRPF ("Ninguna", "33-65%", "65%"...)
// en las tres categorías del algoritmo oficial.
function clasificarDiscapacidad(texto) {
  const t = normalizar(texto);
  if (!t || t.includes("NINGUNA")) return "NINGUNA";
  // "33-65%" contiene "65", así que primero se comprueba el rango parcial.
  if (t.includes("33") && t.includes("65")) return "DE33A65";
  if (t.includes("65") || t.includes("75")) return "DESDE65";
  if (t.includes("33")) return "DE33A65";
  return "NINGUNA";
}

function contarDescendientes(datosIRPF) {
  return [datosIRPF.Hijo1_Año, datosIRPF.Hijo2_Año, datosIRPF.Hijo3_Año, datosIRPF.Hijo4_Año]
    .filter((a) => Number(a) > 0).length;
}

function calcularMinimoPersonalYFamiliar(datosIRPF, fiscal, añoNacimientoEmpleado, año) {
  const edad = añoNacimientoEmpleado ? año - añoNacimientoEmpleado : null;

  // A. Mínimo del contribuyente
  let minCon = fiscal.minimoPersonal;
  if (edad !== null && edad > 64) minCon += fiscal.minimoPersonal65;
  if (edad !== null && edad > 74) minCon += fiscal.minimoPersonal75;

  // B. Mínimo por descendientes
  const hijos = [
    { año: datosIRPF.Hijo1_Año, porEntero: datosIRPF.Hijo1_PorEntero },
    { año: datosIRPF.Hijo2_Año, porEntero: datosIRPF.Hijo2_PorEntero },
    { año: datosIRPF.Hijo3_Año, porEntero: datosIRPF.Hijo3_PorEntero },
    { año: datosIRPF.Hijo4_Año, porEntero: datosIRPF.Hijo4_PorEntero },
  ].filter((h) => Number(h.año) > 0);

  let minDes = 0;
  hijos.forEach((hijo, i) => {
    const orden = Math.min(i, 3);
    const factor = hijo.porEntero ? 1 : 0.5; // por defecto, computado por mitad
    minDes += fiscal.minimoDescendiente[orden] * factor;
    if (Number(hijo.año) > año - 3) minDes += fiscal.minimoDescendienteMenor3 * factor;
  });

  // D. Mínimo por discapacidad del contribuyente
  const grado = clasificarDiscapacidad(datosIRPF.DiscapacidadPropia);
  const movilReducida = datosIRPF.MovilidadReducida === true || datosIRPF.MovilidadReducida === "Si";
  let minDisc = 0;
  if (grado === "DESDE65") minDisc += fiscal.minimoDiscapacidad.desde65;
  else if (grado === "DE33A65") minDisc += fiscal.minimoDiscapacidad.de33a65;
  if (grado === "DESDE65" || (grado === "DE33A65" && movilReducida)) {
    minDisc += fiscal.gastosAsistenciaDiscapacidad;
  }

  return round2(minCon + minDes + minDisc);
}

function truncar2(n) {
  return Math.trunc(n * 100 + 1e-9) / 100;
}

/**
 * Tipo de retención de IRPF (%) según el Algoritmo de cálculo de la
 * Agencia Tributaria, ejercicio 2026 (procedimiento general, art. 82-87 RIRPF).
 * Cubre: trabajador activo, contrato general, sin regularización.
 *
 * @param {number} retribucionAnualEstimada  RETRIB: retribución íntegra anual prevista
 * @param {object} datosIRPF   fila de DatosIRPF (ya mapeada)
 * @param {number|null} añoNacimientoEmpleado
 * @param {number} año
 */
function calcularTipoRetencionIRPF(retribucionAnualEstimada, datosIRPF, añoNacimientoEmpleado, año) {
  const fiscal = obtenerParametrosFiscales(año);
  const RETRIB = retribucionAnualEstimada;
  const ct = fiscal.cotizacionTrabajador;
  const COTIZACIONES = round2(
    RETRIB * (ct.contingenciasComunes + ct.desempleo + ct.formacionProfesional + ct.mei) / 100
  );

  const sit = Number(datosIRPF.SituacionFamiliar) || 3;
  const numDes = contarDescendientes(datosIRPF);
  const grado = clasificarDiscapacidad(datosIRPF.DiscapacidadPropia);
  const movilReducida = datosIRPF.MovilidadReducida === true || datosIRPF.MovilidadReducida === "Si";
  const presviv = ["SI", "SÍ", "S", "TRUE"].includes(normalizar(String(datosIRPF.PagosViviendaHabitual)).replace("Í", "I"));

  // ---- Gastos deducibles (art. 19.2.f LIRPF) ----
  let incrementoDiscapacidad = 0;
  if (grado === "DESDE65" || (grado === "DE33A65" && movilReducida)) {
    incrementoDiscapacidad = fiscal.incrementoGastosDiscapacidadActivo.desde65; // 7.750
  } else if (grado === "DE33A65") {
    incrementoDiscapacidad = fiscal.incrementoGastosDiscapacidadActivo.de33a65; // 3.500
  }
  let OTROSGASTOS = fiscal.gastoGenericoDeducible + incrementoDiscapacidad;
  const retribMenosCotiz = RETRIB - COTIZACIONES;
  if (retribMenosCotiz < 0) OTROSGASTOS = 0;
  else if (OTROSGASTOS > retribMenosCotiz) OTROSGASTOS = retribMenosCotiz;

  // ---- Rendimiento neto y reducción art. 20 ----
  const RNT = Math.max(0, round2(RETRIB - COTIZACIONES));
  const RED20 = round2(fiscal.reduccionRendimientosTrabajo(RNT));
  const RNTREDU = Math.max(0, round2(RNT - OTROSGASTOS - RED20));

  const HIJOS = numDes > 2 ? fiscal.reduccionMasDeDosDescendientes : 0;
  const REDU = HIJOS; // pensionista, desempleado y pensión al cónyuge no aplican
  const BASE = RNTREDU > REDU ? round2(RNTREDU - REDU) : 0;

  const MINPERFA = calcularMinimoPersonalYFamiliar(datosIRPF, fiscal, añoNacimientoEmpleado, año);

  // ---- A. Límites excluyentes de retención (Tabla 1, art. 81 RIRPF) ----
  const tabla1 = {
    1: { 1: 17644, 2: 18694 },            // situación 1 exige al menos un descendiente
    2: { 0: 17197, 1: 18130, 2: 19262 },
    3: { 0: 15876, 1: 16342, 2: 16867 },
  };
  const colDes = Math.min(numDes, 2);
  const limiteExcluyente = (tabla1[sit] && tabla1[sit][colDes]) ?? null;

  const detalle = {
    retribucionAnualEstimada: RETRIB,
    cotizacionAnualEstimada: COTIZACIONES,
    rendimientoNeto: RNT,
    reduccion20: RED20,
    otrosGastos: OTROSGASTOS,
    rendimientoNetoReducido: RNTREDU,
    base: BASE,
    minimoPersonalYFamiliar: MINPERFA,
    limiteExcluyente,
  };

  if (limiteExcluyente !== null && RETRIB <= limiteExcluyente) {
    return { tipo: 0, detalle: { ...detalle, cuota1: 0, cuota2: 0, cuotaRetencion: 0, motivo: "Por debajo del límite excluyente" } };
  }

  // ---- B. Cuota de retención ----
  const cuota1 = calcularCuotaEscala(BASE, fiscal.escalaRetencion);
  const cuota2 = calcularCuotaEscala(MINPERFA, fiscal.escalaRetencion);
  let CUOTA = cuota1 > cuota2 ? round2(cuota1 - cuota2) : 0;

  // Límite del 43 % (art. 85.3 RIRPF) para retribuciones hasta 35.200 €
  if (RETRIB <= 35200 && limiteExcluyente !== null) {
    const LIMITE = round2((RETRIB - limiteExcluyente) * 0.43);
    if (CUOTA > LIMITE) CUOTA = LIMITE;
  }

  // Minoración por pagos de préstamo de vivienda habitual (RD 1975/2008)
  let MINOPAGO = 0;
  if (RETRIB < fiscal.limiteRetribucionVivienda && presviv) {
    MINOPAGO = truncar2(RETRIB * fiscal.minoracionViviendaPorcentaje / 100);
  }
  const DIFERENCIAPOSITIVA = Math.max(0, round2(CUOTA - MINOPAGO));

  const tipo = RETRIB > 0 ? truncar2((DIFERENCIAPOSITIVA / RETRIB) * 100) : 0;

  return {
    tipo,
    detalle: { ...detalle, cuota1, cuota2, cuotaRetencion: CUOTA, minoracionVivienda: MINOPAGO },
  };
}

// ---- 7. Nómina completa de un mes -------------------------------

function calcularNominaCompleta({
  empleado,       // fila de la lista Empleados
  datosIRPF,      // fila de la lista DatosIRPF (mismo empleado)
  año,
  tablaSalarial,
  parametrosAnuales,
  horasExtraLaborable = 0,
  horasExtraFestivo = 0,
  retribucionAnualEstimada, // si no se pasa, se estima con los fijos × 12
}) {
  const devengos = calcularDevengos({
    categoria: empleado.Categoria,
    año,
    salarioTotalPactado: empleado.SalarioTotalPactado,
    horasSemanales: empleado.HorasSemanales,
    tablaSalarial,
    parametrosAnuales,
    horasExtraLaborable,
    horasExtraFestivo,
  });

  const cotizacionTrabajador = calcularCotizacionTrabajador(devengos.totalDevengado, año);
  const cotizacionEmpresa = calcularCotizacionEmpresa(
    devengos.totalDevengado,
    año,
    Number(empleado.BonificacionSSMensual) || 0
  );

  const retribAnual = retribucionAnualEstimada ?? round2(devengos.totalDevengado * 12);

  const añoNacimiento = datosIRPF && datosIRPF.AñoNacimiento
    ? Number(datosIRPF.AñoNacimiento)
    : null;

  const irpf = calcularTipoRetencionIRPF(retribAnual, datosIRPF || {}, añoNacimiento, año);

  const retencionIRPFmes = round2(devengos.totalDevengado * (irpf.tipo / 100));

  const totalDeducir = round2(cotizacionTrabajador.total + retencionIRPFmes);
  const liquidoAPercibir = round2(devengos.totalDevengado - totalDeducir);

  return {
    devengos,
    cotizacionTrabajador,
    cotizacionEmpresa,
    irpf,
    retencionIRPFmes,
    totalDeducir,
    liquidoAPercibir,
  };
}

// ---- utilidad ----------------------------------------------------

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
