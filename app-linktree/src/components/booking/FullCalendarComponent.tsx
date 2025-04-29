import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Ajustar ruta si es necesario
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid'; // Plugin para vista de mes
import timeGridPlugin from '@fullcalendar/timegrid'; // Plugin para vistas de semana/día
import interactionPlugin from '@fullcalendar/interaction'; // Plugin para clics, selección, etc.
import esLocale from '@fullcalendar/core/locales/es'; // Importar localización en español
import './FullCalendarComponent.css'; // Crearemos este archivo para estilos
import './FullCalendarEventContent.css'; // Importar el nuevo CSS
import { Professional } from '../cardeditor/types'; // Ajustar si es necesario
import { format } from 'date-fns'; // Importar para formatear hora en popover
import { es } from 'date-fns/locale'; // Importar locale español para date-fns
// Importar un icono para el botón de cerrar (opcional, ejemplo con react-icons)
// import { VscChromeClose } from "react-icons/vsc";
import ProfessionalFilterModal from './ProfessionalFilterModal'; // Asegúrate que esta ruta es correcta
import { FaFilter } from 'react-icons/fa'; // Importar icono de filtro

// Interfaz para Reserva (asegúrate que coincida con tus datos de Firestore)
interface Booking {
  id: string;
  customerName: string;
  dateTime: Timestamp;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  serviceName?: string;
  professionalId?: string;
  professionalName?: string; // Añadir si se guarda en la reserva
  // Añadir opcionalmente para avatares
  professionalImageUrl?: string;
  customerImageUrl?: string;
  // ... otros campos relevantes
}

// Interfaz para Evento de FullCalendar
// https://fullcalendar.io/docs/event-object
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date; // FullCalendar necesita start y end
  allDay?: boolean;
  // Campos extendidos para pasar datos adicionales
  extendedProps: {
    customerName?: string;
    serviceName?: string;
    professionalId?: string;
    professionalName?: string;
    professionalImageUrl?: string; // Necesario para avatar
    customerImageUrl?: string; // Si tuvieras avatar del cliente
    status?: string;
  };
  // Propiedades para estilizar directamente
  color?: string; // Color de fondo del evento
  borderColor?: string; // Color del borde
  textColor?: string; // Color del texto
  classNames?: string[]; // Clases CSS adicionales
}

interface FullCalendarComponentProps {
  userId: string; // ID del dueño del negocio
}

// Interfaz para la información del popover
interface PopoverInfo {
  show: boolean;
  content: React.ReactNode;
  x: number;
  y: number;
  // Añadir referencia al elemento del evento para recalcular si es necesario
  eventElement: HTMLElement | null; 
}

// Mapa de colores por estado (ejemplo, ajustar a tus preferencias)
const statusColors: Record<string, { background: string; border: string; text: string; bar: string }> = {
  pending: { background: '#60a5fa20', border: '#3b82f6', text: '#e0e0e0', bar: '#60a5fa' }, // Fondo más tenue
  confirmed: { background: '#4ade8020', border: '#22c55e', text: '#e0e0e0', bar: '#4ade80' },
  completed: { background: '#a3a3a320', border: '#737373', text: '#e0e0e0', bar: '#a3a3a3' },
  cancelled: { background: '#f8717120', border: '#ef4444', text: '#e0e0e0', bar: '#f87171' },
};

// --- Función de renderizado AJUSTADA ---
function renderStyledEventContent(eventInfo: any) {
    const props = eventInfo.event.extendedProps;
    const status = props.status || 'pending';
    const colors = statusColors[status] || statusColors.pending;

    const displayTitle = props.serviceName || eventInfo.event.title;
    const displaySubtitle = props.customerName || ''; 

    // Simular participantes (profesional + cliente si existe)
    // **IMPORTANTE**: Idealmente, deberías tener una lista real de participantes
    // en `props.participants` o similar para manejar el "+X" correctamente.
    const participants: { name: string, imageUrl?: string }[] = [];
    if (props.professionalName) {
        participants.push({ name: props.professionalName, imageUrl: props.professionalImageUrl });
    }
    if (props.customerName && props.customerImageUrl) { // Solo si hay imagen de cliente
        participants.push({ name: props.customerName, imageUrl: props.customerImageUrl });
    }
    // Añadir placeholders si no hay suficientes imágenes pero quieres mostrar avatares
    // while (participants.length < 2) { 
    //    participants.push({ name: `P${participants.length + 1}` }); 
    // }

    // Lógica para mostrar avatares y el "+X"
    const maxAvatarsToShow = 2; 
    const avatarsToShow = participants.slice(0, maxAvatarsToShow);
    const remainingCount = participants.length - maxAvatarsToShow;

    return (
        // Aplicar clase principal al div que devuelve la función
        <div className="custom-styled-event-content"> 
            <div className="event-status-bar" style={{ backgroundColor: colors.bar }}></div>
            <div className="event-details-container">
                <div className="event-text-info">
                    <span className="event-title" title={displayTitle}>{displayTitle}</span>
                    {displaySubtitle && <span className="event-subtitle" title={displaySubtitle}>{displaySubtitle}</span>}
                </div>
                {/* Cambiado a clase event-participants */}
                <div className="event-participants"> 
                    {avatarsToShow.map((avatar, index) => (
                        <div key={index} className="event-avatar" title={avatar.name}>
                            {avatar.imageUrl ? (
                                <img src={avatar.imageUrl} alt="" /> 
                            ) : (
                                <span>{avatar.name.charAt(0).toUpperCase()}</span> 
                            )}
                        </div>
                    ))}
                    {/* Mostrar indicador "+X" */}
                    {remainingCount > 0 && (
                         <div className="event-more-indicator">
                            +{remainingCount}
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
}
// --------------------------------

const FullCalendarComponent: React.FC<FullCalendarComponentProps> = ({ userId }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]); // Asumiendo que tienes profesionales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado para el Popover
  const [popover, setPopover] = useState<PopoverInfo>({ show: false, content: null, x: 0, y: 0, eventElement: null });
  const popoverRef = useRef<HTMLDivElement>(null); // Referencia al elemento del popover
  // --- Estado para el modal de detalles --- 
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // Para controlar la animación/transición
  const modalRef = useRef<HTMLDivElement>(null); // <-- Añadir ref para el modal

  // --- NUEVO ESTADO PARA FILTRO ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedProfessionalFilterId, setSelectedProfessionalFilterId] = useState<string | null>(null);
  // -------------------------------

  // Cargar Profesionales (similar a la lógica anterior)
  useEffect(() => {
    if (!userId) return;
    const professionalsPath = `users/${userId}/professionals`;
    const qProf = query(collection(db, professionalsPath));
    const unsubscribeProf = onSnapshot(qProf,
      (snapshot) => {
        const fetchedProfessionals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Professional[];
        setProfessionals(fetchedProfessionals);
        // No quitar loading aquí aún
      },
      (err) => {
        console.error("Error fetching professionals: ", err);
        setError((prev) => prev ? prev + " / Error profesionales" : "Error al cargar profesionales.");
      }
    );
    return () => unsubscribeProf();
  }, [userId]);

  // Mapear profesionales por ID
  const professionalsMap = useMemo(() => {
    const map = new Map<string, Professional>();
    professionals.forEach(prof => map.set(prof.id, prof));
    return map;
  }, [professionals]);

  // Cargar Reservas
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("No se pudo identificar al usuario para cargar reservas.");
      return;
    }
    setLoading(true);
    setError(null);
    const bookingsPath = `users/${userId}/bookings`;
    const q = query(collection(db, bookingsPath), orderBy('dateTime', 'asc'));

    const unsubscribeBookings = onSnapshot(q,
      (snapshot) => {
        const fetchedBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
        setBookings(fetchedBookings);
        setLoading(false); // Quitar loading después de cargar reservas
      },
      (err) => {
        console.error("Error fetching bookings: ", err);
        setError((prev) => prev ? prev + " / Error reservas" : "Error al cargar las reservas.");
        setLoading(false);
      }
    );

    return () => unsubscribeBookings();
  }, [userId]);

  // --- Ajustar calendarEvents para asegurar datos y colores de fondo/borde ---
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const filteredBookings = selectedProfessionalFilterId
      ? bookings.filter(booking => booking.professionalId === selectedProfessionalFilterId)
      : bookings;

    return filteredBookings.map(booking => {
      const startDate = booking.dateTime?.toDate ? booking.dateTime.toDate() : new Date();
      const durationMinutes = 60; // <-- OBTENER DURACIÓN REAL
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      const professional = booking.professionalId ? professionalsMap.get(booking.professionalId) : undefined;
      const status = booking.status || 'pending';
      const colors = statusColors[status] || statusColors.pending;

      // Aplicar colores de FONDO y BORDE aquí (no el de la barra)
      // El CSS se encargará del color del texto
      return {
        id: booking.id,
        title: `${booking.customerName}`,
        start: startDate,
        end: endDate,
        extendedProps: {
          customerName: booking.customerName, 
          serviceName: booking.serviceName, 
          professionalId: booking.professionalId,
          professionalName: booking.professionalName || professional?.name,
          professionalImageUrl: professional?.imageUrl,
          customerImageUrl: booking.customerImageUrl,
          status: status,
        },
        color: colors.background, 
        borderColor: colors.border, 
        classNames: [`event-status-${status}`], 
      };
    });
  }, [bookings, professionalsMap, selectedProfessionalFilterId]);
  // -------------------------------------------------------------------

  // --- Handlers para el Popover --- 
  const handleMouseEnter = (info: any) => {
    const event = info.event;
    const props = event.extendedProps;
    const element = info.el as HTMLElement; // Elemento HTML del evento

    // Formatear hora
    const startTime = format(event.start, 'HH:mm', { locale: es });
    const endTime = format(event.end, 'HH:mm', { locale: es });

    setPopover({
      show: true,
      x: 0, // Se calculará después
      y: 0, // Se calculará después
      eventElement: element, // Guardar el elemento para recalcular posición
      content: (
        <div className="event-popover-content">
          <strong>{props.serviceName || event.title}</strong>
          <div>{startTime} - {endTime}</div>
          {props.customerName && !props.serviceName && <div><span className="status-label">Cliente:</span> <span>{props.customerName}</span></div>}
          {props.professionalName && (
            <div className="popover-prof-info">
              {props.professionalImageUrl && <img src={props.professionalImageUrl} alt={props.professionalName} className="popover-prof-img" />}
              <span>{props.professionalName}</span>
            </div>
          )}
          {props.status && 
            <div>
                <span className="status-label">Estado:</span> 
                <span className={`status-indicator status-${props.status}`}>{props.status}</span>
            </div>
          }
        </div>
      )
    });
  };

  const handleMouseLeave = () => {
    setPopover((prev) => ({ ...prev, show: false, eventElement: null })); // Ocultar popover
  };

  // Efecto para calcular la posición del popover DESPUÉS de que se renderice
  useEffect(() => {
    if (popover.show && popover.eventElement && popoverRef.current) {
      const eventRect = popover.eventElement.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const containerRect = popoverRef.current.offsetParent?.getBoundingClientRect() || { top: 0, left: 0 };

      // Calcular posición para centrar encima del evento
      let top = eventRect.top - popoverRect.height - 8; // 8px de espacio + flecha
      let left = eventRect.left + (eventRect.width / 2) - (popoverRect.width / 2);

      // Ajustar si se sale por arriba
      if (top < containerRect.top) {
          top = eventRect.bottom + 8; // Posicionar debajo si no cabe arriba
          // Aquí habría que ajustar la flecha del popover para apuntar hacia abajo (requiere más CSS)
      }

      // Ajustar si se sale por los lados (simple ajuste)
      if (left < containerRect.left) {
          left = containerRect.left + 5; // Margen izquierdo
      }
      if (left + popoverRect.width > window.innerWidth) {
          left = window.innerWidth - popoverRect.width - 5; // Margen derecho
      }

      // Ajustar coordenadas relativas al contenedor si es necesario
      // top -= containerRect.top;
      // left -= containerRect.left;

      // Actualizar el estado SOLO con las posiciones calculadas
      setPopover(prev => ({ ...prev, x: left + window.scrollX, y: top + window.scrollY }));
    }
  }, [popover.show, popover.content]); // Depende de show y content (para cuando el tamaño cambie)

  // --- Handler para el clic en el evento --- 
  const handleEventClick = (info: any) => {
    // Ocultar popover si estuviera visible al hacer clic
    setPopover((prev) => ({ ...prev, show: false, eventElement: null })); 
    
    const bookingId = info.event.id;
    const bookingDetail = bookings.find(b => b.id === bookingId);

    if (bookingDetail) {
      // Siempre actualizar los detalles de la reserva seleccionada
      setSelectedBookingDetails(bookingDetail);

      // Solo iniciar la animación/estado de apertura si el modal ESTABA CERRADO
      if (!isModalOpen) {
        // Pequeño delay para permitir la animación de entrada
        setTimeout(() => setIsModalOpen(true), 50); 
      }
      // Si ya estaba abierto, la actualización de selectedBookingDetails
      // simplemente re-renderizará el contenido dentro del modal existente.
    }
  };

  // --- Función para cerrar el modal (memoizada con useCallback) --- 
  const handleCloseModal = useCallback(() => {
    // console.log('[handleCloseModal] Called.'); // Mantener logs si es necesario
    setIsModalOpen(false);
    setTimeout(() => {
      // console.log('[handleCloseModal setTimeout] Setting selectedBookingDetails to null');
        setSelectedBookingDetails(null);
    }, 300);
  }, []); // Sin dependencias, función estable

  // --- Efecto para cerrar el modal al hacer clic fuera --- 
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetElement = event.target as Node;
      // console.log('[handleClickOutside] Listener fired. Target:', targetElement);
      
      // Comprobar si el modal existe, si el clic fue fuera Y si NO fue en un evento del calendario
      if (modalRef.current && 
          !modalRef.current.contains(targetElement) &&
          !(targetElement instanceof Element && targetElement.closest('.fc-event'))
         ) 
      {
        // console.log('[handleClickOutside] Click was outside modal and not on an event. Closing.');
        handleCloseModal();
      } else {
        // console.log('[handleClickOutside] Click was inside modal, on an event, or modalRef is null.');
      }
    };

    if (isModalOpen) {
      // console.log('[Click Outside useEffect] Adding mousedown listener.');
      document.addEventListener('mousedown', handleClickOutside);
    }

    // La limpieza se hace aquí
    return () => {
      // console.log('[Click Outside useEffect] Cleanup: Removing mousedown listener.');
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // Asegurarse de que handleCloseModal (memoizada) es una dependencia
  }, [isModalOpen, handleCloseModal]); 

  // --- NUEVOS HANDLERS PARA MODAL DE FILTRO ---
  const handleFilterButtonClick = () => {
    setIsFilterModalOpen(true);
  };

  const handleCloseFilterModal = () => {
    setIsFilterModalOpen(false);
  };

  const handleApplyProfessionalFilter = (professionalId: string | null) => {
    setSelectedProfessionalFilterId(professionalId);
    setIsFilterModalOpen(false); // Cerrar modal después de aplicar
    // Opcional: Podrías guardar el filtro en localStorage si quieres persistencia
  };
  // --------------------------------------------

  if (loading) {
    return <div className="fullcalendar-container loading"><p>Cargando calendario...</p></div>;
  }

  if (error) {
    return <div className="fullcalendar-container error"><p>Error: {error}</p></div>;
  }

  // --- Icono de filtro activo (opcional) ---
  const filterButtonText = selectedProfessionalFilterId
    ? professionalsMap.get(selectedProfessionalFilterId)?.name || 'Filtrado'
    : '';

  return (
    <div className='fullcalendar-container'>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView='dayGridMonth'
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          // --- Añadir botón personalizado a la derecha ---
          right: 'professionalFilterButton dayGridMonth'
          // ---------------------------------------------
        }}
        // --- Definir botón personalizado ---
        customButtons={{
          professionalFilterButton: {
            // Usar el icono importado
            icon: 'filter-button-icon', // Usaremos CSS para poner el icono real
            text: filterButtonText, // Mostrar nombre si está filtrado
            click: handleFilterButtonClick, // Handler al hacer clic
          },
        }}
        // -----------------------------------
        events={calendarEvents}
        locale={esLocale}
        dayMaxEvents={2} // Mostrar máximo 2 eventos por día
        // --- Handlers --- 
        eventMouseEnter={handleMouseEnter} // Mostrar popover al entrar
        eventMouseLeave={handleMouseLeave} // Ocultar popover al salir
        eventClick={handleEventClick} // Handler para el clic en el evento
        // -----------------
        height="100%" // Hacer que ocupe la altura del contenedor
        contentHeight="auto" // Ajustar altura del contenido dinámicamente
        // slotMinTime="08:00:00" // No relevante en vista mensual
        // slotMaxTime="21:00:00" // No relevante en vista mensual
        eventContent={renderStyledEventContent}
      />
      {/* Renderizar el Popover si show es true */}
      {popover.content && (
        <div
          ref={popoverRef} // Añadir ref
          className={`event-popover ${popover.show ? 'show' : ''}`} // Usar clase 'show'
          style={{ 
            // Quitar position: absolute de aquí, ya está en CSS
            left: `${popover.x}px`, 
            top: `${popover.y}px`,
            // Quitar transform, la posición se calcula para centrar
          }}
        >
          {popover.content}
        </div>
      )}

      {/* --- Modal/Panel Lateral de Detalles de Reserva --- */}
      {selectedBookingDetails && (
        <div 
          ref={modalRef} // <-- Asignar la ref al div del modal
          className={`booking-details-modal ${isModalOpen ? 'open' : ''}`}>
          <div className="booking-details-header">
            <h3>Detalles de la Reserva</h3>
            <button onClick={handleCloseModal} className="close-button">
              {/* Puedes usar un icono aquí: <VscChromeClose /> */} 
              &times; {/* O simplemente una 'X' */}
            </button>
          </div>
          <div className="booking-details-content">
            {/* Separar cada detalle en su propio bloque */}
            <div className="detail-block client-info">
                <p><strong>Cliente:</strong> <span>{selectedBookingDetails.customerName}</span></p>
            </div>
            <div className="detail-block datetime-info">
                <p>
                    <strong>Fecha y Hora:</strong>
                    <span>{format(selectedBookingDetails.dateTime.toDate(), "eeee, dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}</span>
                </p>
            </div>
            {selectedBookingDetails.serviceName && (
                <div className="detail-block service-info">
                    <p><strong>Servicio:</strong> <span>{selectedBookingDetails.serviceName}</span></p>
                </div>
            )}
            {selectedBookingDetails.professionalId && professionalsMap.has(selectedBookingDetails.professionalId) && (
                <div className="detail-block modal-prof-info">
                    <p> {/* Mantener la etiqueta strong para alineación */}
                        <strong>Profesional:</strong>
                    </p>
                    <div className="prof-details">
                        {professionalsMap.get(selectedBookingDetails.professionalId)?.imageUrl && (
                            <img 
                                src={professionalsMap.get(selectedBookingDetails.professionalId)?.imageUrl} 
                                alt={professionalsMap.get(selectedBookingDetails.professionalId)?.name}
                                className="modal-prof-img"
                            />
                        )}
                        <span className="prof-name-span">{professionalsMap.get(selectedBookingDetails.professionalId)?.name}</span>
                    </div>
                </div>
            )}
            <div className="detail-block status-info">
                <p>
                    <strong>Estado:</strong>
                    <span className={`status-indicator status-${selectedBookingDetails.status}`}>
                        {selectedBookingDetails.status}
                    </span>
                </p>
            </div>
            {/* Puedes añadir más detalles aquí si los tienes en el objeto Booking */}
            {/* Por ejemplo: Notas, Precio, etc. */} 
          </div>
          {/* Podrías añadir acciones aquí (editar, cancelar, etc.) en el futuro */}
          {/* <div className="booking-details-actions">...</div> */}
        </div>
      )}
      {/* Fondo oscuro cuando el modal está abierto (opcional) */} 
      {/* Puedes comentar o quitar esta línea si NUNCA quieres el fondo oscuro */}
      {isModalOpen && <div className="modal-backdrop" onClick={handleCloseModal}></div>}

      {/* --- Renderizar Modal de Filtro --- */}
      <ProfessionalFilterModal
        userId={userId}
        isOpen={isFilterModalOpen}
        onClose={handleCloseFilterModal}
        onApplyFilter={handleApplyProfessionalFilter}
        currentFilterId={selectedProfessionalFilterId}
      />
      {/* ----------------------------------- */}
    </div>
  );
};

// Función opcional para personalizar el renderizado del contenido del evento
/*
function renderEventContent(eventInfo: any) {
  const { professionalImageUrl, professionalName, serviceName } = eventInfo.event.extendedProps;
  return (
    <div className='custom-event-render'>
      {professionalImageUrl && <img src={professionalImageUrl} alt={professionalName || 'Prof'} className='event-img-fc' />}
      <div className='event-details-fc'>
        <b>{eventInfo.timeText}</b> - <i>{eventInfo.event.title}</i>
        {serviceName && <div className='event-service-fc'>{serviceName}</div>}
        {professionalName && <div className='event-prof-fc'>({professionalName})</div>}
      </div>
    </div>
  )
}
*/

export default FullCalendarComponent; 