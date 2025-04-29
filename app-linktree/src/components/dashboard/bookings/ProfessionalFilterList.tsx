import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/config'; // Ajustar ruta si es necesario
import { Professional } from '../../cardeditor/types'; // Ajustar ruta si es necesario
import './ProfessionalFilterList.css'; // Crearemos este archivo CSS

interface ProfessionalFilterListProps {
  userId: string;
  // Podríamos añadir props para manejar la selección en el futuro:
  // selectedProfessionalId: string | null;
  // onSelectProfessional: (id: string | null) => void;
}

const ProfessionalFilterList: React.FC<ProfessionalFilterListProps> = ({ userId }) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("No se proporcionó ID de usuario.");
      return;
    }

    setLoading(true);
    setError(null);
    const professionalsPath = `users/${userId}/professionals`;
    const qProf = query(collection(db, professionalsPath));

    const unsubscribe = onSnapshot(qProf,
      (snapshot) => {
        const fetchedProfessionals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional));
        setProfessionals(fetchedProfessionals);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching professionals for filter list: ", err);
        setError("Error al cargar profesionales.");
        setLoading(false);
      }
    );

    return () => unsubscribe(); // Limpiar listener

  }, [userId]);

  if (loading) {
    return <div className="prof-filter-list loading">Cargando profesionales...</div>;
  }

  if (error) {
    return <div className="prof-filter-list error">{error}</div>;
  }

  return (
    <div className="prof-filter-list">
      {/* Opción para ver "Todos" (descomentar si se añade lógica de selección) */}
      {/* 
      <div className="prof-item all-professionals selected">
        <div className="prof-avatar all"></div>
        <span>Todos los especialistas</span>
      </div>
      */}
      {professionals.length === 0 ? (
        <p>No hay profesionales configurados.</p>
      ) : (
        professionals.map(prof => (
          <div key={prof.id} className="prof-item">
            <div className="prof-avatar">
              {prof.imageUrl ? (
                <img src={prof.imageUrl} alt={prof.name || 'Profesional'} />
              ) : (
                <div className="prof-avatar-placeholder">{prof.name ? prof.name.charAt(0).toUpperCase() : 'P'}</div>
              )}
            </div>
            <span className="prof-name">{prof.name || 'Profesional sin nombre'}</span>
            {/* Añadir icono o indicador de selección si es necesario */}
          </div>
        ))
      )}
    </div>
  );
};

export default ProfessionalFilterList; 