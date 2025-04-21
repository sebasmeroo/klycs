# LinkTree App con Vite + React + Firebase + Stripe

Una plataforma tipo LinkTree que permite a los usuarios crear un perfil personalizado para compartir enlaces y vender productos/servicios digitales directamente.

## Características principales

- 🔐 Autenticación con Firebase
- 🔗 Gestión de enlaces personalizados
- 💰 Venta de productos digitales y servicios
- 💳 Integración con Stripe Connect para recibir pagos directamente
- 📊 Analíticas de visitas y ventas

## Tecnologías

- **Frontend**: Vite, React, TypeScript
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Pagos**: Stripe Connect, Stripe Checkout

## Requisitos previos

- Node.js (versión 14 o superior)
- Cuenta de Firebase
- Cuenta de Stripe

## Instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/app-linktree.git
   cd app-linktree
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura Firebase:
   - Sigue las instrucciones en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

4. Configura las variables de entorno:
   - Crea un archivo `.env` en la raíz del proyecto siguiendo el formato de `.env.example`

5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Estructura del proyecto

```
app-linktree/
├── src/                  # Código fuente
│   ├── components/       # Componentes React
│   ├── pages/            # Páginas de la aplicación
│   ├── firebase/         # Configuración de Firebase
│   ├── hooks/            # Custom hooks
│   └── utils/            # Utilidades
├── functions/            # Funciones Cloud de Firebase
├── public/               # Archivos estáticos
├── .env.example          # Ejemplo de variables de entorno
├── FIREBASE_SETUP.md     # Instrucciones de configuración de Firebase
└── README.md             # Este archivo
```

## Flujo de trabajo

1. **Registro e inicio de sesión**: Los usuarios pueden registrarse y acceder con email/contraseña.
2. **Dashboard**: Los usuarios pueden editar su perfil, añadir enlaces y productos.
3. **Stripe Connect**: Los vendedores pueden conectar sus cuentas de Stripe para recibir pagos.
4. **Perfil público**: Cada usuario tiene un perfil público donde se muestran sus enlaces y productos.
5. **Checkout**: Los visitantes pueden comprar productos digitales o servicios a través de Stripe.

## Modelo de negocio

La plataforma cobra una comisión del 5% por cada venta realizada a través del servicio. Este porcentaje es configurable en las funciones de Firebase.

## Despliegue

Para desplegar a producción:

```bash
npm run build
firebase deploy
```

Para desplegar sólo funciones o hosting:

```bash
firebase deploy --only functions
firebase deploy --only hosting
```

## Licencia

MIT

---

## Contacto

Para cualquier pregunta o sugerencia, contacta a:
- Tu nombre <email@ejemplo.com>

## Desarrollo local

```powershell
cd "ruta\a\app-linktree" ; npm run dev
```

## Despliegue en Firebase

Para desplegar la aplicación en Firebase, sigue estos pasos:

1. Asegúrate de tener instalado Firebase CLI globalmente:

```powershell
npm install -g firebase-tools
```

2. Inicia sesión en Firebase:

```powershell
firebase login
```

3. Construye y despliega la aplicación:

```powershell
npm run deploy
```

o manualmente:

```powershell
npm run build
firebase deploy
```

## Notas para desarrolladores en Windows

En PowerShell, usa punto y coma (`;`) en lugar de `&&` para ejecutar comandos en secuencia:

```powershell
cd "ruta\al\proyecto" ; npm run dev
```
