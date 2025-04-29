import React, { useState, useEffect } from 'react';
import { doc, getDoc, addDoc, collection, Timestamp, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BookingSettings, BookingService, Professional } from '../cardeditor/types'; // Importar Professional, quitar Card si no se usa directamente aquí
import './BookingForm.css';
import { FiX, FiArrowLeft } from 'react-icons/fi';

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
  onClose: () => void;
  inlineMode?: boolean;
  initialStep?: number;
  initialData?: InitialBookingData | null;
  onInlineComplete?: (data: { date: string; time: string; serviceId: string; professionalId?: string }) => void; // Añadir professionalId opcional
}

const BookingForm: React.FC<BookingFormProps> = ({
  cardId,
  userId, // Este es el ID del dueño del negocio/tarjeta
  onClose,
  inlineMode = false,
  initialStep = 1,
  initialData = null,
  onInlineComplete
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

            // Preseleccionar servicio (solo si no viene de initialData y hay servicios)
             if (!selectedServiceId && fetchedSettings.services && fetchedSettings.services.length > 0) {
               if (!inlineMode && !initialData?.serviceId) {
                 setSelectedServiceId(fetchedSettings.services[0].id);
               }
             }

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
  // Considerar el paso activo solo si está habilitado Y no hubo error cargando profesionales Y hay profesionales
  const professionalStepAvailable = professionalStepEnabled && !errorProfessionals && professionals.length > 0;

  let baseSteps = inlineMode ? 3 : 4; // Modal: Servicio, Fecha, Hora, Detalles | Inline: Fecha, Hora, Servicio
  const totalSteps = baseSteps + (professionalStepAvailable ? 1 : 0);

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
     // Modal: Servicio(1) -> Fecha(2) -> Hora(3) -> [Profesional(4)] -> Detalles(5 o 4)
     // Inline: Fecha(1) -> Hora(2) -> [Profesional(3)] -> Servicio(4 o 3)

     if (inlineMode) {
        const professionalStepNumberInline = 3;
        if (professionalStepAvailable && step === professionalStepNumberInline) return renderProfessionalStep;

        let adjustedStepInline = step;
        if (professionalStepAvailable && step >= professionalStepNumberInline) {
             adjustedStepInline = step - (step === professionalStepNumberInline ? 0 : 1); // Ajustar índice para los pasos posteriores al de profesional
        }

        switch (adjustedStepInline) {
          case 1: return renderDateStep;
          case 2: return renderTimeStep;
          case 3: return renderServiceStep; // Este sería el último paso si no hay profesional
          default: return () => null;
        }
     } else { // Modo Modal
        const professionalStepNumberModal = 4;
        if (professionalStepAvailable && step === professionalStepNumberModal) return renderProfessionalStep;

        let adjustedStepModal = step;
         if (professionalStepAvailable && step >= professionalStepNumberModal) {
             adjustedStepModal = step - (step === professionalStepNumberModal ? 0 : 1); // Ajustar índice para los pasos posteriores
         }

        switch (adjustedStepModal) {
          case 1: return renderServiceStep;
          case 2: return renderDateStep;
          case 3: return renderTimeStep;
          case 4: return renderDetailsStep; // Este sería el último paso si no hay profesional
          default: return () => null;
        }
     }
  };

  // Funciones de navegación entre pasos (AJUSTADO)
  const nextStep = () => {
    setFormError(null);

    const currentStepFunction = getStepComponent(currentStep);
    let isValid = true;

    // Mapeo de funciones de render a sus validaciones
    if (currentStepFunction === renderServiceStep) isValid = validateService();
    else if (currentStepFunction === renderDateStep) isValid = validateDate();
    else if (currentStepFunction === renderTimeStep) isValid = validateTime();
    else if (currentStepFunction === renderProfessionalStep) isValid = validateProfessional();
    else if (currentStepFunction === renderDetailsStep) isValid = validateDetails(); // Detalles nunca es 'siguiente', llama a submit

    if (!isValid) {
      return;
    }

    // Lógica de avance o completar
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else if (inlineMode && currentStep === totalSteps && onInlineComplete) {
      // Último paso en modo inline (ya validado arriba)
      onInlineComplete({
        date: selectedDate,
        time: selectedTime,
        serviceId: selectedServiceId,
        professionalId: professionalStepAvailable ? selectedProfessionalId : undefined
      });
    } else if (!inlineMode && currentStep === totalSteps) {
       // Último paso modal (Detalles). El botón "Confirmar" llama a handleBookingSubmit.
       // No se hace nada aquí.
    }
  };

  const prevStep = () => {
     setFormError(null);
     if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
     }
  };


  // Manejador del envío final (AJUSTADO para incluir professionalId y ruta correcta)
  const handleBookingSubmit = async (e?: React.FormEvent) => {
    if (inlineMode) return; // Submit solo en modal
    if(e) e.preventDefault();
    if(!validateDetails()) return; // Validar detalles antes de enviar

    setFormError(null);
    setBookingSuccess(false);
    setIsSubmitting(true);

    try {
       const dateTimeString = `${selectedDate}T${selectedTime}:00`;
       const bookingDateTime = new Date(dateTimeString);
       const serviceName = settings?.services?.find(s => s.id === selectedServiceId)?.name || 'Servicio no especificado';
       const professionalName = professionalStepAvailable ? professionals.find(p => p.id === selectedProfessionalId)?.name : undefined;

       const newBookingData: any = {
         professionalUserId: userId, // ID del dueño del negocio/tarjeta
         cardId: cardId,
         serviceId: selectedServiceId,
         serviceName: serviceName,
         customerName: customerName,
         customerEmail: customerEmail,
         dateTime: Timestamp.fromDate(bookingDateTime),
         status: 'pending',
         createdAt: Timestamp.now(),
       };

       if (professionalStepAvailable && selectedProfessionalId) {
         newBookingData.professionalId = selectedProfessionalId; // ID del profesional que realizará el servicio
         if (professionalName) {
            newBookingData.professionalName = professionalName;
         }
       }

       console.log("Guardando reserva con datos:", newBookingData);

       // Guardar en la subcolección del usuario dueño según reglas: users/{userId}/bookings
       const targetBookingCollectionPath = `users/${userId}/bookings`;
       console.log("Guardando en la colección:", targetBookingCollectionPath);
       const docRef = await addDoc(collection(db, targetBookingCollectionPath), newBookingData);

       console.log("Reserva guardada con ID: ", docRef.id);
       setBookingSuccess(true); // Mostrar mensaje de éxito

    } catch (error: any) {
      console.error("Error al guardar la reserva en Firestore: ", error);
      setFormError(`Ocurrió un error al guardar tu reserva: ${error.message}. Código: ${error.code}`);
      setBookingSuccess(false);
    } finally {
       setIsSubmitting(false);
    }
  };

  // --- Renderizado de Pasos Individuales (CON TÍTULOS Y BOTONES AJUSTADOS) ---

   const renderServiceStep = () => {
    let stepNumber = 1; // Default Modal
    if (inlineMode) {
        stepNumber = professionalStepAvailable ? 4 : 3;
    }

    return (
    <>
      <h4 className="step-title">{stepNumber}. Selecciona Servicio</h4>
       <div className="booking-form-group">
         <label htmlFor="serviceSelect">Servicio:</label>
         <select
           id="serviceSelect"
           value={selectedServiceId}
           onChange={(e) => { setSelectedServiceId(e.target.value); setFormError(null); }}
           required
           className="booking-form-select"
           disabled={!settings?.services || settings.services.length === 0}
         >
           <option value="" disabled>{!settings?.services || settings.services.length === 0 ? 'No hay servicios' : 'Selecciona...'}</option>
           {settings?.services?.map(service => (
             <option key={service.id} value={service.id}>
               {service.name} ({service.duration} min{service.price ? ` - ${service.price}€` : ''})
             </option>
           ))}
         </select>
       </div>
       {formError && <p className="booking-form-error">{formError}</p>}
       <div className={`step-actions ${currentStep > 1 ? 'space-between' : 'justify-end'}`}>
         {currentStep > 1 && (
            <button type="button" onClick={prevStep} className="prev-button">
              <FiArrowLeft /> Atrás
            </button>
          )}
         <button
           type="button"
           onClick={nextStep}
           className="next-button"
           disabled={!selectedServiceId || !settings?.services || settings.services.length === 0}
         >
           {(inlineMode && currentStep === totalSteps) ? 'Verificar y Continuar' : 'Siguiente'}
         </button>
       </div>
    </>
   )};

  const renderDateStep = () => {
     let stepNumber = 2; // Default Modal
     if (inlineMode) {
         stepNumber = 1;
     }
     return (
     <>
      <h4 className="step-title">{stepNumber}. Elige Fecha</h4>
       <div className="booking-form-group">
         <label htmlFor="dateSelect">Fecha:</label>
         <input
           type="date"
           id="dateSelect"
           value={selectedDate}
           onChange={(e) => { setSelectedDate(e.target.value); setFormError(null); }}
           required
           className="booking-form-input"
           min={new Date().toISOString().split('T')[0]}
         />
       </div>
       {formError && <p className="booking-form-error">{formError}</p>}
        <div className={`step-actions ${currentStep > 1 ? 'space-between' : 'justify-end'}`}>
          {currentStep > 1 && (
             <button type="button" onClick={prevStep} className="prev-button">
               <FiArrowLeft /> Atrás
             </button>
           )}
         <button type="button" onClick={nextStep} className="next-button" disabled={!selectedDate}>
           Siguiente
         </button>
       </div>
     </>
   )};

  const renderTimeStep = () => {
     let stepNumber = 3; // Default Modal
     if (inlineMode) {
         stepNumber = 2;
     }
     return (
     <>
      <h4 className="step-title">{stepNumber}. Elige Hora</h4>
       <div className="booking-form-group">
         <label htmlFor="timeSelect">Hora:</label>
         <input
           type="time"
           id="timeSelect"
           value={selectedTime}
           onChange={(e) => { setSelectedTime(e.target.value); setFormError(null); }}
           required
           className="booking-form-input"
         />
         {/* <p className="availability-hint">(Integrar disponibilidad real aquí)</p> */}
       </div>
       {formError && <p className="booking-form-error">{formError}</p>}
        <div className={`step-actions ${currentStep > 1 ? 'space-between' : 'justify-end'}`}>
          {currentStep > 1 && (
             <button type="button" onClick={prevStep} className="prev-button">
               <FiArrowLeft /> Atrás
             </button>
           )}
         <button type="button" onClick={nextStep} className="next-button" disabled={!selectedTime}>
           Siguiente
         </button>
       </div>
     </>
   )};

   const renderProfessionalStep = () => {
       let stepNumber = 4; // Default Modal
       if (inlineMode) {
           stepNumber = 3;
       }
       return (
       <>
         <h4 className="step-title">{stepNumber}. Selecciona Profesional</h4>
         <div className="booking-form-group">
           <label htmlFor="professionalSelect">Profesional:</label>
           <select
             id="professionalSelect"
             value={selectedProfessionalId}
             onChange={(e) => { setSelectedProfessionalId(e.target.value); setFormError(null); }}
             required
             className="booking-form-select"
             disabled={loadingProfessionals || professionals.length === 0}
           >
             <option value="" disabled>
               {loadingProfessionals ? 'Cargando...' : (professionals.length === 0 ? 'No hay profesionales' : 'Selecciona...')}
             </option>
             {professionals.map(prof => (
               <option key={prof.id} value={prof.id}>
                 {prof.name || `Profesional ${prof.id.substring(0, 5)}`}
               </option>
             ))}
           </select>
         </div>
         {/* Mostrar error específico de profesionales aquí */}
         {errorProfessionals && <p className="booking-form-error">{errorProfessionals}</p>}
         {/* Mostrar error general del paso (ej. no seleccionado) */}
         {formError && <p className="booking-form-error">{formError}</p>}
         <div className={`step-actions space-between`}>
           <button type="button" onClick={prevStep} className="prev-button">
             <FiArrowLeft /> Atrás
           </button>
           <button
             type="button"
             onClick={nextStep}
             className="next-button"
              // Deshabilitar si no se seleccionó, si está cargando, o si hubo error al cargar
             disabled={!selectedProfessionalId || loadingProfessionals || !!errorProfessionals}
           >
              {(inlineMode && currentStep === totalSteps) ? 'Verificar y Continuar' : 'Siguiente'}
           </button>
         </div>
       </>
   )};

   const renderDetailsStep = () => { // Solo para modo modal
       const stepNumber = totalSteps;
       return (
       <>
         <h4 className="step-title">{stepNumber}. Tus Datos</h4>
         <div className="booking-form-group">
           <label htmlFor="customerName">Nombre:</label>
           <input type="text" id="customerName" value={customerName} onChange={(e) => {setCustomerName(e.target.value); setFormError(null);}} required className="booking-form-input" />
         </div>
         <div className="booking-form-group">
           <label htmlFor="customerEmail">Email:</label>
           <input type="email" id="customerEmail" value={customerEmail} onChange={(e) => {setCustomerEmail(e.target.value); setFormError(null);}} required className="booking-form-input" />
         </div>
         {formError && <p className="booking-form-error">{formError}</p>}
         <div className="step-actions space-between">
             <button type="button" onClick={prevStep} className="prev-button">
               <FiArrowLeft /> Atrás
             </button>
           <button
             type="button"
             onClick={handleBookingSubmit} // Llama directamente al submit
             className="submit-booking-button"
             disabled={isSubmitting || !customerName || !customerEmail || !validateEmail(customerEmail)}
           >
             {isSubmitting ? 'Confirmando...' : 'Confirmar Reserva'}
           </button>
         </div>
       </>
   )};

  // --- Renderizado Principal (AJUSTAR MENSAJES) ---

   const overallLoading = loadingSettings; // La carga inicial crítica es la de settings
   const overallError = errorSettings; // Mostrar error principal de settings si existe

   if (overallLoading) {
    const LoadingComponent = <div className={`booking-form-${inlineMode ? 'inline' : 'modal'} loading`}>Cargando configuración...</div>;
    return inlineMode ? LoadingComponent : <div className="booking-form-overlay">{LoadingComponent}</div>;
   }

   // Mostrar error de settings si ocurrió
   if (overallError) {
     const ErrorComponent = (
       <div className={`booking-form-${inlineMode ? 'inline' : 'modal'} error`}>
         <h4>Error al Cargar</h4>
         <p>{overallError}</p>
         {!inlineMode && <button onClick={onClose} className="close-button simple">Cerrar</button>}
       </div>
     );
     return inlineMode ? ErrorComponent : <div className="booking-form-overlay">{ErrorComponent}</div>;
   }

   // Caso: Settings cargados pero reservas deshabilitadas o sin servicios
   if (!settings || settings.enabled === false || !settings.services || settings.services.length === 0) {
       let message = "Las reservas no están habilitadas actualmente.";
       if (settings && settings.enabled !== false && (!settings.services || settings.services.length === 0)) {
           message = "No hay servicios disponibles para reservar en este momento.";
       }
      const NoticeComponent = (
        <div className={`booking-form-${inlineMode ? 'inline' : 'modal'} notice`}>
          <p>{message}</p>
          {!inlineMode && <button onClick={onClose} className="close-button simple">Cerrar</button>}
        </div>
      );
      return inlineMode ? NoticeComponent : <div className="booking-form-overlay">{NoticeComponent}</div>;
   }

   // Mensaje de éxito (solo modal)
  if (bookingSuccess && !inlineMode) {
      const SuccessComponent = (
         <div className="booking-form-modal success">
           <h3>¡Reserva Solicitada!</h3>
           <p>Tu solicitud ha sido enviada. Recibirás confirmación por email.</p>
           <button onClick={onClose} className="close-button simple">Cerrar</button>
         </div>
       );
      return <div className="booking-form-overlay">{SuccessComponent}</div>;
  }

  // Si settings está cargado y habilitado, y no hay error de settings, renderizar el formulario
  const FormContent = (
    <div className={inlineMode ? "booking-form-inline" : "booking-form-modal"}>
      {!inlineMode && (
        <button onClick={onClose} className="close-button icon-button" title="Cerrar">
          <FiX />
        </button>
      )}
      {!inlineMode && <h3 className="booking-form-title">Realizar Reserva</h3>}
      <div className="booking-steps-container">
        {/* Mostrar error de profesionales si ocurrió y el paso no está activo */}
        {errorProfessionals && !professionalStepAvailable && (
            <p className="booking-form-error subtle">Advertencia: {errorProfessionals}</p>
        )}
        {/* Renderizar el componente del paso actual */}
        {getStepComponent(currentStep)()}
      </div>
      {!inlineMode && totalSteps > 1 && (
          <div className="booking-step-indicator">
              Paso {currentStep} de {totalSteps}
          </div>
      )}
    </div>
  );

  return inlineMode ? FormContent : <div className="booking-form-overlay">{FormContent}</div>;
};

export default BookingForm; 