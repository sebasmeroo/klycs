import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import admin from "firebase-admin"; // <--- RE-AÑADIR IMPORT DE ADMIN (solo para tipos/valores)
import { getStripeInstance, handleAccountUpdate, db } from "./index.js"; // Importar db

// Asegúrate de que las funciones importadas (getStripeInstance, handleAccountUpdate) estén exportadas en index.ts si no lo están ya
// O mueve también esas funciones aquí si tiene más sentido y evita dependencias circulares.
// Por ahora, asumimos que están exportadas o son accesibles.

export const stripeWebhookHandler = onRequest(
  { secrets: ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"] }, 
  async (request, response) => {
    logger.info("V1 - Iniciando stripeWebhookHandler (desde stripe-webhooks.ts)...");

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
        logger.error("stripeWebhookHandler: request.rawBody no está disponible.");
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

    // Manejar el evento
    try {
      switch (event.type) {
        case "account.updated":
          const account = event.data.object as Stripe.Account;
          logger.info(`stripeWebhookHandler: Manejando evento account.updated para ${account.id}`);
          await handleAccountUpdate(account); 
          break;
        
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          logger.info(`stripeWebhookHandler: Manejando evento checkout.session.completed para ${session.id}`);
          
          if (session.payment_status === 'paid') {
            logger.info(`Pago confirmado para sesión ${session.id}. Procesando metadatos...`);
            
            const metadata = session.metadata;
            if (!metadata) {
              logger.error(`Faltan metadatos en la sesión ${session.id}. No se puede crear la reserva.`);
              break;
            }
            
            const sellerId = metadata.sellerUid;
            const cardId = metadata.cardId;
            const serviceId = metadata.productId;
            const serviceName = metadata.productName || metadata.serviceName || 'Servicio no especificado';
            const customerName = metadata.customerName;
            const customerEmail = metadata.customerEmail;
            const dateTimeString = metadata.dateTime;
            const professionalId = metadata.professionalId;
            const professionalName = metadata.professionalName;
            const productType = metadata.productType;

            if (!sellerId || !cardId || !serviceId || !customerName || !customerEmail || !dateTimeString || productType !== 'booking') {
                logger.error(`Datos incompletos en metadatos para sesión ${session.id}.`, metadata);
                break; 
            }
            
            let bookingDateTimeStamp: admin.firestore.Timestamp;
            try {
                const bookingDate = new Date(dateTimeString);
                if (isNaN(bookingDate.getTime())) {
                    throw new Error('Formato de fecha inválido en metadatos');
                }
                bookingDateTimeStamp = admin.firestore.Timestamp.fromDate(bookingDate);
            } catch (dateError: any) {
                logger.error(`Error al parsear dateTime '${dateTimeString}' de metadatos para sesión ${session.id}: ${dateError.message}`);
                break; 
            }

            const newBookingData: any = {
              professionalUserId: sellerId, 
              cardId: cardId,
              serviceId: serviceId,
              serviceName: serviceName,
              customerName: customerName,
              customerEmail: customerEmail,
              dateTime: bookingDateTimeStamp,
              status: 'confirmed',
              paymentStatus: 'paid',
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentMethod: 'stripe'
            };

            if (professionalId && professionalId !== 'undefined' && professionalName && professionalName !== 'undefined') {
              newBookingData.professionalId = professionalId;
              newBookingData.professionalName = professionalName;
            }
            
            const targetBookingCollectionPath = `users/${sellerId}/bookings`;
            logger.info(`Intentando guardar reserva confirmada en: ${targetBookingCollectionPath}`, newBookingData);
            await db.collection(targetBookingCollectionPath).add(newBookingData);
            logger.info(`✅ Reserva confirmada por pago guardada exitosamente para sesión ${session.id} en ${targetBookingCollectionPath}.`);

          } else {
            logger.warn(`Evento checkout.session.completed recibido para ${session.id}, pero payment_status es '${session.payment_status}'. No se crea reserva.`);
          }
          break;
        default:
          logger.info(`stripeWebhookHandler: Evento no manejado ${event.type}`);
      }
      response.status(200).send({ received: true });
    } catch (error: any) {
        logger.error(`stripeWebhookHandler: Error al procesar el evento ${event.type} (${event.id}): ${error.message}`, { errorStack: error.stack });
        response.status(200).send({ received: true, processingError: error.message });
    }
  }
); 