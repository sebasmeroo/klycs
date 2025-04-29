import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase/config'; // Ajustar ruta si es necesario
import './BookingList.css'; // Crear este archivo CSS después

// Interfaz para representar una reserva (ajustar según datos reales)
interface Booking {
  id: string;
  cardId: string; // ID de la tarjeta donde se hizo la reserva
  serviceId: string;
  serviceName?: string; // Nombre del servicio (podría obtenerse haciendo join o guardarse)
  customerName: string;
  customerEmail: string;
  dateTime: Date; // Fecha y hora combinadas
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
}

interface BookingListProps {
  userId: string; // ID del profesional (dueño del dashboard)
}

const BookingList: React.FC<BookingListProps> = ({ userId }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("No se pudo identificar al usuario.");
      return;
    }

    console.log(`Fetching bookings for user: ${userId} from subcollection users/${userId}/bookings`);

    // Consulta para obtener reservas desde la subcolección del usuario
    const userBookingsPath = `users/${userId}/bookings`; // Construir la ruta correcta
    const bookingsRef = collection(db, userBookingsPath); // <-- USAR LA RUTA CORRECTA

    // La regla de seguridad ya filtra por usuario, no necesitamos el 'where' aquí.
    // Ordenamos por fecha de la cita.
    const q = query(
      bookingsRef,
      orderBy('dateTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Snapshot received, ${snapshot.size} bookings found.`);
      const fetchedBookings: Booking[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedBookings.push({
          id: doc.id,
          cardId: data.cardId,
          serviceId: data.serviceId,
          serviceName: data.serviceName || 'Servicio no especificado', // O buscarlo
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          // Convertir Timestamp de Firestore a Date de JS
          dateTime: data.dateTime?.toDate ? data.dateTime.toDate() : new Date(),
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        });
      });
      setBookings(fetchedBookings);
      setLoading(false);
      setError(null); // Limpiar error si la carga fue exitosa
    }, (err) => {
      console.error("Error fetching bookings: ", err);
      setError("Error al cargar las reservas.");
      setLoading(false);
    });

    // Limpiar el listener al desmontar el componente
    return () => unsubscribe();

  }, [userId]);

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    return date.toLocaleString('es-ES', { 
      year: 'numeric', month: 'numeric', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="booking-list-container">
      <h2 className="booking-list-title">Gestión de Reservas</h2>

      {loading && <p>Cargando reservas...</p>}
      {error && <p className="booking-list-error">{error}</p>}

      {!loading && !error && (
        bookings.length === 0 ? (
          <p className="no-bookings-message">Aún no tienes ninguna reserva.</p>
        ) : (
          <div className="booking-table-scroll-container">
             <table className="booking-table">
               <thead>
                 <tr>
                   <th>Cliente</th>
                   <th>Email</th>
                   <th>Servicio</th>
                   <th>Fecha y Hora</th>
                   <th>Estado</th>
                   <th>Solicitada</th>
                   {/* <th>Acciones</th> */} 
                 </tr>
               </thead>
               <tbody>
                 {bookings.map((booking) => (
                   <tr key={booking.id}>
                     <td>{booking.customerName}</td>
                     <td>{booking.customerEmail}</td>
                     <td>{booking.serviceName}</td>
                     <td>{formatDate(booking.dateTime)}</td>
                     <td>
                       <span className={`status-badge status-${booking.status}`}>
                         {booking.status}
                       </span>
                     </td>
                     <td>{formatDate(booking.createdAt)}</td>
                     {/* 
                     <td>
                       <button className="action-button view-button">Ver</button>
                       <button className="action-button confirm-button">Confirmar</button>
                       <button className="action-button cancel-button">Cancelar</button>
                     </td>
                     */}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )
      )}
    </div>
  );
};

export default BookingList; 