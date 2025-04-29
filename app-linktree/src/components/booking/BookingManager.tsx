import React, { useState, useEffect } from 'react';
import './BookingManager.css';
// Importar tipos necesarios
import { BookingSettings, BookingService, BookingAvailability, BookingAvailabilitySlot } from '../cardeditor/types';
import { v4 as uuidv4 } from 'uuid'; // Para generar IDs únicos para los servicios
import { FiPlus, FiTrash2, FiEdit, FiClock } from 'react-icons/fi'; // Iconos

interface BookingManagerProps {
  cardId: string; // ID de la tarjeta a la que pertenece esta configuración
  initialSettings?: BookingSettings; // Usar el tipo específico
  onSettingsChange: (newSettings: BookingSettings) => void; // Función para notificar cambios
}

// Estado inicial por defecto para un nuevo servicio
const defaultNewService: Omit<BookingService, 'id'> = {
  name: '',
  duration: 30, // Duración por defecto en minutos
  price: undefined,
  description: ''
};

// Días de la semana para iterar
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayOfWeek = typeof daysOfWeek[number];

const BookingManager: React.FC<BookingManagerProps> = ({
  cardId,
  initialSettings,
  onSettingsChange
}) => {
  // Asegurar que el estado settings use el tipo correcto y tenga valores por defecto
  const [settings, setSettings] = useState<BookingSettings>(initialSettings || {
    enabled: false,
    allowProfessionalSelection: false,
    services: [],
    availability: {},
    acceptOnlinePayments: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para el formulario de nuevo servicio
  const [serviceFormData, setServiceFormData] = useState(defaultNewService);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Estado para el formulario de añadir slot
  const [showSlotFormForDay, setShowSlotFormForDay] = useState<DayOfWeek | null>(null);
  const [newSlot, setNewSlot] = useState<{ startTime: string; endTime: string }>({ startTime: '09:00', endTime: '17:00' });

  useEffect(() => {
    // Cargar configuración inicial cuando cambie y asegurar valores por defecto
    setSettings(initialSettings || {
      enabled: false,
      allowProfessionalSelection: false,
      services: [],
      availability: {},
      acceptOnlinePayments: false
    });
  }, [initialSettings]);

  // Handler genérico para inputs del componente principal (enabled, serviceTitle, y allowProfessionalSelection)
  const handleGeneralInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newSettings = {
      ...settings,
      [name]: type === 'checkbox' ? checked : value,
    };
    setSettings(newSettings);
    onSettingsChange(newSettings); // Notificar al padre sobre el cambio
  };

  // Handler para inputs del formulario de servicio (ahora usa serviceFormData)
  const handleServiceFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setServiceFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || undefined : value // Usar undefined para precio si está vacío
    }));
  };

  // Abrir formulario para AÑADIR
  const handleOpenAddServiceForm = () => {
    setEditingServiceId(null); // Asegurar que no estamos editando
    setServiceFormData(defaultNewService); // Limpiar datos del form
    setShowServiceForm(true);
    setError(null);
  };

  // Abrir formulario para EDITAR
  const handleOpenEditServiceForm = (service: BookingService) => {
    setEditingServiceId(service.id);
    setServiceFormData({ // Cargar datos del servicio a editar
      name: service.name,
      duration: service.duration,
      price: service.price,
      description: service.description || ''
    });
    setShowServiceForm(true);
    setError(null);
  };

  // Cancelar/Cerrar formulario de servicio
  const handleCancelServiceForm = () => {
    setShowServiceForm(false);
    setEditingServiceId(null);
    setError(null);
    // No necesitamos limpiar serviceFormData aquí, se hará al abrir de nuevo
  };

  // Guardar Servicio (Añadir o Editar)
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceFormData.name || serviceFormData.duration <= 0) {
      setError('El nombre y una duración válida son requeridos.');
      return;
    }
    setError(null);

    let updatedServices: BookingService[];

    if (editingServiceId) {
      // Editar servicio existente
      updatedServices = settings.services.map(s => 
        s.id === editingServiceId ? { ...s, ...serviceFormData } : s
      );
    } else {
      // Añadir nuevo servicio
      const serviceToAdd: BookingService = {
        ...serviceFormData,
        id: uuidv4()
      };
      updatedServices = [...settings.services, serviceToAdd];
    }

    const newSettings = { ...settings, services: updatedServices };
    setSettings(newSettings);
    onSettingsChange(newSettings);
    
    // Cerrar y limpiar
    handleCancelServiceForm(); 
  };

  // Eliminar un servicio de la lista
  const handleDeleteService = (serviceId: string) => {
    const updatedServices = settings.services.filter(s => s.id !== serviceId);
    const newSettings = { ...settings, services: updatedServices };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };
  
  // Handler para inputs del formulario de nuevo slot
  const handleNewSlotInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSlot(prev => ({ ...prev, [name]: value }));
  };

  // Añadir un slot a un día específico
  const handleAddSlot = (day: DayOfWeek) => {
    if (!newSlot.startTime || !newSlot.endTime) {
      setError("Debes especificar hora de inicio y fin para el slot.");
      return;
    }
    // Validación simple de horas (se puede mejorar)
    if (newSlot.startTime >= newSlot.endTime) {
       setError("La hora de inicio debe ser anterior a la hora de fin.");
       return;
    }
    setError(null);

    const updatedAvailability = { ...settings.availability };
    const daySlots = updatedAvailability[day] || [];
    
    // Añadir el nuevo slot y ordenar por hora de inicio
    const newDaySlots = [...daySlots, { ...newSlot }].sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    updatedAvailability[day] = newDaySlots;

    const newSettings = { ...settings, availability: updatedAvailability };
    setSettings(newSettings);
    onSettingsChange(newSettings);
    setShowSlotFormForDay(null); // Ocultar formulario
    // Resetear horas? O mantenerlas para añadir rápido?
    // setNewSlot({ startTime: '09:00', endTime: '17:00' }); 
  };

  // Eliminar un slot de un día específico
  const handleDeleteSlot = (day: DayOfWeek, slotIndex: number) => {
    const updatedAvailability = { ...settings.availability };
    const daySlots = updatedAvailability[day] || [];
    
    if (slotIndex >= 0 && slotIndex < daySlots.length) {
       const newDaySlots = [...daySlots];
       newDaySlots.splice(slotIndex, 1);
       updatedAvailability[day] = newDaySlots;

       const newSettings = { ...settings, availability: updatedAvailability };
       setSettings(newSettings);
       onSettingsChange(newSettings);
    }
  };

  // Función para renderizar el formulario de servicio (ahora usa serviceFormData)
  const renderServiceForm = () => (
    <form onSubmit={handleSaveService} className="service-form">
      <h5>{editingServiceId ? 'Editar Servicio' : 'Añadir Nuevo Servicio'}</h5>
      <div className="booking-form-group">
        <label htmlFor="serviceName" className="booking-form-label small">Nombre*</label>
        <input
          type="text"
          id="serviceName"
          name="name"
          value={serviceFormData.name}
          onChange={handleServiceFormInputChange}
          className="booking-form-input"
          required
        />
      </div>
      <div className="booking-form-group">
        <label htmlFor="serviceDuration" className="booking-form-label small">Duración (minutos)*</label>
        <input
          type="number"
          id="serviceDuration"
          name="duration"
          value={serviceFormData.duration}
          onChange={handleServiceFormInputChange}
          className="booking-form-input"
          min="1"
          required
        />
      </div>
      <div className="booking-form-group">
        <label htmlFor="servicePrice" className="booking-form-label small">Precio (€) (Opcional)</label>
        <input
          type="number"
          id="servicePrice"
          name="price"
          value={serviceFormData.price ?? ''}
          onChange={handleServiceFormInputChange}
          className="booking-form-input"
          min="0"
          step="0.01"
          placeholder="0.00"
        />
      </div>
      <div className="booking-form-group">
        <label htmlFor="serviceDescription" className="booking-form-label small">Descripción (Opcional)</label>
        <textarea
          id="serviceDescription"
          name="description"
          value={serviceFormData.description}
          onChange={handleServiceFormInputChange}
          className="booking-form-textarea"
          rows={3}
        />
      </div>
      <div className="service-form-actions">
        <button type="submit" className="save-button">{editingServiceId ? 'Guardar Cambios' : 'Añadir Servicio'}</button>
        <button type="button" className="cancel-button" onClick={handleCancelServiceForm}>Cancelar</button>
      </div>
    </form>
  );

  // Función auxiliar para traducir nombres de días
  const translateDay = (day: DayOfWeek): string => {
     const map: Record<DayOfWeek, string> = {
       monday: 'Lunes',
       tuesday: 'Martes',
       wednesday: 'Miércoles',
       thursday: 'Jueves',
       friday: 'Viernes',
       saturday: 'Sábado',
       sunday: 'Domingo'
     };
     return map[day];
   }

  // *** Restaurar la definición de renderSlotForm ***
  const renderSlotForm = (day: DayOfWeek) => (
    <div className="slot-form">
      <div className="booking-form-group small-group">
        <label htmlFor={`startTime-${day}`}>Inicio:</label>
        <input 
          type="time" 
          id={`startTime-${day}`}
          name="startTime"
          value={newSlot.startTime}
          onChange={handleNewSlotInputChange}
          className="booking-form-input time-input"
        />
      </div>
      <div className="booking-form-group small-group">
        <label htmlFor={`endTime-${day}`}>Fin:</label>
        <input 
          type="time" 
          id={`endTime-${day}`}
          name="endTime"
          value={newSlot.endTime}
          onChange={handleNewSlotInputChange}
          className="booking-form-input time-input"
        />
      </div>
      <div className="slot-form-actions">
        <button type="button" className="save-slot-button" onClick={() => handleAddSlot(day)}>Añadir</button>
        <button type="button" className="cancel-slot-button" onClick={() => setShowSlotFormForDay(null)}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <div className="booking-manager-container">
      <h3 className="booking-manager-title">Gestión de Reservas</h3>
      <p className="booking-manager-description">
        Configura cómo los visitantes pueden reservar citas o servicios directamente desde tu tarjeta.
      </p>

      {loading && <p>Cargando configuración...</p>}
      {error && <div className="booking-alert booking-alert-error">{error}</div>}

      <div className="booking-form">
        {/* Activar/Desactivar Reservas */}
        <div className="booking-form-group">
          <label htmlFor="bookingEnabled" className="booking-form-label">
            <input
              type="checkbox"
              id="bookingEnabled"
              name="enabled"
              checked={settings.enabled || false}
              onChange={handleGeneralInputChange} // Usar handler general
              className="booking-form-checkbox"
            />
            Activar sistema de reservas para esta tarjeta
          </label>
        </div>

        {/* --- AÑADIR CHECKBOX PARA SELECCIÓN DE PROFESIONAL --- */}
        <div className="booking-form-group">
          <label htmlFor="allowProfessionalSelection" className="booking-form-label">
            <input
              type="checkbox"
              id="allowProfessionalSelection"
              name="allowProfessionalSelection"
              checked={settings.allowProfessionalSelection || false}
              onChange={handleGeneralInputChange}
              className="booking-form-checkbox"
            />
            Permitir al cliente seleccionar profesional al reservar
          </label>
          <small className="form-text" style={{ color: '#aaaaaa', marginLeft: '1.7rem' }}>Si se activa, se mostrará un paso para elegir profesional.</small>
        </div>
        {/* --- FIN CHECKBOX --- */}

        {/* Contenido que se muestra si las reservas están activadas */}
        {settings.enabled && (
          <div className="booking-config-active">
            {/* Sección de Servicios */}
            <div className="services-section">
              <h4 className="section-subtitle">Servicios Ofrecidos</h4>
              
              {/* Lista de servicios existentes */} 
              <div className="services-list">
                {settings.services.length === 0 ? (
                  <p className="no-items-message">Aún no has añadido ningún servicio.</p>
                ) : (
                  settings.services.map(service => (
                    <div key={service.id} className="service-item">
                      <div className="service-info">
                        <span className="service-name">{service.name}</span>
                        <span className="service-details">
                          {service.duration} min {service.price ? `- ${service.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : ''}
                        </span>
                      </div>
                      <div className="service-actions">
                        {/* Botón Editar (Ahora funcional) */}
                        <button 
                          className="action-button edit-button" 
                          onClick={() => handleOpenEditServiceForm(service)}
                          title="Editar servicio"
                        >
                          <FiEdit />
                        </button>
                        {/* Botón Eliminar */}
                        <button 
                          className="action-button delete-button" 
                          onClick={() => handleDeleteService(service.id)}
                          title="Eliminar servicio"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Renderizar botón o formulario */} 
              {showServiceForm 
                ? renderServiceForm() 
                : <button type="button" className="add-item-button" onClick={handleOpenAddServiceForm}><FiPlus /> Añadir Servicio</button>
              }
            </div>
            
            {/* Sección de Disponibilidad (Placeholder) */}
            <div className="availability-section">
               <h4 className="section-subtitle">Disponibilidad Semanal</h4>
               {error && <div className="booking-alert booking-alert-error small-alert">{error}</div>} 
               <div className="availability-grid">
                 {daysOfWeek.map(day => (
                   <div key={day} className="day-column">
                     <h5 className="day-title">{translateDay(day)}</h5>
                     <div className="slots-list">
                       {(settings.availability[day] || []).length === 0 ? (
                          <p className="no-slots-message">No disponible</p>
                       ) : (
                         (settings.availability[day] || []).map((slot, index) => (
                           <div key={index} className="slot-item">
                             <span>{slot.startTime} - {slot.endTime}</span>
                             <button 
                               className="delete-slot-button" 
                               onClick={() => handleDeleteSlot(day, index)}
                               title="Eliminar slot"
                              >
                               <FiTrash2 />
                             </button>
                           </div>
                         ))
                       )}
                     </div>
                     {/* Mostrar formulario o botón de añadir */} 
                     {showSlotFormForDay === day ? (
                       renderSlotForm(day)
                     ) : (
                       <button 
                         type="button" 
                         className="add-slot-button" 
                         onClick={() => setShowSlotFormForDay(day)}
                        >
                         <FiClock /> Añadir horario
                       </button>
                     )}
                   </div>
                 ))}
               </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default BookingManager; 