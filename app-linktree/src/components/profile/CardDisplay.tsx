import React from 'react';
import { Link } from 'react-router-dom';
import './CardDisplay.css';

// Importar el tipo CardSectionType si es necesario (o definirlo aquí si no se comparte)
// Asumamos que viene con el objeto Card o se importa desde un lugar común
import { CARD_SECTION_TYPES, CardSectionType } from '../cardeditor/CardEditorContainer'; // Ajusta la ruta si es necesario

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
  sectionOrder?: CardSectionType[]; // AÑADIDO: Para el orden de las secciones
  // Podrías añadir aquí los productos si se van a mostrar en CardDisplay
  // products?: any[]; // Ejemplo
  // bookingEnabled?: boolean; // Ejemplo para la sección de booking
}

interface CardDisplayProps {
  card: Card;
  username: string;
  updateCardViews?: (cardId: string) => void;
}

// Definir un orden por defecto si no se proporciona uno
const DEFAULT_DISPLAY_ORDER: CardSectionType[] = ['header', 'image', 'description', 'links']; // Ajusta según las secciones que realmente muestra CardDisplay

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

  // Determinar el orden de renderizado de las secciones
  const currentSectionOrder = card.sectionOrder && card.sectionOrder.length > 0 
    ? card.sectionOrder 
    : DEFAULT_DISPLAY_ORDER;

  // Función para renderizar una sección específica basada en su tipo
  const renderSection = (sectionType: CardSectionType) => {
    switch (sectionType) {
      case 'header':
        return (
          <div className="profile-card-header" key={sectionType}>
            <h2 className="profile-card-title">{card.title}</h2>
          </div>
        );
      case 'image':
        return card.imageURL ? (
          <div className="profile-card-image-container" key={sectionType}>
            <img src={card.imageURL} alt={card.title} className="profile-card-image" />
          </div>
        ) : null;
      case 'description':
        return card.description ? (
          <p className="profile-card-description" key={sectionType}>{card.description}</p>
        ) : null;
      case 'links':
        return activeLinks.length > 0 ? (
          <div className="profile-card-links" key={sectionType}>
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
        ) : null;
      // CASOS PARA 'products' y 'booking' necesitarían su propio JSX si se muestran aquí
      // case 'products':
      //   return card.products && card.products.length > 0 ? (
      //     <div className="profile-card-products" key={sectionType}>{/* ... JSX para productos ... */}</div>
      //   ) : null;
      // case 'booking':
      //   return card.bookingEnabled ? (
      //     <div className="profile-card-booking" key={sectionType}>{/* ... JSX para booking ... */}</div>
      //   ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="profile-card" style={backgroundStyle}>
      {/* Renderizar secciones según el orden definido */}
      {currentSectionOrder.map(sectionType => renderSection(sectionType))}

      {/* El footer generalmente se mantiene al final y no es parte del sectionOrder reordenable */}
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