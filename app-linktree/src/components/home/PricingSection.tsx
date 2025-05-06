import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext'; // Ajustar ruta relativa
import './PricingSection.css'; // Crearemos este archivo para estilos
// Importar funciones de Firestore
import { addDoc, collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Ajustar ruta relativa
import { motion } from 'framer-motion'; // Importar motion

// Definimos la estructura de un plan
interface Plan {
  id: 'FREE' | 'BASIC' | 'PRO';
  name: string;
  price: string;
  priceId?: string; // ID del Precio de Stripe
  features: string[];
  isCurrent?: boolean; // Para marcar el plan actual del usuario
  actionLabel: string; // Texto del botón
  isDisabled?: boolean; // Propiedad para deshabilitar botón
}

// Definir variantes para la animación (similares a FeaturesSection)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1, // Pequeño delay antes de empezar las tarjetas
    },
  },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 12,
    },
  },
};

const PricingSection: React.FC = () => {
  const { effectivePlan, loadingAuth, loadingProfile, user } = useAuth();
  const [processingPlan, setProcessingPlan] = useState<Plan['id'] | null>(null);

  // Mapa de IDs de Precios de Stripe
  const priceIds: Record<'BASIC' | 'PRO', string> = {
    BASIC: 'price_1RJGV5LiYDAQqOb6TLvqXCGH', // ID Precio Básico (10€/mes)
    PRO:   'price_1RJGVvLiYDAQqOb6bLHcCPsC', // ID Precio Profesional (20€/mes)
  };

  const handleSelectPlan = async (planId: 'BASIC' | 'PRO') => {
    if (!user) {
      console.log('Usuario no autenticado.');
      // Idealmente, redirigir a login o mostrar mensaje
      return;
    }

    setProcessingPlan(planId);

    try {
      // CORREGIR RUTA: Usar 'customers' en lugar de 'users' según la documentación de la extensión
      const checkoutSessionRef = collection(db, 'customers', user.uid, 'checkout_sessions');
      const docRef = await addDoc(checkoutSessionRef, {
        price: priceIds[planId], // ID del precio seleccionado
        success_url: window.location.origin + '/dashboard?plan=success', // URL de éxito (ajustar ruta si es necesario)
        cancel_url: window.location.origin + '/#pricing', // URL de cancelación (volver a la home)
        mode: 'subscription', // Indicar que es una suscripción
        // Opcional: permitir códigos de promoción
        // allow_promotion_codes: true,
      });

      // Escuchar cambios en el documento recién creado
      const unsubscribe = onSnapshot(docRef, (snap) => {
        const data = snap.data();
        const error = data?.error;
        const url = data?.url;

        if (error) {
          // Mostrar error al usuario
          console.error(`Error al crear sesión de checkout: ${error.message}`);
          alert(`Error: ${error.message}`); // Mejorar manejo de errores
          setProcessingPlan(null);
          unsubscribe(); // Detener escucha
        }

        if (url) {
          // Redirigir al usuario a la URL de Stripe Checkout
          console.log('Redirigiendo a Stripe...');
          window.location.assign(url);
          // No necesitamos llamar a setProcessingPlan(null) aquí porque navegamos fuera
          unsubscribe(); // Detener escucha
        }
      });

    } catch (error) {
      console.error('Error al iniciar el proceso de checkout:', error);
      alert('Ocurrió un error al intentar iniciar el pago. Inténtalo de nuevo.');
      setProcessingPlan(null);
    }
  };

  // Definir los planes (ahora usamos los priceIds definidos arriba)
  const plans: Plan[] = [
    {
      id: 'FREE',
      name: 'Gratis',
      price: '0€/mes',
      features: [
        '1 Tarjeta de perfil',
        'Enlaces ilimitados',
        '1 Producto en venta',
        'Estadísticas básicas',
      ],
      actionLabel: 'Plan Actual',
    },
    {
      id: 'BASIC',
      name: 'Básico',
      price: '10€/mes',
      priceId: priceIds.BASIC, 
      features: [
        '3 Tarjetas de perfil',
        'Enlaces ilimitados',
        '5 Productos en venta',
        'Personalización básica',
        'Estadísticas detalladas',
      ],
      actionLabel: 'Seleccionar Plan',
    },
    {
      id: 'PRO',
      name: 'Profesional',
      price: '20€/mes', // Corregido a 20€
      priceId: priceIds.PRO,
      features: [
        'Tarjetas ilimitadas',
        'Enlaces ilimitados',
        'Productos ilimitados',
        'Sistema de Reservas/Booking',
        'Aceptar pagos directos',
        'Personalización avanzada',
        'Soporte prioritario',
      ],
      actionLabel: 'Seleccionar Plan',
    },
  ];

  // Marcar el plan actual y ajustar etiqueta del botón
  const processedPlans = plans.map(plan => {
    const isCurrent = !loadingAuth && !loadingProfile && plan.id === effectivePlan;
    let actionLabel = plan.actionLabel;
    let isDisabled = false;
    let isProcessing = processingPlan === plan.id;

    if (isCurrent) {
      actionLabel = 'Plan Actual';
      isDisabled = true;
    } else if (effectivePlan === 'PRO' && (plan.id === 'FREE' || plan.id === 'BASIC')) {
      actionLabel = 'Plan Incluido';
      isDisabled = true;
    } else if (effectivePlan === 'BASIC' && plan.id === 'FREE') {
      actionLabel = 'Plan Incluido';
      isDisabled = true;
    } else if (!user) {
      // actionLabel = 'Registrarse Gratis'; // Ya no aplica si se maneja en la ruta
      if (plan.id !== 'FREE') {
        actionLabel = 'Seleccionar Plan'; // Usuario no logueado ve botones de pago
      } else {
        actionLabel = 'Empieza Gratis'; // O etiqueta para el plan free si no logueado
        isDisabled = true; // O redirigir a registro
      }
    }
    // else {
    //   // Determinar si es upgrade o downgrade (opcional)
    //   // actionLabel = 'Actualizar';
    // }

    // Deshabilitar todos los botones si se está procesando uno
    isDisabled = isDisabled || !!processingPlan;

    return { 
      ...plan, 
      isCurrent, 
      actionLabel: isProcessing ? 'Procesando...' : actionLabel, 
      isDisabled 
    };
  });

  return (
    <motion.section 
      className="pricing-section"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }} // Animar cuando 20% sea visible
      variants={containerVariants} // Usar variantes de contenedor
    >
      {/* Animar título y subtítulo también? (Opcional) */}
      <motion.h2 
          className="pricing-title" 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
      >Elige tu Plan</motion.h2>
      <motion.p 
          className="pricing-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
      >Empieza gratis o desbloquea todo el potencial con nuestros planes premium.</motion.p>
      
      <motion.div 
        className="pricing-container" 
        // Controlado por staggerChildren del padre (section)
      >
        {processedPlans.map((plan) => (
          <motion.div 
            key={plan.id} 
            className={`pricing-card ${plan.isCurrent ? 'current' : ''} ${plan.id === 'PRO' ? 'highlighted' : ''}`} 
            variants={cardVariants} // Usar variantes de tarjeta
          >
            <h3>{plan.name}</h3>
            <p className="price">{plan.price}</p>
            <ul>
              {plan.features.map((feature, index) => (
                // Añadir icono check
                <li key={index}>✓ {feature}</li>
              ))}
            </ul>
            <button 
              className={`btn ${plan.id === 'PRO' ? 'btn-primary-pro' : (plan.id === 'FREE' ? 'btn-secondary' : 'btn-primary-basic')}`}
              onClick={() => {
                if(plan.id === 'BASIC' || plan.id === 'PRO') {
                   handleSelectPlan(plan.id);
                }
              }}
              disabled={plan.isDisabled || loadingAuth || loadingProfile}
              // Añadir animación al botón? (Opcional)
              // whileHover={{ scale: 1.05 }}
              // whileTap={{ scale: 0.95 }}
            >
              {loadingAuth || loadingProfile ? 'Cargando...' : plan.actionLabel}
            </button>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
};

export default PricingSection; 