import React, { useState } from 'react';
import { CardLink as LinkType } from '../cardeditor/types'; // Importar tipo
import './CardLinksList.css'; // Importar CSS

interface CardLinksListProps {
  links: LinkType[];
  className?: string;
  // Podríamos añadir props para estilos de botón aquí si fuera necesario
}

// Mapeo predefinido de hostnames a colores de fondo
const PREDEFINED_BG_COLORS: { [key: string]: string } = {
  'facebook.com': '#1877F2',    // Azul Facebook
  'twitter.com': '#1DA1F2',     // Azul Twitter
  'x.com': '#000000',           // Negro para X
  'instagram.com': '#E1306C',   // Rosa/Naranja Instagram
  'youtube.com': '#FF0000',     // Rojo YouTube
  'linkedin.com': '#0A66C2',    // Azul LinkedIn
  'github.com': '#181717',       // Casi Negro GitHub
  'cursor.sh': '#1a1a1a',
  'klycs.com': '#FF6B6B',
  // ...añadir más según sea necesario (sin www.)
};

// Función auxiliar para extraer el hostname de una URL (Restaurada)
const getHostname = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    let hostname = parsedUrl.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    console.warn('Error parsing URL for hostname extraction:', url, e);
    return null;
  }
};

const CardLinksList: React.FC<CardLinksListProps> = ({
  links,
  className = ''
}) => {

  const activeLinks = links.filter(l => l.active);

  if (activeLinks.length === 0) {
    return null;
  }

  return (
    <div className={`rendered-links-container-linktree ${className}`}>
      {activeLinks.map(link => {
        const hostname = getHostname(link.url);
        const faviconUrl = hostname ? `https://www.google.com/s2/favicons?domain=${link.url}&sz=64` : '';

        const [faviconError, setFaviconError] = useState(false);

        let backgroundColor = '#000000'; // Negro por defecto
        const textColor = '#FFFFFF';       // Texto siempre blanco

        if (hostname && PREDEFINED_BG_COLORS[hostname]) {
          backgroundColor = PREDEFINED_BG_COLORS[hostname];
          // Ya no se calcula el color del texto, es siempre blanco
        }

        const linkStyle = {
          backgroundColor,
          color: textColor,
          // borderColor ya no se define aquí, se usará el del CSS
        };

        return (
          <a 
            key={link.id} 
            href={link.url} 
            className="rendered-link-button-linktree"
            target="_blank" 
            rel="noopener noreferrer"
            style={linkStyle} // Aplicar estilos en línea
          >
            <div className="link-content-wrapper">
              <div className="link-icon-container">
                <span className="link-icon" role="img" aria-label="Link icon">
                  {hostname && faviconUrl && !faviconError ? (
                    <img 
                      src={faviconUrl} 
                      alt="" // Alt vacío ya que es decorativo o el título del enlace es suficiente
                      onError={() => setFaviconError(true)}
                      className="link-favicon-img" // Clase para aplicar estilos CSS
                    />
                  ) : (
                    '🔗' // Fallback si no hay hostname, URL de favicon, o si hay error
                  )}
                </span>
              </div>
              <div className="link-title-container">
                <span className="link-title">
                  {link.title}
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default CardLinksList; 