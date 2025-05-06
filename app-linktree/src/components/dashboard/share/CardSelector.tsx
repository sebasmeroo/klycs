import React, { useState } from 'react';
import CardSelectionModal from './CardSelectionModal'; // Importar el modal
import { FiChevronDown } from 'react-icons/fi';
// El CSS de CardSelector podría necesitar ajustes o moverse a ShareProfile.css si es muy genérico
// import './CardSelector.css'; 

interface CardForShareDisplay {
  id: string;
  title: string;
  imageURL?: string; // Para el modal
}

interface CardSelectorProps {
  cards: CardForShareDisplay[];
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
  disabled: boolean;
}

const CardSelector: React.FC<CardSelectorProps> = ({ cards, selectedCardId, onSelectCard, disabled }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const selectedTitle = cards.find(c => c.id === selectedCardId)?.title || "Seleccionar Tarjeta";

  return (
    <div className="share-section card-selector-section-wrapper"> 
      <h3>Selecciona una Tarjeta para Compartir</h3>
      <div className="card-selector-display-button-container">
        <button 
          type="button"
          onClick={openModal} 
          disabled={disabled || cards.length === 0}
          className="card-selector-display-button"
        >
          <span>{selectedTitle}</span>
          <FiChevronDown />
        </button>
        {cards.length === 0 && !disabled && (
          <p className="no-cards-available-text">No hay tarjetas disponibles para compartir.</p>
        )}
      </div>

      <CardSelectionModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        cards={cards}
        onSelectCard={onSelectCard}
        currentSelectedId={selectedCardId}
      />
    </div>
  );
};

export default CardSelector; 