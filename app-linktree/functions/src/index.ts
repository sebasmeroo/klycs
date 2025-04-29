import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Inicializar Stripe con la clave secreta
// ¡ASEGÚRATE QUE ESTA CLAVE ES LA CORRECTA Y ESTÁ SEGURA!
// Idealmente, usa variables de entorno: functions.config().stripe.secret
const stripeSecretKey = functions.config().stripe?.secret;
if (!stripeSecretKey) {
  console.error("ERROR FATAL: La clave secreta de Stripe (stripe.secret) no está configurada en Firebase Functions config.");
  // Puedes lanzar un error o usar una clave inválida para evitar que la función se ejecute sin clave
  // throw new Error("Stripe secret key not configured."); 
}
const stripe = new Stripe(stripeSecretKey || "dummy_key_for_init", { // Usar la clave de config o una dummy para inicializar
  apiVersion: "2024-04-10" as Stripe.LatestApiVersion, // <-- Versión API actualizada y tipo corregido
});

/* // Comentado: El secreto ahora se configura en los parámetros de la extensión
// Secreto del Webhook - ¡MUY IMPORTANTE!
// Intenta leer desde la configuración de Firebase Functions
// Si no está configurado, usa un placeholder TEMPORAL.
// DEBES configurarlo en Firebase y Stripe para producción.
const webhookSecret = functions.config().stripe?.webhook_secret || "whsec_TU_SECRETO_DE_WEBHOOK"; // <-- ¡REEMPLAZA CON EL SECRETO REAL O CONFIGURA LA VARIABLE!
if (webhookSecret === "whsec_TU_SECRETO_DE_WEBHOOK") {
  console.warn("¡¡¡Usando secreto de webhook placeholder!!! Configura functions.config().stripe.webhook_secret");
}
*/

// Configuración de la plataforma
const PLATFORM_FEE_PERCENT = 5; // 5% de comisión

/**
 * Función para crear una cuenta de Stripe Connect
 */
export const createStripeConnectAccountLink = functions.https.onCall(
  async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado para realizar esta acción"
      );
    }

    const userId = context.auth.uid;

    try {
      // Verificar si el usuario ya tiene una cuenta de Stripe
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      let stripeAccountId;

      if (userData?.stripeAccountId) {
        stripeAccountId = userData.stripeAccountId;
      } else {
        // Crear una nueva cuenta de Stripe Connect Express
        const account = await stripe.accounts.create({
          type: "express",
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            userId,
          },
        });

        stripeAccountId = account.id;

        // Guardar el ID de la cuenta de Stripe en Firestore
        await db.collection("users").doc(userId).update({
          stripeAccountId: stripeAccountId,
        });
      }

      // Crear un enlace de onboarding para la cuenta
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${functions.config().app.url}/dashboard?refresh=true`,
        return_url: `${functions.config().app.url}/dashboard?success=true`,
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    } catch (error) {
      console.error("Error al crear cuenta de Stripe:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al crear la cuenta de Stripe"
      );
    }
  }
);

/**
 * Función para desconectar una cuenta de Stripe
 */
export const disconnectStripeAccount = functions.https.onCall(
  async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado para realizar esta acción"
      );
    }

    const userId = context.auth.uid;

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.stripeAccountId) {
        throw new functions.https.HttpsError(
          "not-found",
          "No se encontró una cuenta de Stripe conectada"
        );
      }

      // Desactivar la cuenta (no la eliminamos para mantener el historial)
      await stripe.accounts.update(userData.stripeAccountId, {
        metadata: { disconnected: "true" },
      });

      // Actualizar el estado del usuario en Firestore
      await db.collection("users").doc(userId).update({
        stripeConnected: false,
      });

      return { success: true };
    } catch (error) {
      console.error("Error al desconectar Stripe:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al desconectar la cuenta de Stripe"
      );
    }
  }
);

/**
 * Crear una sesión de pago con Stripe Checkout
 */
export const createCheckoutSession = functions.https.onCall(
  async (data, context) => {
    try {
      const {
        productId,
        sellerId,
        productName,
        productDescription,
        productPrice,
        productType,
      } = data;

      if (
        !productId ||
        !sellerId ||
        !productName ||
        !productPrice ||
        !productType
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Faltan datos requeridos para crear la sesión de pago"
        );
      }

      // Obtener la información del vendedor
      const sellerDoc = await db.collection("users").doc(sellerId).get();
      const sellerData = sellerDoc.data();

      if (!sellerData?.stripeAccountId || !sellerData.stripeConnected) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "El vendedor no tiene una cuenta de Stripe conectada"
        );
      }

      // Calcular la comisión de la plataforma
      const amount = Math.round(productPrice * 100); // Convertir a centavos
      const platformFee = Math.round(amount * (PLATFORM_FEE_PERCENT / 100));

      // Crear la sesión de checkout
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: productName,
                description: productDescription || "",
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${functions.config().app.url}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${functions.config().app.url}/${sellerData.username}`,
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: {
            destination: sellerData.stripeAccountId,
          },
          metadata: {
            productId,
            sellerId,
            productType,
          },
        },
      });

      return { url: session.url };
    } catch (error) {
      console.error("Error al crear sesión de pago:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al crear la sesión de pago"
      );
    }
  }
);

/* // Comentado: Usaremos el webhook de la extensión en su lugar
// --- Webhook para procesar eventos de Stripe (MODIFICADO) --- 
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    console.error("⚠️ Falta la firma de Stripe");
    res.status(400).send("⚠️ Falta la firma de Stripe");
    return;
  }

  // Usar el secreto configurado arriba (ahora comentado)
  // if (!webhookSecret) { ... }

  let event: Stripe.Event;

  try {
    // Verificar que el evento proviene de Stripe
    event = stripe.webhooks.constructEvent(
      req.rawBody, // Firebase Functions v1 provee rawBody
      signature,
      webhookSecret // <-- Esta variable ya no existe aquí
    );
  } catch (error: any) { // Asegurar que capturamos el tipo correcto
    console.error("Error al verificar webhook:", error.message);
    res.status(400).send(`⚠️ Error de verificación: ${error.message}`);
    return;
  }

  // Obtener el objeto de datos para acceso más fácil
  const dataObject = event.data.object as any; // Usar 'any' temporalmente para flexibilidad

  try {
    console.log(`Processing event: ${event.type}`);
    // Manejar los diferentes tipos de eventos
    switch (event.type) {
      case "payment_intent.succeeded":
        // Lógica existente para pagos únicos (mantener si es necesaria)
        await handlePaymentSuccess(dataObject as Stripe.PaymentIntent);
        break;

      case "account.updated":
        // Lógica existente para actualización de cuentas connect (mantener)
        await handleAccountUpdate(dataObject as Stripe.Account);
        break;

      // --- NUEVOS CASOS PARA SUSCRIPCIONES --- 
      case "invoice.paid":
        // Ocurre cuando una suscripción se renueva o se paga por primera vez
        const invoice = dataObject as Stripe.Invoice;
        if (invoice.subscription && invoice.customer) {
           console.log(`Invoice paid for subscription ${invoice.subscription} by customer ${invoice.customer}`);
           // Obtener la suscripción para saber el plan y la fecha fin
           const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
           await updateUserPlanFromSubscription(subscription);
        }
        break;

      case "customer.subscription.updated":
        // Ocurre cuando cambia el estado (ej: cancelada pero activa hasta fin de periodo, reactivada)
        const subscriptionUpdated = dataObject as Stripe.Subscription;
        console.log(`Subscription updated for customer ${subscriptionUpdated.customer}, status: ${subscriptionUpdated.status}`);
        await updateUserPlanFromSubscription(subscriptionUpdated);
        break;

      case "customer.subscription.deleted": // o podría ser invoice.payment_failed si quieres quitar plan antes
        // Ocurre cuando la suscripción termina definitivamente (cancelada y periodo finalizado)
        const subscriptionDeleted = dataObject as Stripe.Subscription;
        console.log(`Subscription deleted for customer ${subscriptionDeleted.customer}`);
        // Establecer plan a FREE para este usuario
        await updateUserPlan(subscriptionDeleted.customer as string, 'FREE', null); 
        break;
      // --- FIN NUEVOS CASOS --- 
        
      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
        break;
    }

    res.status(200).send({ received: true });
  } catch (error) {
    console.error(`Error al procesar el evento ${event.type}:`, error);
    res.status(500).send("Error interno al procesar el evento");
  }
});
*/

/**
 * Manejar el evento de pago exitoso (EXISTENTE - Revisar si aún es necesaria)
 */
/* // Comentado
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  // ... (Tu lógica existente para pagos únicos...)
  console.log("Handling successful payment intent:", paymentIntent.id);
  // ... tu código ... 
}
*/

/**
 * Manejar el evento de actualización de cuenta (EXISTENTE - MANTENER)
 */
async function handleAccountUpdate(account: Stripe.Account) {
  // ... (Tu lógica existente para actualizar estado de cuenta connect) ...
  console.log("Handling account update:", account.id);
  // ... tu código ... 
  try {
    const usersQuery = await db
      .collection("users")
      .where("stripeAccountId", "==", account.id)
      .get();

    if (usersQuery.empty) {
      console.log(`No se encontró usuario para la cuenta ${account.id}`);
      return;
    }
    const userDoc = usersQuery.docs[0];
    const userId = userDoc.id;
    const chargesEnabled = account.charges_enabled;
    
    await db.collection("users").doc(userId).update({
      stripeConnected: chargesEnabled,
      stripeDetails: {
        chargesEnabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
    console.log(`Actualizada cuenta Stripe para usuario ${userId}`);
  } catch (error) {
    console.error("Error al actualizar estado de cuenta:", error);
  }
}

/**
 * NUEVA Función Helper: Actualiza el plan del usuario en Firestore basado en la suscripción de Stripe.
 * (Comentada, ya no la usaremos directamente aquí)
 */
/* // Comentado
async function updateUserPlanFromSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id; // Asume una sola línea de item
  const currentPeriodEnd = subscription.current_period_end; // Timestamp Unix (segundos)

  let newPlan: 'FREE' | 'BASIC' | 'PRO' | 'ADMIN' = 'FREE'; // Por defecto
  let expirationDate: admin.firestore.Timestamp | null = null;

  // Determinar el plan basado en el Price ID (¡AJUSTA ESTOS IDs!)
  const PRICE_ID_BASIC = "price_1RJGV5LiYDAQqOb6TLvqXCGH"; // Reemplaza con tu ID real
  const PRICE_ID_PRO = "price_1RJGVvLiYDAQqOb6bLHcCPsC";   // Reemplaza con tu ID real

  if (priceId === PRICE_ID_BASIC) {
    newPlan = 'BASIC';
  } else if (priceId === PRICE_ID_PRO) {
    newPlan = 'PRO';
  } // ADMIN se manejaría manualmente o por otro método

  // Determinar si el plan debe estar activo
  if ((status === 'active' || status === 'trialing') && currentPeriodEnd) {
    // Si está activa o en trial, establecer la fecha de expiración
    expirationDate = admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000);
  } else {
    // Si está cancelada, incompleta, pasada, etc., tratar como FREE
    newPlan = 'FREE';
    expirationDate = null;
  }

  // Llamar a la función que actualiza Firestore
  await updateUserPlan(customerId, newPlan, expirationDate);
}
*/

/**
 * NUEVA Función Helper: Encuentra al usuario por Stripe Customer ID y actualiza su plan.
 * (Comentada, ya no la usaremos directamente aquí)
 */
/* // Comentado
async function updateUserPlan(customerId: string, plan: 'FREE' | 'BASIC' | 'PRO' | 'ADMIN', expirationDate: admin.firestore.Timestamp | null) {
  if (!customerId) {
    console.error("Intento de actualizar plan sin customerId");
    return;
  }

  // Declarar userId fuera del try para que esté disponible en el catch
  let userId: string | undefined;

  try {
    // 1. Leer el documento del cliente en /customers/{customerId} para obtener el userId
    const customerDocRef = db.collection("customers").doc(customerId);
    const customerDoc = await customerDocRef.get();

    if (!customerDoc.exists) {
      console.error(`No se encontró documento en /customers para Stripe Customer ID: ${customerId}`);
      return;
    }

    // 2. Obtener el userId de Firebase desde el documento del cliente
    const customerData = customerDoc.data();
    userId = customerData?.userId || customerData?.firebaseUid; // <-- ¡VERIFICA EL NOMBRE DEL CAMPO!

    if (!userId) {
      console.error(`No se encontró el campo userId (o firebaseUid) en /customers/${customerId}`);
      return;
    }

    // 3. Obtener la referencia al documento del usuario en /users/{userId}
    const userDocRef = db.collection("users").doc(userId);

    // 4. Datos a actualizar (igual que antes)
    const updateData: { plan: string; planExpirationDate: admin.firestore.Timestamp | null } = {
        plan: plan,
        planExpirationDate: expirationDate,
    };

    // 5. Actualizar el documento del usuario
    console.log(`Actualizando usuario ${userId} (Customer: ${customerId}) a Plan: ${plan}, Expira: ${expirationDate?.toDate()}`);
    await userDocRef.update(updateData);
    console.log(`✅ Usuario ${userId} actualizado correctamente.`);

  } catch(error) {
    // Usar la variable userId declarada fuera si está disponible
    console.error(`Error al actualizar plan para customer ${customerId} (userId: ${userId || 'unknown'}):`, error); 
    // Considerar añadir reintentos o alertas aquí
  }
}
*/

/**
 * Funciones para análisis
 */

// Registrar vista de perfil
export const recordProfileView = functions.https.onCall(
  async (data, context) => {
    try {
      const { profileId } = data;
      
      if (!profileId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Falta el ID del perfil"
        );
      }
      
      // Registrar la vista en Firestore
      await db.collection("profileViews").add({
        profileId,
        visitorId: context.auth?.uid || "anonymous",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: context.rawRequest?.headers["user-agent"] || "unknown",
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error al registrar vista de perfil:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al registrar vista de perfil"
      );
    }
  }
);

// Registrar clic en enlace
export const recordLinkClick = functions.https.onCall(async (data, context) => {
  try {
    const { linkId, profileId } = data;
    
    if (!linkId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Falta el ID del enlace"
      );
    }
    
    // Registrar el clic en Firestore
    await db.collection("linkClicks").add({
      linkId,
      profileId: profileId || "unknown",
      visitorId: context.auth?.uid || "anonymous",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: context.rawRequest?.headers["user-agent"] || "unknown",
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error al registrar clic en enlace:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error al registrar clic en enlace"
    );
  }
});

// Registrar vista de producto
export const recordProductView = functions.https.onCall(
  async (data, context) => {
    try {
      const { productId, profileId } = data;
      
      if (!productId || !profileId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Faltan datos requeridos"
        );
      }
      
      // Registrar la vista en Firestore
      await db.collection("productViews").add({
        productId,
        profileId,
        visitorId: context.auth?.uid || "anonymous",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: context.rawRequest?.headers["user-agent"] || "unknown",
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error al registrar vista de producto:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al registrar vista de producto"
      );
    }
  }
); 