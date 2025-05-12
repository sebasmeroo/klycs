import React, { useState, useEffect } from 'react';
import { doc, getDoc, addDoc, collection, Timestamp, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BookingSettings, BookingService, Professional } from '../cardeditor/types'; // Importar Professional, quitar Card si no se usa directamente aquí
import './BookingForm.css';
import { FiArrowLeft } from 'react-icons/fi';
import { getFunctions, httpsCallable } from 'firebase/functions';
import ServiceStep from './bookingFormSteps/ServiceStep'; // <-- IMPORTAR NUEVO COMPONENTE
import DateStep from './bookingFormSteps/DateStep'; // <-- IMPORTAR NUEVO COMPONENTE
import TimeStep from './bookingFormSteps/TimeStep'; // <-- IMPORTAR NUEVO COMPONENTE
import ProfessionalStep from './bookingFormSteps/ProfessionalStep'; // <-- IMPORTAR NUEVO COMPONENTE
import DetailsStep from './bookingFormSteps/DetailsStep'; // <-- IMPORTAR NUEVO COMPONENTE

// --- NUEVA FUNCIÓN HELPER: hexToRgb ---
const hexToRgb = (hex: string): string | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `${r}, ${g}, ${b}`; // Devuelve string "r, g, b"
  } 
  return null; // Devuelve null si el formato hex es inválido
};
// --- FIN FUNCIÓN HELPER ---

// Interfaz para los datos iniciales
interface InitialBookingData {
  date?: string;
  time?: string;
  serviceId?: string;
  professionalId?: string; // Añadir professionalId opcional
}

interface BookingFormProps {
  cardId: string;
  userId: string; // ID del dueño del negocio/tarjeta
  onClose?: () => void; // onClose ahora es opcional, para "cancelar" o "volver" si el padre lo implementa
  inlineMode?: boolean; // Se usará principalmente para variantes de estilo menores, no para comportamiento modal
  initialStep?: number;
  initialData?: InitialBookingData | null;
  // onInlineComplete podría ya no ser relevante si inlineMode no define un flujo funcionalmente distinto
  onInlineComplete?: (data: { date: string; time: string; serviceId: string; professionalId?: string }) => void;
  accentColor?: string; // <--- AÑADIDO
}

// NUEVO: Interfaz para el componente ProgressBar (opcional, si lo hacemos separado)
// interface ProgressBarProps {
//   currentStep: number;
//   totalSteps: number;
// }

const BookingForm: React.FC<BookingFormProps> = ({
  cardId,
  userId, // Este es el ID del dueño del negocio/tarjeta
  onClose,
  inlineMode = false,
  initialStep = 1,
  initialData = null,
  onInlineComplete,
  accentColor
}) => {
  // Estados para carga y datos de configuración
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true); // Estado específico para settings
  const [errorSettings, setErrorSettings] = useState<string | null>(null); // Estado específico para settings

  // --- NUEVOS ESTADOS PARA PROFESIONALES ---
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false); // Empieza en false, se activa condicionalmente
  const [errorProfessionals, setErrorProfessionals] = useState<string | null>(null);
  // --- FIN NUEVOS ESTADOS ---

  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Estados para los datos recopilados
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialData?.serviceId || '');
  const [selectedDate, setSelectedDate] = useState<string>(initialData?.date || '');
  const [selectedTime, setSelectedTime] = useState<string>(initialData?.time || '');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(initialData?.professionalId || ''); // Estado para profesional seleccionado
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- REFACTORIZADO useEffect ---
  useEffect(() => {
    const fetchBookingData = async () => {
      setLoadingSettings(true);
      setErrorSettings(null);
      setLoadingProfessionals(false); // Resetear estado de profesionales
      setErrorProfessionals(null);
      setProfessionals([]);       // Resetear lista de profesionales
      setSettings(null);         // Resetear settings al inicio de la carga

      // 1. Cargar BookingSettings
      const settingsPath = `cards/${cardId}/bookingSettings/settings`;
      console.log("Intentando leer BookingSettings desde:", settingsPath);
      try {
        const settingsRef = doc(db, settingsPath);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const fetchedSettings = settingsSnap.data() as BookingSettings;
          console.log("BookingSettings encontrados:", fetchedSettings);
          if (fetchedSettings.enabled !== false) { // Considerar true o undefined como habilitado
            setSettings(fetchedSettings);

            // 2. Cargar Profesionales SI está habilitado en settings
            if (fetchedSettings.allowProfessionalSelection) {
              setLoadingProfessionals(true);
              const professionalsPath = `users/${userId}/professionals`;
              console.log("Selección de profesional habilitada. Intentando leer Profesionales desde:", professionalsPath, " (User ID:", userId, ")");
              try {
                const professionalsRef = collection(db, professionalsPath);
                const professionalsQuery = query(professionalsRef); // Podrías añadir filtros aquí si fuera necesario (ej: where('active', '==', true))
                const professionalsSnap = await getDocs(professionalsQuery);
                const professionalsList = professionalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional));
                console.log("Profesionales encontrados:", professionalsList);
                setProfessionals(professionalsList);
                 // Preseleccionar profesional si no viene de initialData y hay profesionales
                 if (!selectedProfessionalId && professionalsList.length > 0) {
                    if (!inlineMode && !initialData?.professionalId) {
                        // Comentar o descomentar según preferencia de preselección
                        // setSelectedProfessionalId(professionalsList[0].id);
                    }
                 }

              } catch (profErr: any) {
                console.error("Error cargando Profesionales:", profErr);
                setErrorProfessionals(`Error al cargar la lista de profesionales: ${profErr.message}. Código: ${profErr.code}`);
                // No parar el flujo necesariamente, pero mostrar el error
              } finally {
                setLoadingProfessionals(false);
              }
            } else {
                console.log("Selección de profesional NO habilitada en BookingSettings.");
                setSelectedProfessionalId(''); // Asegurarse de resetear
            }

          } else {
            setErrorSettings('Las reservas no están habilitadas para esta tarjeta.');
            console.warn("BookingSettings encontrado pero explícitamente deshabilitado:", settingsPath);
          }
        } else {
          setErrorSettings('No se encontró la configuración de reservas (documento "settings").');
          console.error("No existe el documento en:", settingsPath);
        }
      } catch (settingsErr: any) {
        console.error("Error cargando BookingSettings:", settingsErr);
        setErrorSettings(`Error al cargar la configuración: ${settingsErr.message}. Código: ${settingsErr.code}`);
      } finally {
        setLoadingSettings(false);
      }
    };

    // Solo ejecutar si cardId y userId son válidos
    if (cardId && userId) {
        fetchBookingData();
    } else {
        setErrorSettings("Falta información esencial (ID de tarjeta o usuario) para cargar la configuración.");
        setLoadingSettings(false);
    }

  // Dependencias: cardId y userId son cruciales.
  // initialData puede cambiar si el componente se reutiliza.
  // selectedServiceId/selectedProfessionalId no deberían re-lanzar toda la carga,
  // se manejan internamente o con la preselección.
  }, [cardId, userId, inlineMode, initialData]);


  // --- Lógica de pasos (AJUSTADA) ---
  const professionalStepEnabled = settings?.allowProfessionalSelection ?? false;
  const professionalStepAvailable = professionalStepEnabled && !errorProfessionals && professionals.length > 0;

  // Nueva secuencia y cálculo de totalSteps:
  // 1: Fecha, 2: Hora, [3: Profesional si aplica], 4 (o 3): Servicio, 5 (o 4): Detalles
  const baseNumberOfSteps = 4; // Fecha, Hora, Servicio, Detalles son la base
  const totalSteps = baseNumberOfSteps + (professionalStepAvailable ? 1 : 0);

  // Log para depuración
  useEffect(() => {
    console.log(`Modo: ${inlineMode ? 'Inline' : 'Modal'}, Settings Cargados: ${!!settings}, Selección Profesional Habilitada: ${professionalStepEnabled}, Profesionales Cargados: ${professionals.length}, Error Prof: ${errorProfessionals}, Paso Profesional Activo: ${professionalStepAvailable}, Total Pasos: ${totalSteps}`);
  }, [inlineMode, settings, professionalStepEnabled, professionals, errorProfessionals, professionalStepAvailable, totalSteps]);


   // Helper para validación de email simple
   const validateEmail = (email: string) => {
       return /\S+@\S+\.\S+/.test(email);
   }

   // --- NUEVA FUNCIÓN DE VALIDACIÓN PROFESIONAL ---
   const validateProfessional = () => {
     if (!selectedProfessionalId) {
       setFormError('Debes seleccionar un profesional.');
       return false;
     }
     // No necesitamos validar errorProfessionals aquí porque professionalStepAvailable ya lo considera
     return true;
   };

   // Funciones de validación individuales (sin cambios)
   const validateService = () => {
    if (!selectedServiceId) {
      setFormError('Debes seleccionar un servicio.');
      return false;
    }
    // Asegurarse que el servicio seleccionado todavía existe en la config (poco probable que cambie mientras está abierto, pero seguro)
    if (!settings?.services?.find(s => s.id === selectedServiceId)) {
        setFormError('El servicio seleccionado ya no está disponible.');
        setSelectedServiceId(''); // Resetear
        return false;
    }
    return true;
  };
  const validateDate = () => {
     if (!selectedDate) {
      setFormError('Debes seleccionar una fecha.');
      return false;
    }
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     const chosenDate = new Date(selectedDate + 'T00:00:00');
     if (chosenDate < today) {
       setFormError('No puedes seleccionar una fecha pasada.');
       return false;
     }
    return true;
  };
   const validateTime = () => {
      if (!selectedTime) {
       setFormError('Debes seleccionar una hora.');
       return false;
     }
     return true;
   };
   const validateDetails = () => {
     if (!customerName || !customerEmail) {
       setFormError('Debes completar tu nombre y email.');
       return false;
     }
     if (!validateEmail(customerEmail)) {
       setFormError('Por favor, introduce un email válido.');
       return false;
     }
     return true;
   };


  // Mapeo de pasos lógicos a componentes (AJUSTADO)
  const getStepComponent = (step: number): (() => React.JSX.Element | null) => {
    const stepProfessionalActualNum = 3;
    
    if (step === 1) return () => <DateStep selectedDate={selectedDate} onDateChange={d => {setSelectedDate(d); setFormError(null);}} formError={formError} onNextStep={nextStep} onPrevStep={prevStep} currentStep={step}/>;
    if (step === 2) return () => <TimeStep selectedTime={selectedTime} onTimeChange={t => {setSelectedTime(t); setFormError(null);}} formError={formError} onNextStep={nextStep} onPrevStep={prevStep} currentStep={step}/>;
    
    if (professionalStepAvailable) {
      if (step === stepProfessionalActualNum) 
        return () => <ProfessionalStep professionals={professionals} selectedProfessionalId={selectedProfessionalId} onProfessionalChange={id => {setSelectedProfessionalId(id); setFormError(null);}} loadingProfessionals={loadingProfessionals} errorProfessionals={errorProfessionals} formError={formError} onNextStep={nextStep} onPrevStep={prevStep} currentStep={step} totalSteps={totalSteps} inlineMode={inlineMode}/>;
      if (step === stepProfessionalActualNum + 1) // Servicio después de Profesional
        return () => <ServiceStep settings={settings} selectedServiceId={selectedServiceId} onServiceChange={id => {setSelectedServiceId(id); setFormError(null);}} formError={formError} onNextStep={nextStep} onPrevStep={prevStep} currentStep={step} totalSteps={totalSteps} inlineMode={inlineMode} professionalStepAvailable={professionalStepAvailable}/>;
      if (step === stepProfessionalActualNum + 2) // Detalles después de Servicio (con Profesional)
        return () => <DetailsStep customerName={customerName} customerEmail={customerEmail} onCustomerNameChange={setCustomerName} onCustomerEmailChange={setCustomerEmail} formError={formError} onPrevStep={prevStep} onSubmit={handleBookingSubmit} isSubmitting={isSubmitting} currentStep={step}/>;
    } else {
      // Flujo sin Profesional
      if (step === stepProfessionalActualNum) // Servicio es el paso 3 si no hay Profesional
        return () => <ServiceStep settings={settings} selectedServiceId={selectedServiceId} onServiceChange={id => {setSelectedServiceId(id); setFormError(null);}} formError={formError} onNextStep={nextStep} onPrevStep={prevStep} currentStep={step} totalSteps={totalSteps} inlineMode={inlineMode} professionalStepAvailable={professionalStepAvailable}/>;
      if (step === stepProfessionalActualNum + 1) // Detalles es el paso 4 si no hay Profesional
        return () => <DetailsStep customerName={customerName} customerEmail={customerEmail} onCustomerNameChange={setCustomerName} onCustomerEmailChange={setCustomerEmail} formError={formError} onPrevStep={prevStep} onSubmit={handleBookingSubmit} isSubmitting={isSubmitting} currentStep={step}/>;
    }
    
    return () => null; // Default: si el número de paso no coincide, no renderizar nada
  };

  // Funciones de navegación entre pasos (AJUSTADO)
  const nextStep = () => {
    setFormError(null); 
    let isValid = true;
    const currentStepRenderFunc = getStepComponent(currentStep);
    if (!currentStepRenderFunc) return; // No debería ocurrir si la lógica de pasos es correcta
    
    const stepComponentElement = currentStepRenderFunc();
    if (!stepComponentElement || !stepComponentElement.type) return; // Chequeo adicional

    const componentType = stepComponentElement.type; // No se necesita @ts-ignore si se maneja bien

    if (componentType === DateStep) isValid = validateDate();
    else if (componentType === TimeStep) isValid = validateTime();
    else if (componentType === ProfessionalStep) isValid = validateProfessional();
    else if (componentType === ServiceStep) isValid = validateService();
    // DetailsStep se valida a través de su propio botón "onSubmit" que llama a handleBookingSubmit.

    if (!isValid) return;

    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } 
    // La lógica de onInlineComplete para inlineMode se podría revisar o eliminar si inlineMode ya no dicta un flujo distinto.
    // else if (inlineMode && currentStep === totalSteps && onInlineComplete) { 
    //   onInlineComplete({ date: selectedDate, time: selectedTime, serviceId: selectedServiceId, professionalId: professionalStepAvailable ? selectedProfessionalId : undefined });
    // }
  };

  const prevStep = () => {
    setFormError(null);
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };


  // Manejador del envío final (AJUSTADO para incluir professionalId y ruta correcta)
  const handleBookingSubmit = async (e?: React.FormEvent) => {
    if(e) e.preventDefault(); 
    if(!validateDetails()) return; 

    setFormError(null);
    setIsSubmitting(true);

    const selectedService = settings?.services?.find(s => s.id === selectedServiceId);
    const requiresPayment = settings?.acceptOnlinePayments && selectedService && selectedService.price && selectedService.price > 0;

    try {
      if (requiresPayment && selectedService) {
        console.log("Iniciando proceso de pago para reserva...");
        
        const functions = getFunctions();
        const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
        
        const checkoutData = {
            productId: selectedServiceId, 
            sellerId: userId,             
            productName: selectedService.name,
            productDescription: selectedService.description || `Reserva para ${selectedService.name}`,
            productPrice: selectedService.price, 
            currency: 'eur', 
            productType: 'booking', 
            metadata: {
                cardId: cardId,
                serviceId: selectedServiceId,
                dateTime: `${selectedDate}T${selectedTime}:00`, 
                customerName: customerName,
                customerEmail: customerEmail,
                sellerUserId: userId,
                professionalId: professionalStepAvailable ? selectedProfessionalId : undefined,
                professionalName: professionalStepAvailable ? professionals.find(p => p.id === selectedProfessionalId)?.name : undefined
            }
        };
        
        console.log("Llamando a createCheckoutSession con datos:", checkoutData);
        const result = await createCheckoutSession(checkoutData);
        const data = result.data as any;

        if (data?.url) {
            console.log("Sesión de Stripe Checkout creada, redirigiendo a:", data.url);
            window.location.href = data.url; 
        } else {
            throw new Error('No se recibió URL de Stripe Checkout');
        }
        
      } else {
        console.log("Creando reserva directamente en Firestore (sin pago requerido)...");
        const dateTimeString = `${selectedDate}T${selectedTime}:00`;
        const bookingDateTime = new Date(dateTimeString);
        const serviceName = selectedService?.name || 'Servicio no especificado';
        const professionalName = professionalStepAvailable ? professionals.find(p => p.id === selectedProfessionalId)?.name : undefined;

        const newBookingData: any = {
          professionalUserId: userId, 
          cardId: cardId,
          serviceId: selectedServiceId,
          serviceName: serviceName,
          customerName: customerName,
          customerEmail: customerEmail,
          dateTime: Timestamp.fromDate(bookingDateTime),
          status: 'pending', 
          createdAt: Timestamp.now(),
          paymentMethod: 'offline' 
        };

        if (professionalStepAvailable && selectedProfessionalId && professionalName) {
          newBookingData.professionalId = selectedProfessionalId;
          newBookingData.professionalName = professionalName;
        }

        const targetBookingCollectionPath = `users/${userId}/bookings`;
        await addDoc(collection(db, targetBookingCollectionPath), newBookingData);
        console.log("Reserva guardada en Firestore:", targetBookingCollectionPath);
        setBookingSuccess(true); 
        setIsSubmitting(false); 
      }

    } catch (error: any) {
       console.error("Error durante handleBookingSubmit:", error);
       setFormError(`Ocurrió un error al procesar tu solicitud: ${error.message}.`);
       setIsSubmitting(false); 
    } 
  };

  // --- Renderizado Principal (SIN MODAL) ---
  if (loadingSettings) return <div className="booking-form-container loading-state">Cargando configuración...</div>;
  if (errorSettings) return <div className="booking-form-container error-state"><h4>Error al cargar</h4><p>{errorSettings}</p></div>;
  if (!settings || settings.enabled === false) { // Simplificado: si no hay settings o están deshabilitados
    return <div className="booking-form-container notice-state"><p>Las reservas no están habilitadas actualmente.</p></div>;
  }
  if (!settings.services || settings.services.length === 0) { // Chequeo separado para servicios
     return <div className="booking-form-container notice-state"><p>No hay servicios disponibles para reservar en este momento.</p></div>;
  }
  
  if (bookingSuccess) {
    const accentRgb = accentColor ? hexToRgb(accentColor) : null;
    return (
      <div 
        className="booking-form-container success-state"
        style={{
          '--booking-accent-color': accentColor || '#007AFF',
          '--booking-accent-rgb': accentRgb || '0, 122, 255'
        } as React.CSSProperties}
      >
        <h3>¡Reserva Solicitada!</h3>
        <p>Tu solicitud ha sido enviada. Recibirás confirmación por email.</p>
        {/* Aquí podrías añadir un botón para "Hacer otra reserva" o similar si lo deseas */}
      </div>
    );
  }

  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const accentRgb = accentColor ? hexToRgb(accentColor) : null;

  return (
    <div 
      className={`booking-form-container ${inlineMode ? 'style-inline-variant' : 'style-full-flow'}`}
      style={{
        '--booking-accent-color': accentColor || '#007AFF',
        '--booking-accent-rgb': accentRgb || '0, 122, 255'
      } as React.CSSProperties}
    >
      {/* Título Eliminado 
      <h3 className="booking-form-title">Realizar Reserva</h3> 
      */}
      
      {/* Contenedor para el componente del paso actual */}
      <div className="booking-steps-container">
        {/* Mostrar error de carga de profesionales sólo en el paso de Profesional */}
        {errorProfessionals && currentStep === (professionalStepAvailable ? 3 : 0) && professionalStepAvailable && (
            <p className="booking-form-error subtle">Advertencia al cargar profesionales: {errorProfessionals}</p>
        )}
        
        {/* Renderizar el componente devuelto por getStepComponent */}
        {getStepComponent(currentStep)()}
      </div>

      {/* Barra de progreso MOVIDA al final */}
      {totalSteps > 0 && (
        <div className="progress-bar-container bottom-border-style"> {/* Añadir clase opcional para estilo */} 
          {/* Texto de pasos eliminado */} 
          <div className="progress-bar">
            <div 
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm; 