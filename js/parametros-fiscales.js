// ============================================================
// PARÁMETROS FISCALES — cotización Seguridad Social e IRPF
// ============================================================
// Estos datos son nacionales (no dependen del convenio de
// jardinería) y cambian poco de un año a otro. Se guardan aquí,
// no en SharePoint, porque son constantes técnicas del cálculo,
// no datos de gestión que cambien mes a mes.
//
// CUÁNDO TOCAR ESTE ARCHIVO: cada enero, cuando la Agencia
// Tributaria publique el "Algoritmo de Retenciones" del año
// nuevo (se busca en sede.agenciatributaria.gob.es) y cuando
// la Seguridad Social publique los nuevos tipos de cotización.
// ============================================================

const PARAMETROS_FISCALES = {
  2026: {
    // Cotización a la Seguridad Social — % sobre la base (retribución del mes)
    cotizacionTrabajador: {
      contingenciasComunes: 4.70,
      desempleo: 1.55,
      formacionProfesional: 0.10,
      mei: 0.15,
      // total: 6.50 %
    },
    cotizacionEmpresa: {
      contingenciasComunes: 23.60,
      desempleo: 5.50,
      formacionProfesional: 0.60,
      fogasa: 0.20,
      mei: 0.75,
      // AT y EP (accidentes de trabajo) varía según actividad; jardinería usa ~2.72% orientativo,
      // ajustar si la mutua indica un tipo distinto para GESIOS DEL LEVANTE.
      accidentesTrabajo: 2.72,
    },

    // Escala general de retención IRPF (art. 101 LIRPF / algoritmo AEAT 2026)
    // Válida en TODA España para el cálculo de la retención en nómina
    // (la escala autonómica solo se usa en la declaración anual de la Renta).
    escalaRetencion: [
      { hasta: 12450, cuota: 0, resto: 12450, tipo: 19 },
      { hasta: 20200, cuota: 2365.50, resto: 7750, tipo: 24 },
      { hasta: 35200, cuota: 4225.50, resto: 15000, tipo: 30 },
      { hasta: 60000, cuota: 8725.50, resto: 24800, tipo: 37 },
      { hasta: 300000, cuota: 17901.50, resto: 240000, tipo: 45 },
      { hasta: Infinity, cuota: 125901.50, resto: Infinity, tipo: 47 },
    ],

    minimoPersonal: 5550,
    minimoPersonal65: 1150, // adicional si el contribuyente tiene 65 años o más
    minimoPersonal75: 1400, // adicional si tiene 75 años o más (se suma al de 65)

    minimoDescendiente: [2400, 2700, 4000, 4500], // 1º, 2º, 3º, 4º y siguientes
    minimoDescendienteMenor3: 2800, // adicional si el descendiente tiene menos de 3 años

    gastoGenericoDeducible: 2000,

    // Reducción por obtención de rendimientos del trabajo (art. 20 LIRPF),
    // aplicada para el cálculo de la retención (art. 83 RIRPF)
    // Fórmula oficial 2026 (Algoritmo AEAT, RD-ley 4/2024 y art. 83.3.d RIRPF).
    reduccionRendimientosTrabajo(rnt) {
      if (rnt <= 14852) return 7302;
      if (rnt <= 17673.52) return 7302 - 1.75 * (rnt - 14852);
      if (rnt < 19747.5) return 2364.34 - 1.14 * (rnt - 17673.52);
      return 0;
    },

    // Otros datos del algoritmo oficial 2026
    incrementoGastosDiscapacidadActivo: { de33a65: 3500, desde65: 7750 },
    minimoDiscapacidad: { de33a65: 3000, desde65: 9000 },
    gastosAsistenciaDiscapacidad: 3000, // si ≥65 % o movilidad reducida
    reduccionMasDeDosDescendientes: 600,
    minoracionViviendaPorcentaje: 2, // % sobre la retribución anual
    limiteRetribucionVivienda: 33007.20,
  },
};

function obtenerParametrosFiscales(año) {
  const p = PARAMETROS_FISCALES[año];
  if (!p) {
    throw new Error(
      `No hay parámetros fiscales cargados para el año ${año}. ` +
        `Añade un bloque nuevo en js/parametros-fiscales.js.`
    );
  }
  return p;
}
