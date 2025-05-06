import React, { useState, useMemo, useEffect } from 'react';
import './CardSelectionModal.css'; // Crearemos este archivo CSS
import { FiX, FiSearch } from 'react-icons/fi';

interface CardForShare {
  id: string;
  title: string;
  imageURL?: string; // Opcional, para mostrar una mini-preview en el modal
}

interface CardSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardForShare[];
  onSelectCard: (cardId: string) => void;
  currentSelectedId?: string;
}

const CardSelectionModal: React.FC<CardSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  cards, 
  onSelectCard, 
  currentSelectedId 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isVisible, setIsVisible] = useState(false); // Estado para controlar la clase de animación

  const filteredCards = useMemo(() => {
    if (!searchTerm) {
      return cards;
    }
    return cards.filter(card => 
      card.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [cards, searchTerm]);

  // Efecto para controlar la visibilidad y la clase para la animación
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true); // Hacer visible para aplicar la clase .open y animar la entrada
    } else {
      // Para la animación de salida, mantenemos isVisible true hasta que termine la transición de opacidad
      // El CSS se encarga de ocultar con visibility: hidden después de la transición de opacidad
      // Si quisiéramos un control más fino, podríamos usar onTransitionEnd
    }
  }, [isOpen]);

  // Cuando la animación de cierre debería haber terminado (basado en la transición de opacidad)
  // y el modal ya no está "abierto" según el prop, entonces lo ocultamos del DOM.
  // Esto es una simplificación. Para una animación de salida perfecta ANTES de quitar del DOM,
  // se necesitaría un poco más de lógica (ej. doble estado: isOpen, isActuallyRendered)
  // Pero para el fade-out del overlay, el CSS ya lo maneja con visibility.
  if (!isOpen && !isVisible) { // Si se cerró y ya no era visible, no renderizar
      // No hacer nada aquí, la clase .open se quitará por isOpen y el CSS manejará la animación de salida
  }
  if (!isOpen && isVisible) {
    // Este es el truco: si isOpen es false, pero isVisible es true, quitamos la clase open.
    // La animación de salida del CSS (.card-selection-modal-overlay sin .open) se ejecutará.
    // Después de la duración de la animación, queremos que se deje de renderizar el modal.
    // Usaremos un setTimeout para que coincida con la duración de la animación de opacidad (0.3s)
    // Esto es para que el modal no desaparezca abruptamente del DOM antes de que termine su animación CSS.
    const timer = setTimeout(() => {
        setIsVisible(false); // Ahora sí, podemos dejar de renderizarlo completamente.
    }, 300); // Coincide con la duración de la transición de opacidad
    // Importante limpiar el timer si el componente se desmonta o isOpen cambia de nuevo
    // return () => clearTimeout(timer); // Esto se complica si isOpen cambia rápidamente.
    // Por simplicidad, y dado que el CSS maneja visibility, esta demora para setIsVisible(false)
    // es principalmente para asegurar que el estado react refleje la no-visibilidad tras la anim.
  }

  // Si no está ni `isOpen` (prop) ni `isVisible` (estado para animación), no renderizar nada.
  // Esto evita que el modal permanezca en el DOM oculto después de la animación de salida.
  if (!isOpen && !isVisible) {
      return null;
  }

  const handleCardClick = (cardId: string) => {
    onSelectCard(cardId);
    onClose(); // Cerrar modal después de seleccionar
  };

  // Aplicar la clase 'open' al overlay basado en el prop isOpen para controlar la animación
  return (
    <div className={`card-selection-modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}> {/* Cierra al hacer clic fuera */} 
      <div className="card-selection-modal-content" onClick={(e) => e.stopPropagation()}> {/* Evita que el clic dentro cierre */} 
        <div className="card-selection-modal-header">
          <h4>Seleccionar Tarjeta</h4>
          <button onClick={onClose} className="close-modal-btn">
            <FiX size={20} />
          </button>
        </div>
        
        <div className="card-selection-modal-search">
          <FiSearch className="search-icon" />
          <input 
            type="text"
            placeholder="Buscar tarjeta por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <ul className="card-selection-modal-list">
          {filteredCards.length > 0 ? (
            filteredCards.map(card => (
              <li 
                key={card.id} 
                onClick={() => handleCardClick(card.id)}
                className={card.id === currentSelectedId ? 'selected' : ''}
              >
                {/* Opcional: Mini imagen */} 
                {card.imageURL && 
                  <img src={card.imageURL} alt={card.title} className="card-item-mini-preview" />
                }
                <span className="card-item-title">{card.title}</span>
              </li>
            ))
          ) : (
            <li className="no-results">No se encontraron tarjetas.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CardSelectionModal; 