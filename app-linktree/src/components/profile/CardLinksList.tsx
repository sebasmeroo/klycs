import React from 'react';
import { CardLink as LinkType } from '../cardeditor/types'; // Importar tipo
import './CardLinksList.css'; // Importar CSS

interface CardLinksListProps {
  links: LinkType[];
  className?: string;
  // Podríamos añadir props para estilos de botón aquí si fuera necesario
}

const CardLinksList: React.FC<CardLinksListProps> = ({
  links,
  className = ''
}) => {

  const activeLinks = links.filter(l => l.active);

  if (activeLinks.length === 0) {
    return null;
  }

  return (
    <div className={`rendered-links-container-linktree mb-4 ${className}`}> 
      {activeLinks.map(link => (
        <a 
          key={link.id} 
          href={link.url} 
          className="rendered-link-button-linktree" // Usar esta clase para estilos
          target="_blank" 
          rel="noopener noreferrer"
        >
          {link.title}
        </a>
      ))}
    </div>
  );
};

export default CardLinksList; 