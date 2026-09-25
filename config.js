// ============================================================
// CONFIGURACIÓN — GESIOS Nóminas
// ============================================================
// Reutiliza el MISMO registro de aplicación de Azure AD que ya
// usan fichajes-gesios y expedientes-gesios. NO crees una app
// nueva en Azure: copia aquí el Client ID y el Tenant ID que
// aparecen en el config.js (o equivalente) de fichajes-gesios.
//
// Lo único que hay que AÑADIR en Azure AD es un nuevo Redirect
// URI para esta app:
//   Azure Portal > Azure Active Directory > App registrations
//   > (la app de fichajes/expedientes) > Authentication
//   > Add a platform > Single-page application
//   > URI: https://gesioslevante-bit.github.io/nominas-gesios/
//
// (ajusta la URL si vas a publicar en un dominio distinto)
// ============================================================

const msalConfig = {
  auth: {
    clientId: "33fe1962-33ad-41a8-b647-82e649491105",
    authority: "https://login.microsoftonline.com/dc0719cf-1b7a-426b-a68d-e1ac59ba08d7",
    redirectUri: window.location.origin + window.location.pathname,
  },
  cache: {
    cacheLocation: "localStorage", // mismo patrón que fichajes-gesios
    storeAuthStateInCookie: false,
  },
};

// Permisos que necesitamos de Microsoft Graph.
// Empezamos con lectura/escritura de listas SharePoint.
// Si luego necesitas leer datos de fichajes-gesios desde otro
// sitio de SharePoint, puede que haga falta ampliar el scope
// de Sites.Read.All a nivel de tenant (pídeselo al admin si falla).
const loginRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All"],
};

// ID del sitio de SharePoint donde vivirán las listas de nóminas.
// Puedes reutilizar el mismo sitio que fichajes-gesios, o usar
// uno nuevo — en ambos casos, rellena aquí el Site ID (se obtiene
// vía Graph API: GET /sites/{hostname}:/{ruta-del-sitio}).
const SHAREPOINT_SITE_ID = "gesiolevante.sharepoint.com";

// Nombres de las listas SharePoint que usará esta app.
// Deben coincidir EXACTAMENTE con los nombres reales de las listas.
const LISTS = {
  parametrosAnuales: "ParametrosAnuales",
  datosIRPF: "DatosIRPF",
  incentivosMensuales: "IncentivosMensuales",
  nominasCalculadas: "NominasCalculadas",
  // Reutilizamos la lista de empleados de fichajes-gesios (misma fuente,
  // sin duplicar datos). Ajusta el nombre si difiere.
  empleados: "Empleados",
};
