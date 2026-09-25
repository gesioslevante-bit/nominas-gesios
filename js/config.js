// ============================================================
// CONFIGURACIÓN — GESIOS Nóminas
// ============================================================
const msalConfig = {
  auth: {
    clientId: "33fe1962-33ad-41a8-b647-82e649491105",
    authority: "https://login.microsoftonline.com/dc0719cf-1b7a-426b-a68d-e1ac59ba08d7",
    redirectUri: window.location.origin + window.location.pathname,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All"],
};

const SHAREPOINT_SITE_ID = "gesiolevante.sharepoint.com";

const LISTS = {
  parametrosAnuales: "ParametrosAnuales",
  datosIRPF: "DatosIRPF",
  incentivosMensuales: "IncentivosMensuales",
  nominasCalculadas: "NominasCalculadas",
  empleados: "Empleados",
};
