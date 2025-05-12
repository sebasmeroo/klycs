import { HttpsError, onCall, onRequest, CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import Stripe from "stripe";

// Inicializar Firebase Admin SDK si no se ha hecho
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
// --- EXPORTAR DB ---
export { db };

// Estas variables podrían ser undefined durante el análisis del CLI,
// pero se espera que estén presentes en el entorno de ejecución de la nube.
// Simplemente logueamos su estado en tiempo de carga para información, sin causar errores.
logger.info(`[GLOBAL SCOPE AT LOAD/ANALYSIS] STRIPE_SECRET_KEY_FROM_ENV_LOAD_TIME: ${process.env.STRIPE_SECRET_KEY ? 'Defined' : 'Undefined (expected at runtime)'}`);
logger.info(`[GLOBAL SCOPE AT LOAD/ANALYSIS] APP_URL_FROM_ENV_LOAD_TIME: ${process.env.APP_URL ? 'Defined' : 'Undefined (expected at runtime)'}`);

let stripeInstance: Stripe | null = null;

/**
 * Obtiene o crea una instancia del SDK de Stripe.
 * Esta función DEBE llamarse en tiempo de ejecución dentro de una función,
 * no en el alcance global.
 */
export function getStripeInstance(): Stripe {
    if (stripeInstance) {
        logger.debug("[getStripeInstance] Returning existing Stripe instance.");
        return stripeInstance;
    }

    const currentStripeSecretKey = process.env.STRIPE_SECRET_KEY; // Re-check at runtime
    if (!currentStripeSecretKey) {
        logger.error("[getStripeInstance] CRITICAL: STRIPE_SECRET_KEY is not available in process.env at RUNTIME.");
        // Este error es en tiempo de ejecución, lo que está bien.
        throw new Error("Server configuration error: Stripe secret key missing at runtime.");
    }

    try {
        logger.info("[getStripeInstance] Creating new Stripe SDK instance.");
        stripeInstance = new Stripe(currentStripeSecretKey, {
            apiVersion: "2024-04-10" as Stripe.LatestApiVersion,
            typescript: true,
        });
        logger.info("[getStripeInstance] New Stripe SDK instance initialized successfully at runtime.");
        return stripeInstance;
    } catch (e: any) {
        logger.error("[getStripeInstance] CRITICAL: Failed to initialize Stripe SDK at runtime:", e.message);
        throw new Error("Server error: Could not initialize payment SDK.");
    }
}

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
  currency?: string;
  metadata?: {
    cardId?: string;
    serviceId?: string;
    dateTime?: string;
    customerName?: string;
    customerEmail?: string;
    sellerUserId?: string;
    professionalId?: string;
    professionalName?: string;
  }
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
    logger.info("V4 - Running createStripeConnectAccountLink for user:", request.auth?.uid);

    let stripeSdk: Stripe;
    try {
        stripeSdk = getStripeInstance();
    } catch (e: any) {
        logger.error("createStripeConnectAccountLink: Failed to get/initialize Stripe instance.", { errorMessage: e.message, errorStack: e.stack });
        throw new HttpsError("internal", e.message || "Payment system configuration error.");
    }

    const currentAppUrl = process.env.APP_URL; // Re-check APP_URL at runtime
    if (!currentAppUrl) {
        logger.error("createStripeConnectAccountLink: CRITICAL - APP_URL not available in process.env at RUNTIME.");
        throw new HttpsError("internal", "Server configuration error: Application URL missing.");
    }
    
    if (!request.auth) {
      logger.warn("createStripeConnectAccountLink: Unauthenticated access attempt.");
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    logger.info(`createStripeConnectAccountLink: Processing for userId: ${userId} using APP_URL: ${currentAppUrl}`);

    try {
      const userDocRef = db.collection("users").doc(userId);
      const userDoc = await userDocRef.get();
      const userData = userDoc.data();
      let stripeAccountId = userData?.stripeAccountId;

      if (stripeAccountId) {
        logger.info(`createStripeConnectAccountLink: User ${userId} already has Stripe Account ID: ${stripeAccountId}`);
      } else {
        logger.info(`createStripeConnectAccountLink: Creating new Stripe Account for ${userId}`);
        const account = await stripeSdk.accounts.create({
          type: "express",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: "individual",
          metadata: { userId },
        });
        stripeAccountId = account.id;
        logger.info(`createStripeConnectAccountLink: New Stripe Account ID '${stripeAccountId}' created for ${userId}`);
        await userDocRef.set({ stripeAccountId: stripeAccountId, stripeConnected: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        logger.info(`createStripeConnectAccountLink: Stripe Account ID '${stripeAccountId}' saved for ${userId}, marked as not connected yet.`);
      }

      logger.info(`createStripeConnectAccountLink: Creating Account Link for Stripe Account ID: ${stripeAccountId}`);
      const accountLink = await stripeSdk.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${currentAppUrl}/dashboard?stripe_refresh=true&account_id=${stripeAccountId}`,
        return_url: `${currentAppUrl}/dashboard?stripe_return=true&account_id=${stripeAccountId}`,
        type: "account_onboarding",
      });

      logger.info(`createStripeConnectAccountLink: Account Link created successfully: ${accountLink.url}`);
      return { url: accountLink.url };

    } catch (error: any) {
      logger.error(`createStripeConnectAccountLink: Error processing for ${userId}:`, { errorMessage: error.message, errorStack: error.stack, stripeErrorType: error.type });
      let message = "An internal error occurred while trying to connect with Stripe.";
      if (error.type === 'StripeCardError') {
          message = error.message;
      } else if (error.code) {
          message = `Database error: ${error.message}`;
      } else if (error.message) {
          message = error.message;
      }
      throw new HttpsError("internal", message);
    }
  }
);

/**
 * Función para desconectar una cuenta de Stripe
 */
export const disconnectStripeAccount = onCall(
  async (request: CallableRequest<DisconnectStripeAccountData>) => {
    logger.info("V4 - Running disconnectStripeAccount for user:", request.auth?.uid);

    if (!request.auth) {
      logger.warn("disconnectStripeAccount: Unauthenticated access attempt.");
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const userId = request.auth.uid;

    try {
        const userDocRef = db.collection("users").doc(userId);
        const userDoc = await userDocRef.get();
        const userData = userDoc.data();
        const stripeAccountId = userData?.stripeAccountId;

        if (!stripeAccountId && !userData?.stripeConnected) {
            logger.info(`disconnectStripeAccount: User ${userId} has no Stripe account connected or already marked as disconnected.`);
            return { success: true, message: "No Stripe account was connected." };
        }
        
        await userDocRef.update({
            stripeConnected: false,
            stripeDisconnectedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`disconnectStripeAccount: User ${userId} (Stripe Account: ${stripeAccountId || 'N/A'}) marked as disconnected in Firestore.`);
        
        return { success: true, message: "Stripe account disconnected successfully." };

    } catch (error: any) {
        logger.error(`disconnectStripeAccount: Error for ${userId}:`, error);
        throw new HttpsError("internal", error.message || "Error disconnecting Stripe account.");
    }
  }
);

/**
 * Crear una sesión de pago con Stripe Checkout
 */
export const createCheckoutSession = onCall(
  { secrets: ["STRIPE_SECRET_KEY", "APP_URL"] },
  async (request: CallableRequest<CreateCheckoutSessionData>) => {
    logger.info("V4 - Running createCheckoutSession for user:", request.auth?.uid);
    
    const { 
      productId, 
      sellerId, 
      productName, 
      productDescription, 
      productPrice, 
      productType,
      currency = "eur",
      metadata: clientMetadata 
    } = request.data; 

    // Declarar metadataForStripe aquí para que esté disponible en el catch
    let metadataForStripe: Record<string, string> = {};

    let stripeSdk: Stripe;
    try {
        stripeSdk = getStripeInstance();
    } catch (e: any) {
        logger.error("createCheckoutSession: Failed to get/initialize Stripe instance.", e.message);
        throw new HttpsError("internal", e.message || "Payment system configuration error.");
    }

    const currentAppUrl = process.env.APP_URL;
    if (!currentAppUrl) {
        logger.error("createCheckoutSession: CRITICAL - APP_URL not available at RUNTIME.");
        throw new HttpsError("internal", "Server configuration error: Application URL missing.");
    }
    
    if (!sellerId || !productPrice || !productName || !productId) {
        logger.error("createCheckoutSession: Insufficient data to create session.", request.data);
        throw new HttpsError("invalid-argument", "Required payment data is missing.");
    }

    try {
        const sellerUserDoc = await db.collection("users").doc(sellerId).get();
        if (!sellerUserDoc.exists) {
            logger.error(`createCheckoutSession: Seller with ID ${sellerId} not found.`);
            throw new HttpsError("not-found", "The specified seller does not exist.");
        }
        const sellerData = sellerUserDoc.data();
        const sellerStripeAccountId = sellerData?.stripeAccountId;

        if (!sellerStripeAccountId || !sellerData?.stripeConnected) {
            logger.error(`createCheckoutSession: Seller ${sellerId} does not have a connected and enabled Stripe account. AccountID: ${sellerStripeAccountId}, ConnectedStatus: ${sellerData?.stripeConnected}`);
            throw new HttpsError("failed-precondition", "The seller is not currently able to receive payments.");
        }
        
        const sellerUsername = sellerData?.username; 
        if (!sellerUsername) {
             logger.warn(`createCheckoutSession: Seller ${sellerId} does not have a username defined in Firestore. Falling back to sellerId for redirect URL.`);
        }
        
        // Determinar la URL base para redirección (perfil del vendedor)
        const redirectBaseUrl = `${currentAppUrl}/${sellerUsername || sellerId}`; 
        const successRedirectUrl = `${redirectBaseUrl}?payment_success=true&session_id={CHECKOUT_SESSION_ID}&product_id=${productId}&type=${productType}`; // Añadir tipo
        const cancelRedirectUrl = `${redirectBaseUrl}?payment_cancel=true&product_id=${productId}&type=${productType}`; // Añadir tipo

        const amount = Math.round(parseFloat(String(productPrice)) * 100);
        const applicationFeeAmount = Math.round(amount * (PLATFORM_FEE_PERCENT / 100)); 

        if (amount <= 0) {
            logger.error(`createCheckoutSession: Invalid amount ${amount} for product ${productId}.`);
            throw new HttpsError("invalid-argument", "Product price must be positive.");
        }
        if (applicationFeeAmount < 1 && amount > 0) {
          logger.warn(`createCheckoutSession: Application fee (${applicationFeeAmount}) for product ${productId} is very low or zero.`);
        }

        // --- Preparar metadatos para Stripe --- 
        // Limpiar/Reiniciar metadataForStripe aquí dentro del try
        metadataForStripe = {}; 
        
        const addMeta = (key: string, value: any) => {
          if (value !== undefined && value !== null) {
            metadataForStripe[key] = String(value);
          } else {
             metadataForStripe[key] = ''; 
          }
        };
        
        addMeta('productId', productId);
        addMeta('sellerUid', sellerId);
        addMeta('buyerUid', request.auth?.uid || 'anonymous');
        addMeta('productType', productType || 'unknown');
        
        if (clientMetadata) {
          for (const key in clientMetadata) {
            addMeta(key, (clientMetadata as any)[key]); 
          }
        }
        
        logger.info(`createCheckoutSession: Creating session...`); // Log simplificado
        try {
            logger.info('createCheckoutSession: Metadata being sent:', JSON.stringify(metadataForStripe)); 
        } catch (logError) {
            logger.error('Error serializando metadata:', logError);
            logger.info('createCheckoutSession: Metadata (raw):', metadataForStripe); 
        }
        
        const session = await stripeSdk.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: currency,
                    product_data: {
                        name: productName,
                        description: productDescription, 
                    },
                    unit_amount: amount,
                },
                quantity: 1,
            }],
            mode: "payment",
            success_url: successRedirectUrl,
            cancel_url: cancelRedirectUrl,
            payment_intent_data: {
                application_fee_amount: applicationFeeAmount > 0 ? applicationFeeAmount : undefined,
                transfer_data: {
                    destination: sellerStripeAccountId,
                },
                metadata: metadataForStripe
            },
            metadata: metadataForStripe
        });
        
        logger.info(`createCheckoutSession: Session ID ${session.id} created.`);
        return { sessionId: session.id, url: session.url };

    } catch (error: any) {
        logger.error(`createCheckoutSession: Error processing for product ${productId}, seller ${sellerId}:`, error);
        // Ahora metadataForStripe está accesible aquí
        if (error.type === 'StripeInvalidRequestError' && error.message.includes('metadata')) {
             logger.error('Potential metadata issue. Metadata sent:', metadataForStripe); 
        }
        throw new HttpsError("internal", error.message || "Could not process payment at this time.");
    }
  }
);

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
export async function handleAccountUpdate(account: Stripe.Account) {
  logger.info("V2 - Iniciando handleAccountUpdate para Stripe Account ID:", account.id, { accountData: account }); 

  if (!account.id) {
    logger.warn("V2 - handleAccountUpdate recibió un evento sin ID de cuenta. Abortando.", { accountData: account });
    return;
  }

  try {
    logger.info(`V2 - Buscando usuario en Firestore con stripeAccountId: ${account.id}`);
    const usersQuery = await db
      .collection("users")
      .where("stripeAccountId", "==", account.id)
      .get();

    if (usersQuery.empty) {
      logger.warn(`V2 - No se encontró usuario en Firestore para la cuenta de Stripe ${account.id}`);
      return;
    }
    const userDoc = usersQuery.docs[0];
    const userId = userDoc.id;
    logger.info(`V2 - Usuario encontrado en Firestore: ${userId} para Stripe Account ID: ${account.id}`);

    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    const updateData = {
      stripeConnected: chargesEnabled, 
      stripeDetails: {
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        email: account.email, 
        country: account.country,
      },
    };

    logger.info(`V2 - Intentando actualizar Firestore para usuario ${userId} con datos:`, updateData);

    await db.collection("users").doc(userId).update(updateData);
    logger.info(`V2 - Firestore actualizado exitosamente para usuario ${userId} (Stripe Account: ${account.id})`);

  } catch (error: any) {
    logger.error(`V2 - Error en handleAccountUpdate para Stripe Account ID ${account.id}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      accountData: account 
    });
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

// NUEVA FUNCIÓN PARA MANEJAR WEBHOOKS DE STRIPE
/* // Comentado temporalmente para diagnóstico de timeout
export const stripeWebhookHandler = onRequest(
  { secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"] }, 
  async (request, response) => {
    logger.info("V1 - Iniciando stripeWebhookHandler...");

    let stripeSdk: Stripe;
    try {
      stripeSdk = getStripeInstance(); 
    } catch (e: any) {
      logger.error("stripeWebhookHandler: CRITICAL - Failed to get/initialize Stripe instance.", { errorMessage: e.message });
      response.status(500).send(`Webhook Error: Payment system configuration error: ${e.message}`);
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("stripeWebhookHandler: CRITICAL - STRIPE_WEBHOOK_SECRET no está configurado en las variables de entorno en TIEMPO DE EJECUCIÓN.");
      response.status(500).send("Webhook Error: Stripe webhook secret no configurado.");
      return;
    }

    if (request.method !== "POST") {
      logger.warn(`stripeWebhookHandler: Recibida solicitud ${request.method}, se esperaba POST.`);
      response.setHeader("Allow", "POST");
      response.status(405).send("Method Not Allowed");
      return;
    }

    const sig = request.headers["stripe-signature"] as string;
    if (!sig) {
        logger.error("stripeWebhookHandler: No se encontró la cabecera 'stripe-signature'.");
        response.status(400).send("Webhook Error: Falta la firma de Stripe.");
        return;
    }

    let event: Stripe.Event;
    try {
      if (!request.rawBody) {
        logger.error("stripeWebhookHandler: request.rawBody no está disponible. Asegúrate de que el middleware de parsing de body no lo consuma antes.");
        response.status(500).send("Webhook Error: rawBody no disponible para verificación.");
        return;
      }
      event = stripeSdk.webhooks.constructEvent(request.rawBody, sig, webhookSecret);
      logger.info(`stripeWebhookHandler: Evento verificado y construido: ${event.id}, Tipo: ${event.type}`);
    } catch (e: any) { 
      logger.error(`stripeWebhookHandler: Error al verificar o construir el evento webhook: ${e.message}`, { errorStack: e.stack });
      response.status(400).send(`Webhook Error: ${e.message}`);
      return;
    }

    // Manejar el evento. Si llegamos aquí, 'event' está definido y verificado.
    try {
      switch (event.type) {
        case "account.updated":
          const account = event.data.object as Stripe.Account;
          logger.info(`stripeWebhookHandler: Manejando evento account.updated para ${account.id}`);
          await handleAccountUpdate(account); // Llama a tu función existente
          break;
        default:
          logger.info(`stripeWebhookHandler: Evento no manejado ${event.type}`);
      }
      // Responde a Stripe que el evento fue recibido correctamente.
      response.status(200).send({ received: true });
    } catch (error: any) {
        logger.error(`stripeWebhookHandler: Error al procesar el evento ${event.type} (${event.id}): ${error.message}`, { errorStack: error.stack });
        // Responde 200 a Stripe para evitar reintentos si el error es de nuestra lógica interna y no recuperable por Stripe.
        response.status(200).send({ received: true, processingError: error.message });
    }
  }
);
*/

// AÑADIR ESTA LÍNEA AL FINAL PARA RE-EXPORTAR EL WEBHOOK HANDLER
export { stripeWebhookHandler } from "./stripe-webhooks.js"; 