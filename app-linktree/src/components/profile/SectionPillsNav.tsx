import React from 'react';
// Los imports de react-icons ya no son necesarios para los iconos de las píldoras
import { CardSectionType } from '../cardeditor/types';
import './SectionPillsNav.css';

interface SectionPillProps {
  section: CardSectionType;
  emoji: string; // Cambiado de icon a emoji
  label: string;
  onNavigate: (section: CardSectionType) => void;
}

const PillButton: React.FC<SectionPillProps> = ({ section, emoji, label, onNavigate }) => {
  return (
    <button
      className="section-pill-button"
      onClick={() => onNavigate(section)}
      title={`Ir a ${label}`}
    >
      <span className="pill-emoji" role="img" aria-label={label}>{emoji}</span> {/* Usar span para el emoji */}
      <span className="pill-label">{label}</span>
    </button>
  );
};

interface SectionPillsNavProps {
  availableSections: CardSectionType[];
  onNavigate: (section: CardSectionType) => void;
  // Podríamos añadir className para estilizar el contenedor desde fuera
  className?: string;
}

// Mapeo de configuración de secciones con Emojis
const SECTION_CONFIG_MAP: Partial<Record<CardSectionType, { emoji: string, label: string }>> = {
  links: { emoji: '🔗', label: 'Enlaces' },       // Emoji de enlace
  products: { emoji: '🛍️', label: 'Tienda' },    // Emoji de bolsa de compra
  booking: { emoji: '🗓️', label: 'Reservas' },  // Emoji de calendario
  // Añade aquí otras secciones y sus emojis correspondientes
  // Puedes buscar emojis estilo iOS en sitios como emojipedia.org
};

const SectionPillsNav: React.FC<SectionPillsNavProps> = ({
  availableSections,
  onNavigate,
  className = '',
}) => {
  // Filtrar y mapear solo las secciones que tienen configuración en SECTION_CONFIG_MAP
  const pillsToRender = availableSections
    .map(section => {
      const config = SECTION_CONFIG_MAP[section];
      if (config) {
        return {
          section,
          ...config,
        };
      }
      return null;
    })
    .filter(pill => pill !== null) as { section: CardSectionType; emoji: string; label: string }[];

  if (pillsToRender.length === 0) {
    return null;
  }

  return (
    <div className={`section-pills-nav-container ${className}`}>
      {pillsToRender.map(pillInfo => (
        <PillButton
          key={pillInfo.section}
          section={pillInfo.section}
          emoji={pillInfo.emoji} // Pasando emoji
          label={pillInfo.label}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};

export default SectionPillsNav; 