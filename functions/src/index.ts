import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Inicializar Stripe con la clave secreta
// En un entorno real, esta clave debe estar en variables de entorno
const stripe = new Stripe("sk_test_...", {
  apiVersion: "2022-11-15",
});

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

/**
 * Webhook para procesar eventos de Stripe
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    res.status(400).send("⚠️ Falta la firma de Stripe");
    return;
  }

  let event;

  try {
    // Verificar que el evento proviene de Stripe
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      functions.config().stripe.webhook_secret
    );
  } catch (error) {
    console.error("Error al verificar webhook:", error);
    res.status(400).send("⚠️ Error de verificación");
    return;
  }

  try {
    // Manejar los diferentes tipos de eventos
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object);
        break;

      case "account.updated":
        await handleAccountUpdate(event.data.object);
        break;

      default:
        // Ignorar otros eventos
        break;
    }

    res.status(200).send({ received: true });
  } catch (error) {
    console.error(`Error al procesar el evento ${event.type}:`, error);
    res.status(500).send("Error interno al procesar el evento");
  }
});

/**
 * Manejar el evento de pago exitoso
 */
async function handlePaymentSuccess(paymentIntent: any) {
  const {
    id,
    metadata,
    amount,
    application_fee_amount,
    transfer_data,
  } = paymentIntent;

  if (!metadata || !metadata.productId || !metadata.sellerId) {
    console.log("Faltan metadatos en el pago:", id);
    return;
  }

  const { productId, sellerId, productType } = metadata;

  try {
    // Registrar la venta en Firestore
    await db.collection("sales").add({
      paymentIntentId: id,
      productId,
      sellerId,
      buyerId: metadata.buyerId || "anonymous", // En un caso real, esto vendría del usuario autenticado
      amount: amount / 100, // Convertir de centavos a dólares
      fee: application_fee_amount / 100,
      net: (amount - application_fee_amount) / 100,
      productType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "completed",
    });

    // Si es un producto digital, generar URL de descarga
    if (productType === "digital") {
      // Obtener información del producto
      const userDoc = await db.collection("users").doc(sellerId).get();
      const userData = userDoc.data();
      
      if (!userData || !userData.products) return;
      
      const product = userData.products.find(
        (p: any) => p.id === productId
      );
      
      if (!product || !product.fileUrl) return;
      
      // Generar un enlace de descarga firmado
      const fileUrl = product.fileUrl;
      const bucket = storage.bucket();
      const file = bucket.file(fileUrl);
      
      // La URL expira en 24 horas
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 horas
      });
      
      // Guardar el enlace en la colección de descargas
      await db.collection("downloads").add({
        paymentIntentId: id,
        productId,
        sellerId,
        buyerId: metadata.buyerId || "anonymous",
        downloadUrl: signedUrl,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        downloaded: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error al procesar pago exitoso:", error);
  }
}

/**
 * Manejar el evento de actualización de cuenta
 */
async function handleAccountUpdate(account: any) {
  try {
    // Encontrar el usuario asociado con esta cuenta de Stripe
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
    
    // Verificar si la cuenta está habilitada para pagos
    const chargesEnabled = account.charges_enabled;
    
    // Actualizar el estado de conexión de Stripe en el usuario
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