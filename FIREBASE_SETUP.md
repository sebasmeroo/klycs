# Configuración de Firebase para LinkTree

Este documento contiene las instrucciones paso a paso para configurar Firebase para la aplicación LinkTree.

## Requisitos previos

1. Tener una cuenta de Google
2. Tener Node.js y npm instalados en tu máquina

## Paso 1: Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

## Paso 2: Iniciar sesión en Firebase

```bash
firebase login
```

Este comando abrirá una ventana en tu navegador para iniciar sesión con tu cuenta de Google.

## Paso 3: Crear un proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Sigue las instrucciones para crear un nuevo proyecto
4. Cuando termine, haz clic en "Continuar"

## Paso 4: Inicializar Firebase en tu proyecto

```bash
firebase init
```

Durante la inicialización, selecciona los siguientes servicios:
- Firestore
- Functions
- Hosting
- Storage
- Emulators (opcional para desarrollo)

## Paso 5: Configurar Firebase en tu aplicación React

1. En la consola de Firebase, ve a la configuración del proyecto (icono de engranaje)
2. Selecciona "Configuración del proyecto"
3. En la sección "Tus aplicaciones", haz clic en el icono web (</>) para agregar una aplicación web
4. Sigue las instrucciones para registrar tu aplicación
5. Copia el objeto `firebaseConfig` proporcionado

## Paso 6: Instalar dependencias de Firebase

```bash
npm install firebase
npm install firebase-functions firebase-admin --save-dev
```

## Paso 7: Configurar variables de entorno

Crea un archivo `.env` en la raíz de tu proyecto con las siguientes variables:

```
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_FIREBASE_MEASUREMENT_ID=tu_measurement_id
```

Reemplaza los valores con los de tu objeto `firebaseConfig`.

Luego, modifica el archivo `src/firebase/config.ts` para utilizar estas variables:

```typescript
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

export { app, analytics, auth, db, functions, storage };
```

## Paso 8: Configurar reglas de Firestore

En el archivo `firestore.rules`, configura las siguientes reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir a los usuarios leer sus propios documentos
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permitir a cualquiera leer perfiles públicos a través de username
    match /usernames/{username} {
      allow read: if true;
      allow create, update: if request.auth != null && 
                            request.resource.data.uid == request.auth.uid;
    }
    
    // Permitir lectura de datos de ventas solo al vendedor y comprador
    match /sales/{saleId} {
      allow read: if request.auth != null && 
                  (request.auth.uid == resource.data.sellerId || 
                   request.auth.uid == resource.data.buyerId);
    }
    
    // Reglas para descargas
    match /downloads/{downloadId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.buyerId;
    }
  }
}
```

## Paso 9: Configurar reglas de Storage

En el archivo `storage.rules`, configura las siguientes reglas:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permitir acceso a imágenes de avatar a cualquiera
    match /avatars/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permitir acceso a imágenes de productos a cualquiera
    match /products/{userId}/{productId}/image {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permitir acceso a archivos digitales solo a compradores
    match /products/{userId}/{productId}/file {
      allow read: if request.auth != null && resource.metadata.buyerId == request.auth.uid;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Paso 10: Configurar Firebase Functions

Para las Cloud Functions de Firebase, necesitarás:

1. Asegurarte de tener un plan de pago Blaze (pay-as-you-go) para usar funciones que se conecten a servicios externos como Stripe
2. Instalar las dependencias necesarias:

```bash
cd functions
npm install stripe
```

3. Configurar variables de entorno para funciones:

```bash
firebase functions:config:set stripe.secret_key="sk_test_your_stripe_secret_key" stripe.webhook_secret="whsec_your_stripe_webhook_secret" app.url="https://tu-dominio.web.app"
```

## Paso 11: Configurar Stripe Connect

Para integrar Stripe:

1. Crear una cuenta de Stripe
2. Activar Stripe Connect en tu panel de Stripe
3. Configurar los webhooks de Stripe para que apunten a tu función stripeWebhook:

```
https://us-central1-tu-proyecto.cloudfunctions.net/stripeWebhook
```

## Paso 12: Desplegar a Firebase

```bash
firebase deploy
```

O si quieres desplegar servicios específicos:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## Desarrollo local

Para desarrollo local, puedes usar los emuladores de Firebase:

```bash
firebase emulators:start
```

Y configurar tu aplicación para usar los emuladores en modo de desarrollo. 