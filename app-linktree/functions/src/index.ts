import { HttpsError, onCall, onRequest, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import Stripe from "stripe";

// Inicializar Firebase Admin SDK solo si no hay apps existentes
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Leer configuración de forma más segura
// Para 2nd Gen, se usan variables de entorno. Para 1st Gen (o emulador), functions.config()
const stripeSecretKey = process.env.STRIPE_SECRET_KEY; // || functions.config().stripe?.secret; <- functions.config() no se usa en v2
const appUrl = process.env.APP_URL; // || functions.config().app?.url;  <- functions.config() no se usa en v2

let stripe: Stripe | null = null; // Declarar stripe, inicializar como null

if (!stripeSecretKey) {
  logger.error("ERROR CRÍTICO: La clave secreta de Stripe (STRIPE_SECRET_KEY) no está configurada como variable de entorno. Las funciones de Stripe fallarán.");
  // No lanzar error aquí para permitir el despliegue, las funciones individuales lo manejarán.
} else {
  try {
    stripe = new Stripe(stripeSecretKey, { // Inicializar solo si la clave existe
      apiVersion: "2024-04-10" as Stripe.LatestApiVersion,
    });
  } catch (e: any) {
    logger.error("ERROR CRÍTICO: Falló la inicialización de Stripe SDK. Verifica la STRIPE_SECRET_KEY.", e.message);
    // stripe permanecerá null
  }
}

if (!appUrl) {
  logger.error("ERROR CRÍTICO: La URL de la aplicación (APP_URL) no está configurada como variable de entorno. Algunas funciones podrían fallar.");
  // No lanzar error aquí.
}

/* // Comentado: El secreto ahora se configura en los parámetros de la extensión
// Secreto del Webhook - ¡MUY IMPORTANTE!
// Para v2, el secreto del webhook se configura al crear la función del webhook.
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  logger.warn("¡¡¡El secreto del webhook de Stripe (STRIPE_WEBHOOK_SECRET) no está configurado como variable de entorno!!! No se podrán verificar los webhooks.");
}
*/

// Configuración de la plataforma
const PLATFORM_FEE_PERCENT = 5; // 5% de comisión

// Interfaces para los datos esperados en las funciones onCall
interface CreateStripeConnectAccountData { /* Sin datos específicos de entrada */ }
interface DisconnectStripeAccountData { /* Sin datos específicos de entrada */ }
interface CreateCheckoutSessionData {
  productId: string;
  sellerId: string;
  productName: string;
  productDescription?: string;
  productPrice: number;
  productType: string;
}
interface RecordProfileViewData {
  profileId: string;
}
interface RecordLinkClickData {
  linkId: string;
  profileId?: string;
}
interface RecordProductViewData {
  productId: string;
  profileId: string;
}

/**
 * Función para crear una cuenta de Stripe Connect
 */
export const createStripeConnectAccountLink = onCall(
  async (request: CallableRequest<CreateStripeConnectAccountData>) => {
    // INICIO DE VERIFICACIONES DE CONFIGURACIÓN
    if (!stripe) {
      logger.error("Stripe SDK no está inicializado. Verifica la configuración de STRIPE_SECRET_KEY.");
      throw new HttpsError("internal", "Error de configuración del servidor, por favor contacte al soporte.");
    }
    if (!appUrl) { // Esta función también necesita appUrl para refresh_url y return_url
      logger.error("APP_URL no está configurada. Verifica la configuración de APP_URL.");
      throw new HttpsError("internal", "Error de configuración del servidor (URL), por favor contacte al soporte.");
    }
    // FIN DE VERIFICACIONES DE CONFIGURACIÓN

    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para realizar esta acción"
      );
    }

    const userId = request.auth.uid;
    // const data = request.data; // No se usa data para esta función específica

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
        refresh_url: `${appUrl}/dashboard?refresh=true`,
        return_url: `${appUrl}/dashboard?success=true`,
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    } catch (error) {
      logger.error("Error al crear cuenta de Stripe:", error);
      throw new HttpsError(
        "internal",
        "Error al crear la cuenta de Stripe"
      );
    }
  }
);

/**
 * Función para desconectar una cuenta de Stripe
 */
export const disconnectStripeAccount = onCall(
  async (request: CallableRequest<DisconnectStripeAccountData>) => {
    // INICIO DE VERIFICACIONES DE CONFIGURACIÓN
    if (!stripe) {
      logger.error("Stripe SDK no está inicializado. Verifica la configuración de STRIPE_SECRET_KEY.");
      throw new HttpsError("internal", "Error de configuración del servidor, por favor contacte al soporte.");
    }
    // FIN DE VERIFICACIONES DE CONFIGURACIÓN

    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para realizar esta acción"
      );
    }

    const userId = request.auth.uid;
    // const data = request.data; // No se usa data para esta función específica

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.stripeAccountId) {
        throw new HttpsError(
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
      logger.error("Error al desconectar Stripe:", error);
      throw new HttpsError(
        "internal",
        "Error al desconectar la cuenta de Stripe"
      );
    }
  }
);

/**
 * Crear una sesión de pago con Stripe Checkout
 */
export const createCheckoutSession = onCall(
  async (request: CallableRequest<CreateCheckoutSessionData>) => {
    // INICIO DE VERIFICACIONES DE CONFIGURACIÓN
    if (!stripe) {
      logger.error("Stripe SDK no está inicializado. Verifica la configuración de STRIPE_SECRET_KEY.");
      throw new HttpsError("internal", "Error de configuración del servidor, por favor contacte al soporte.");
    }
    if (!appUrl) { // Esta función también necesita appUrl
      logger.error("APP_URL no está configurada. Verifica la configuración de APP_URL.");
      throw new HttpsError("internal", "Error de configuración del servidor (URL), por favor contacte al soporte.");
    }
    // FIN DE VERIFICACIONES DE CONFIGURACIÓN

    // Para v2, la data viene en request.data
    const data = request.data;
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
        throw new HttpsError(
          "invalid-argument",
          "Faltan datos requeridos para crear la sesión de pago"
        );
      }

      // Obtener la información del vendedor
      const sellerDoc = await db.collection("users").doc(sellerId).get();
      const sellerData = sellerDoc.data();

      if (!sellerData?.stripeAccountId || !sellerData.stripeConnected) {
        throw new HttpsError(
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
        success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${sellerData.username || sellerId}`,
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
      logger.error("Error al crear sesión de pago:", error);
      if (error instanceof HttpsError) throw error; // Re-lanzar errores HttpsError
      throw new HttpsError(
        "internal",
        "Error al crear la sesión de pago"
      );
    }
  }
);

/* // Comentado: Usaremos el webhook de la extensión en su lugar
// --- Webhook para procesar eventos de Stripe (MODIFICADO para v2) ---
export const stripeWebhook = onRequest(async (request, response) => {
  const signature = request.headers["stripe-signature"] as string;
  const currentWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // Leer desde env vars

  if (!currentWebhookSecret) {
    logger.error("⚠️ Secreto de webhook no configurado en variables de entorno.");
    response.status(500).send("Error de configuración del servidor (webhook).");
    return;
  }

  if (!signature) {
    logger.error("⚠️ Falta la firma de Stripe en la cabecera.");
    response.status(400).send("⚠️ Falta la firma de Stripe");
    return;
  }

  let event: Stripe.Event;

  try {
    // Verificar que el evento proviene de Stripe usando request.rawBody
    event = stripe.webhooks.constructEvent(
      request.rawBody, // Para v2, se accede a rawBody directamente desde el objeto request
      signature,
      currentWebhookSecret
    );
  } catch (error: any) {
    logger.error("Error al verificar webhook:", error.message);
    response.status(400).send(`⚠️ Error de verificación del webhook: ${error.message}`);
    return;
  }

  // Obtener el objeto de datos para acceso más fácil
  const dataObject = event.data.object as any;

  try {
    logger.info(`Processing event: ${event.type}`);
    // Manejar los diferentes tipos de eventos
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(dataObject as Stripe.PaymentIntent);
        break;

      case "account.updated":
        await handleAccountUpdate(dataObject as Stripe.Account);
        break;

      // --- NUEVOS CASOS PARA SUSCRIPCIONES ---
      case "invoice.paid":
        const invoice = dataObject as Stripe.Invoice;
        if (invoice.subscription && invoice.customer) {
           logger.info(`Invoice paid for subscription ${invoice.subscription} by customer ${invoice.customer}`);
           const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
           await updateUserPlanFromSubscription(subscription);
        }
        break;

      case "customer.subscription.updated":
        const subscriptionUpdated = dataObject as Stripe.Subscription;
        logger.info(`Subscription updated for customer ${subscriptionUpdated.customer}, status: ${subscriptionUpdated.status}`);
        await updateUserPlanFromSubscription(subscriptionUpdated);
        break;

      case "customer.subscription.deleted":
        const subscriptionDeleted = dataObject as Stripe.Subscription;
        logger.info(`Subscription deleted for customer ${subscriptionDeleted.customer}`);
        await updateUserPlan(subscriptionDeleted.customer as string, 'FREE', null);
        break;
      // --- FIN NUEVOS CASOS ---

      default:
        logger.info(`🤷‍♀️ Unhandled event type: ${event.type}`);
        break;
    }

    response.status(200).send({ received: true });
  } catch (error) {
    logger.error(`Error al procesar el evento ${event.type}:`, error);
    response.status(500).send("Error interno al procesar el evento");
  }
});
*/

/**
 * Manejar el evento de pago exitoso (EXISTENTE - Revisar si aún es necesaria)
 */
/* // Comentado
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  logger.info("Handling successful payment intent:", paymentIntent.id);
}
*/

/**
 * Manejar el evento de actualización de cuenta (EXISTENTE - MANTENER)
 */
async function handleAccountUpdate(account: Stripe.Account) {
  logger.info("Handling account update:", account.id);
  try {
    const usersQuery = await db
      .collection("users")
      .where("stripeAccountId", "==", account.id)
      .get();

    if (usersQuery.empty) {
      logger.info(`No se encontró usuario para la cuenta ${account.id}`);
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
    logger.info(`Actualizada cuenta Stripe para usuario ${userId}`);
  } catch (error) {
    logger.error("Error al actualizar estado de cuenta:", error);
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
  const priceId = subscription.items.data[0]?.price.id;
  const currentPeriodEnd = subscription.current_period_end;

  let newPlan: 'FREE' | 'BASIC' | 'PRO' | 'ADMIN' = 'FREE';
  let expirationDate: admin.firestore.Timestamp | null = null;

  const PRICE_ID_BASIC = "price_1RJGV5LiYDAQqOb6TLvqXCGH";
  const PRICE_ID_PRO = "price_1RJGVvLiYDAQqOb6bLHcCPsC";

  if (priceId === PRICE_ID_BASIC) {
    newPlan = 'BASIC';
  } else if (priceId === PRICE_ID_PRO) {
    newPlan = 'PRO';
  }

  if ((status === 'active' || status === 'trialing') && currentPeriodEnd) {
    expirationDate = admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000);
  } else {
    newPlan = 'FREE';
    expirationDate = null;
  }
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
    logger.error("Intento de actualizar plan sin customerId");
    return;
  }
  let userId: string | undefined;
  try {
    const customerDocRef = db.collection("customers").doc(customerId);
    const customerDoc = await customerDocRef.get();
    if (!customerDoc.exists) {
      logger.error(`No se encontró documento en /customers para Stripe Customer ID: ${customerId}`);
      return;
    }
    const customerData = customerDoc.data();
    userId = customerData?.userId || customerData?.firebaseUid;
    if (!userId) {
      logger.error(`No se encontró el campo userId (o firebaseUid) en /customers/${customerId}`);
      return;
    }
    const userDocRef = db.collection("users").doc(userId);
    const updateData: { plan: string; planExpirationDate: admin.firestore.Timestamp | null } = {
        plan: plan,
        planExpirationDate: expirationDate,
    };
    logger.info(`Actualizando usuario ${userId} (Customer: ${customerId}) a Plan: ${plan}, Expira: ${expirationDate?.toDate()}`);
    await userDocRef.update(updateData);
    logger.info(`✅ Usuario ${userId} actualizado correctamente.`);
  } catch(error) {
    logger.error(`Error al actualizar plan para customer ${customerId} (userId: ${userId || 'unknown'}):`, error);
  }
}
*/

/**
 * Funciones para análisis
 */

// Registrar vista de perfil
export const recordProfileView = onCall(
  async (request: CallableRequest<RecordProfileViewData>) => {
    const data = request.data;
    try {
      const { profileId } = data;

      if (!profileId) {
        throw new HttpsError(
          "invalid-argument",
          "Falta el ID del perfil"
        );
      }

      // Registrar la vista en Firestore
      await db.collection("profileViews").add({
        profileId,
        visitorId: request.auth?.uid || "anonymous", // Usar request.auth
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.rawRequest?.headers["user-agent"] || "unknown", // Usar request.rawRequest
      });

      return { success: true };
    } catch (error) {
      logger.error("Error al registrar vista de perfil:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "Error al registrar vista de perfil"
      );
    }
  }
);

// Registrar clic en enlace
export const recordLinkClick = onCall(
  async (request: CallableRequest<RecordLinkClickData>) => {
    const data = request.data;
    try {
      const { linkId, profileId } = data;

      if (!linkId) {
        throw new HttpsError(
          "invalid-argument",
          "Falta el ID del enlace"
        );
      }

      // Registrar el clic en Firestore
      await db.collection("linkClicks").add({
        linkId,
        profileId: profileId || "unknown",
        visitorId: request.auth?.uid || "anonymous", // Usar request.auth
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.rawRequest?.headers["user-agent"] || "unknown", // Usar request.rawRequest
      });

      return { success: true };
    } catch (error) {
      logger.error("Error al registrar clic en enlace:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "Error al registrar clic en enlace"
      );
    }
  }
);

// Registrar vista de producto
export const recordProductView = onCall(
  async (request: CallableRequest<RecordProductViewData>) => {
    const data = request.data;
    try {
      const { productId, profileId } = data;

      if (!productId || !profileId) {
        throw new HttpsError(
          "invalid-argument",
          "Faltan datos requeridos"
        );
      }

      // Registrar la vista en Firestore
      await db.collection("productViews").add({
        productId,
        profileId,
        visitorId: request.auth?.uid || "anonymous", // Usar request.auth
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.rawRequest?.headers["user-agent"] || "unknown", // Usar request.rawRequest
      });

      return { success: true };
    } catch (error) {
      logger.error("Error al registrar vista de producto:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "Error al registrar vista de producto"
      );
    }
  }
); 