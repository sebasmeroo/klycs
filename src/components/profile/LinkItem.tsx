import React from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';
// Importa FontAwesome si quieres usar iconos
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faGlobe } from '@fortawesome/free-solid-svg-icons'; // Ejemplo

interface LinkItemProps {
  link: {
    id: string;
    title: string;
    url: string;
    icon?: string; // Podrías mapear esto a un icono de FontAwesome u otro
  };
}

const LinkItem: React.FC<LinkItemProps> = ({ link }) => {
  const handleClick = async () => {
    try {
      // Registrar el clic para analíticas
      const recordLinkClick = httpsCallable(functions, 'recordLinkClick');
      await recordLinkClick({ linkId: link.id });
    } catch (error) {
      console.error('Error al registrar clic:', error);
    }
  };

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="link-item"
    >
      {/* Si quieres usar iconos:
      <span className="link-icon">
        <FontAwesomeIcon icon={faGlobe} /> 
      </span> 
      */}
      <span className="link-title">{link.title}</span>
      {/* <span className="link-arrow"><i className="fas fa-chevron-right"></i></span> // Opcional con FontAwesome */}
    </a>
  );
};

export default LinkItem;
