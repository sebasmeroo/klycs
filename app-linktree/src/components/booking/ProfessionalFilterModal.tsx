import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Asumiendo que firebase/config está en src/firebase/config.ts
import { Professional } from '../cardeditor/types'; // Asumiendo que types.ts está en src/components/cardeditor/types.ts
import './ProfessionalFilterModal.css';
import { FaTimes, FaCheck, FaUsers } from 'react-icons/fa';

interface ProfessionalFilterModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (professionalId: string | null) => void;
  currentFilterId: string | null;
}

const ProfessionalFilterModal: React.FC<ProfessionalFilterModalProps> = ({
  userId,
  isOpen,
  onClose,
  onApplyFilter,
  currentFilterId,
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(currentFilterId);
  const [showContent, setShowContent] = useState(false);

  // Al abrir, mostrar contenido
  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentFilterId);
      setShowContent(true);
    }
  }, [isOpen, currentFilterId]);

  // Manejar cierre con animación
  const handleCloseRequest = () => {
    setShowContent(false);
  };

  // Al terminar animación de cierre, llamar onClose
  useEffect(() => {
    if (!showContent && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 350); // Debe coincidir con transición CSS
      return () => clearTimeout(timer);
    }
  }, [showContent, isOpen, onClose]);

  // Cargar profesionales cuando se abra
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    if (!userId) {
      setLoading(false);
      setError('No se proporcionó ID de usuario.');
      return;
    }
    const path = `users/${userId}/professionals`;
    const unsubscribe = onSnapshot(query(collection(db, path)),
      snapshot => {
        setProfessionals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professional)));
        setLoading(false);
      },
      err => { console.error(err); setError('Error al cargar profesionales.'); setLoading(false); }
    );
    return () => unsubscribe();
  }, [userId, isOpen]);

  const handleSelect = (id: string | null) => setSelectedId(id);
  const handleApply = () => onApplyFilter(selectedId);

  // Montar solo si abierto o animando cierre
  if (!isOpen && !showContent) return null;

  return (
    <div
      className={`prof-filter-modal-backdrop ${showContent ? 'open' : ''}`}
      onClick={handleCloseRequest}
    >
      <div
        className={`prof-filter-modal-content ${showContent ? 'open' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="prof-filter-modal-header">
          <h3>Filtrar por Profesional</h3>
          <button onClick={handleCloseRequest} className="close-button" aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>
        <div className="prof-filter-modal-body">
          {loading && <p>Cargando...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && (
            <div className="prof-list">
              <div
                className={`prof-item ${selectedId === null ? 'selected' : ''}`}
                onClick={() => handleSelect(null)}
              >
                <div className="prof-avatar all-avatar"><FaUsers /></div>
                <span className="prof-name">Todos</span>
              </div>
              {professionals.length === 0 ? (
                <p className="no-profs">No hay profesionales configurados.</p>
              ) : professionals.map(prof => (
                <div
                  key={prof.id}
                  className={`prof-item ${selectedId === prof.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(prof.id)}
                >
                  <div className="prof-avatar">
                    {prof.imageUrl
                      ? <img src={prof.imageUrl} alt={prof.name || 'Profesional'} />
                      : <div className="prof-avatar-placeholder">{prof.name?.charAt(0).toUpperCase() || 'P'}</div>
                    }
                  </div>
                  <span className="prof-name">{prof.name || `Profesional ${prof.id.substring(0,5)}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="prof-filter-modal-footer">
          <button onClick={handleCloseRequest} className="cancel-button">Cancelar</button>
          <button onClick={handleApply} className="apply-button"><FaCheck /> Aplicar Filtro</button>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalFilterModal; 