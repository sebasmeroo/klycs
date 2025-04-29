import React from 'react';
import { Link } from 'react-router-dom';
import './CardDisplay.css';

interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

interface Card {
  id: string;
  title: string;
  description: string;
  imageURL?: string;
  links: CardLink[];
  autoUrl?: string;
  active: boolean;
  views: number;
  createdAt: number;
  backgroundType?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
  userId?: string;
}

interface CardDisplayProps {
  card: Card;
  username: string;
  updateCardViews?: (cardId: string) => void;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, username, updateCardViews }) => {
  const activeLinks = card.links.filter(link => link.active);

  React.useEffect(() => {
    // Incrementar vistas cuando se monta el componente
    if (updateCardViews) {
      updateCardViews(card.id);
    }
  }, [card.id, updateCardViews]);

  // Determinar el estilo de fondo basado en el tipo de fondo
  const getBackgroundStyle = () => {
    const defaultStyle = {};
    
    if (!card.backgroundType || card.backgroundType === 'color') {
      return { backgroundColor: card.backgroundColor || '#ffffff' };
    } else if (card.backgroundType === 'gradient') {
      return { background: card.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%,rgb(198, 209, 231) 100%)' };
    } else if (card.backgroundType === 'image' && card.backgroundImageURL) {
      return { 
        backgroundImage: `url(${card.backgroundImageURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    
    return defaultStyle;
  };

  const backgroundStyle = getBackgroundStyle();

  return (
    <div className="profile-card" style={backgroundStyle}>
      <div className="profile-card-header">
        <h2 className="profile-card-title">{card.title}</h2>
      </div>

      {card.imageURL && (
        <div className="profile-card-image-container">
          <img src={card.imageURL} alt={card.title} className="profile-card-image" />
        </div>
      )}

      {card.description && (
        <p className="profile-card-description">{card.description}</p>
      )}

      {activeLinks.length > 0 && (
        <div className="profile-card-links">
          {activeLinks.map(link => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-card-link"
              onClick={(e) => {
                e.stopPropagation(); // Evitar que el clic afecte al contenedor padre
              }}
            >
              {link.title}
            </a>
          ))}
        </div>
      )}

      <div className="profile-card-footer">
        <span className="profile-card-views">
          <i className="bi bi-eye"></i> {card.views} vistas
        </span>
        
        <Link to={`/${username}/card/${card.id}`} className="profile-card-share">
          <i className="bi bi-share"></i> Compartir
        </Link>
      </div>
    </div>
  );
};

export default CardDisplay; 