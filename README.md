# GESIOS · Nóminas

Esqueleto inicial del proyecto de nóminas, pensado para conectarse
más adelante con `fichajes-gesios`.

## Puesta en marcha

1. **Reutilizar credenciales de Azure AD** — abre `js/config.js` y rellena:
   - `clientId`: el mismo que usa `fichajes-gesios` (o `expedientes-gesios`).
   - El Tenant ID en la línea de `authority`.
   - `SHAREPOINT_SITE_ID`: el Site ID de SharePoint donde vivirán las
     listas de nóminas (puede ser el mismo sitio que fichajes, o uno nuevo).

2. **Añadir el nuevo Redirect URI en Azure AD** (sin crear una app nueva):
   - Azure Portal → Azure Active Directory → App registrations
   - Selecciona la app que ya usan fichajes/expedientes
   - Authentication → Add a platform → Single-page application
   - Añade la URL donde publiques esta app (ej. GitHub Pages)

3. **Crear las listas SharePoint** (nombres exactos en `js/config.js` → `LISTS`):
   - `ParametrosAnuales`
   - `DatosIRPF`
   - `IncentivosMensuales`
   - `NominasCalculadas`
   - (reutiliza la lista `Empleados` que ya existe en fichajes-gesios)

4. **Publicar en GitHub Pages** igual que las otras apps del repo
   `gesioslevante-bit`.

## Estado actual

Esto es solo el esqueleto: login funcional + lectura de prueba de la
lista de empleados para confirmar que la conexión a Graph/SharePoint
funciona. Los tres módulos pendientes son:

- [ ] Motor de cálculo (devengos, cotizaciones, IRPF con el algoritmo
      oficial de la AEAT ya validado)
- [ ] Formulario de incentivos mensuales
- [ ] Generación del PDF de nómina

## Estructura

```
nominas-gesios/
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── config.js    ← credenciales y nombres de listas (EDITAR)
    ├── auth.js      ← login MSAL
    ├── graph.js      ← lectura/escritura genérica en SharePoint
    └── app.js       ← navegación y carga inicial
```
