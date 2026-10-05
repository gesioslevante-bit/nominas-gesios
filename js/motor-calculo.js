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
  const valor = fila[String(año)];
  if (valor === undefined || valor === null) {
    throw new Error(`No hay salario de convenio para "${categoriaConvenio}" en el año ${año}.`);
  }
  return Number(valor);
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
  const valor = fila[String(año)];
  if (valor === undefined || valor === null) {
    throw new Error(`No hay valor para "${concepto}" en el año ${año}.`);
  }
  return Number(valor);
}

// ---- 4. Devengos del mes ---------------------------------------

function calcularDevengos({
  categoria,
  año,
  salarioTotalPactado,
  tablaSalarial,
  parametrosAnuales,
  horasExtraLaborable = 0,
  horasExtraFestivo = 0,
}) {
  const salarioBaseConvenio = obtenerSalarioBaseConvenio(categoria, año, tablaSalarial);
  const incentivo = calcularIncentivo(salarioTotalPactado, salarioBaseConvenio);

  const plusTransporte = obtenerParametroAnual("Plus transporte", año, parametrosAnuales);
  const plusConservacion = obtenerParametroAnual("Plus conservacion", año, parametrosAnuales);
  const precioHoraExtraLS = obtenerParametroAnual("Hora extra Lunes", año, parametrosAnuales);
  const precioHoraExtraFest = obtenerParametroAnual("Hora extra Domingo", año, parametrosAnuales);

  // Dos pagas extraordinarias (junio y diciembre), cada una de un mes de
  // salario base de convenio, prorrateadas a lo largo de los 12 meses.
  // GESIOS no aplica antigüedad, así que la paga extra = solo el salario base.
  const pagaExtraProrrateada = round2(salarioBaseConvenio / 6);

  const importeHorasExtra = round2(
    horasExtraLaborable * precioHoraExtraLS + horasExtraFestivo * precioHoraExtraFest
  );

  const salario = round2(salarioBaseConvenio + incentivo);

  const totalDevengado = round2(
    salario + pagaExtraProrrateada + plusTransporte + plusConservacion + importeHorasExtra
  );

  return {
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

function calcularCotizacionEmpresa(baseCotizacion, año) {
  const p = obtenerParametrosFiscales(año).cotizacionEmpresa;
  const detalle = {
    contingenciasComunes: round2(baseCotizacion * (p.contingenciasComunes / 100)),
    desempleo: round2(baseCotizacion * (p.desempleo / 100)),
    formacionProfesional: round2(baseCotizacion * (p.formacionProfesional / 100)),
    fogasa: round2(baseCotizacion * (p.fogasa / 100)),
    mei: round2(baseCotizacion * (p.mei / 100)),
    accidentesTrabajo: round2(baseCotizacion * (p.accidentesTrabajo / 100)),
  };
  detalle.total = round2(Object.values(detalle).reduce((a, b) => a + b, 0));
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

function calcularMinimoPersonalYFamiliar(datosIRPF, fiscal, añoNacimientoEmpleado) {
  const edad = añoNacimientoEmpleado ? new Date().getFullYear() - añoNacimientoEmpleado : null;

  let minCon = fiscal.minimoPersonal;
  if (edad !== null && edad >= 65) minCon += fiscal.minimoPersonal65;
  if (edad !== null && edad >= 75) minCon += fiscal.minimoPersonal75;

  const hijos = [
    { año: datosIRPF.Hijo1_Año, porEntero: datosIRPF.Hijo1_PorEntero },
    { año: datosIRPF.Hijo2_Año, porEntero: datosIRPF.Hijo2_PorEntero },
    { año: datosIRPF.Hijo3_Año, porEntero: datosIRPF.Hijo3_PorEntero },
    { año: datosIRPF.Hijo4_Año, porEntero: datosIRPF.Hijo4_PorEntero },
  ].filter((h) => h.año);

  let minDes = 0;
  const añoActual = new Date().getFullYear();
  hijos.forEach((hijo, i) => {
    const orden = Math.min(i, 3); // 0,1,2,3 → 1º,2º,3º,4º y siguientes
    const factor = hijo.porEntero ? 1 : 0.5;
    minDes += fiscal.minimoDescendiente[orden] * factor;
    const edadHijo = añoActual - Number(hijo.año);
    if (edadHijo < 3) minDes += fiscal.minimoDescendienteMenor3 * factor;
  });

  return round2(minCon + minDes);
}

/**
 * Calcula el tipo de retención de IRPF (%) siguiendo el procedimiento
 * general de retención (art. 82-87 del Reglamento del IRPF).
 *
 * @param {number} retribucionAnualEstimada - suma de todo lo que se prevé
 *   pagar al empleado en el año (fijos × 12 + incentivo previsto + horas
 *   extra previstas). Es la pieza más delicada de estimar bien.
 * @param {object} datosIRPF - fila de la lista DatosIRPF del empleado
 * @param {number} añoNacimientoEmpleado
 * @param {number} año
 */
function calcularTipoRetencionIRPF(retribucionAnualEstimada, datosIRPF, añoNacimientoEmpleado, año) {
  const fiscal = obtenerParametrosFiscales(año);

  const cotizacionAnualEstimada = round2(
    retribucionAnualEstimada * (fiscal.cotizacionTrabajador.contingenciasComunes / 100 +
      fiscal.cotizacionTrabajador.desempleo / 100 +
      fiscal.cotizacionTrabajador.formacionProfesional / 100 +
      fiscal.cotizacionTrabajador.mei / 100)
  );

  const rendimientoNeto = round2(retribucionAnualEstimada - cotizacionAnualEstimada);

  const reduccion20 = fiscal.reduccionRendimientosTrabajo(rendimientoNeto);

  const gastosGenericos = Math.min(fiscal.gastoGenericoDeducible, Math.max(0, rendimientoNeto));

  const rendimientoNetoReducido = Math.max(0, round2(rendimientoNeto - gastosGenericos - reduccion20));

  const minimoPersonalYFamiliar = calcularMinimoPersonalYFamiliar(datosIRPF, fiscal, añoNacimientoEmpleado);

  const cuota1 = calcularCuotaEscala(rendimientoNetoReducido, fiscal.escalaRetencion);
  const cuota2 = calcularCuotaEscala(minimoPersonalYFamiliar, fiscal.escalaRetencion);

  let cuotaRetencion = Math.max(0, round2(cuota1 - cuota2));

  // Límite del 43% para retribuciones no muy altas (simplificado; cubre
  // los casos de plantilla sin cargas familiares atípicas)
  if (retribucionAnualEstimada <= 35200 && Number(datosIRPF.SituacionFamiliar) === 3) {
    const numDescendientes = [datosIRPF.Hijo1_Año, datosIRPF.Hijo2_Año, datosIRPF.Hijo3_Año, datosIRPF.Hijo4_Año].filter(Boolean).length;
    const limiteExento = numDescendientes > 1 ? 16867 : numDescendientes === 1 ? 15617 : 14000; // orientativo, art. 81.1 RIRPF
    const limite = round2((retribucionAnualEstimada - limiteExento) * 0.43);
    if (cuotaRetencion > limite) cuotaRetencion = Math.max(0, limite);
  }

  const tipo = retribucionAnualEstimada > 0
    ? Math.trunc((cuotaRetencion / retribucionAnualEstimada) * 10000) / 100
    : 0;

  return {
    tipo,
    detalle: {
      retribucionAnualEstimada,
      cotizacionAnualEstimada,
      rendimientoNeto,
      reduccion20,
      gastosGenericos,
      rendimientoNetoReducido,
      minimoPersonalYFamiliar,
      cuota1,
      cuota2,
      cuotaRetencion,
    },
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
    tablaSalarial,
    parametrosAnuales,
    horasExtraLaborable,
    horasExtraFestivo,
  });

  const cotizacionTrabajador = calcularCotizacionTrabajador(devengos.totalDevengado, año);
  const cotizacionEmpresa = calcularCotizacionEmpresa(devengos.totalDevengado, año);

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
