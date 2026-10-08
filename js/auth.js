// ============================================================
// AUTENTICACIÓN — MSAL loginRedirect
// Mismo patrón que fichajes-gesios: redirect (no popup), caché
// en localStorage, comprobación de sesión al cargar la página.
// ============================================================

const msalInstance = new msal.PublicClientApplication(msalConfig);
let cuentaActiva = null;

async function inicializarAuth() {
  await msalInstance.initialize();

  // Si venimos de un redirect de login, procesarlo
  const respuesta = await msalInstance.handleRedirectPromise();
  if (respuesta) {
    cuentaActiva = respuesta.account;
  } else {
    const cuentas = msalInstance.getAllAccounts();
    if (cuentas.length > 0) {
      cuentaActiva = cuentas[0];
    }
  }

  actualizarUIsegunSesion();
}

function iniciarSesion() {
  msalInstance.loginRedirect(loginRequest);
}

function cerrarSesion() {
  msalInstance.logoutRedirect();
}

// Devuelve un access token válido para llamar a Microsoft Graph.
// Si el token silencioso falla (expirado, permisos nuevos, etc.),
// cae automáticamente a un login interactivo.
async function obtenerTokenGraph() {
  if (!cuentaActiva) {
    throw new Error("No hay sesión activa. Inicia sesión primero.");
  }
  const params = { ...loginRequest, account: cuentaActiva };
  try {
    const resultado = await msalInstance.acquireTokenSilent(params);
    return resultado.accessToken;
  } catch (error) {
    console.warn("Token silencioso falló, pidiendo login interactivo:", error);
    const resultado = await msalInstance.acquireTokenRedirect(params);
    return resultado.accessToken;
  }
}

function actualizarUIsegunSesion() {
  const zonaLogin = document.getElementById("zona-login");
  const zonaApp = document.getElementById("zona-app");
  const cabeceraUsuario = document.getElementById("cabecera-usuario");
  const nombreUsuario = document.getElementById("nombre-usuario");

  if (cuentaActiva) {
    zonaLogin.classList.add("oculto");
    zonaApp.classList.remove("oculto");
    cabeceraUsuario.classList.remove("oculto");
    if (nombreUsuario) nombreUsuario.textContent = cuentaActiva.name || cuentaActiva.username;
  } else {
    zonaLogin.classList.remove("oculto");
    zonaApp.classList.add("oculto");
    cabeceraUsuario.classList.add("oculto");
  }
}

document.addEventListener("DOMContentLoaded", inicializarAuth);
