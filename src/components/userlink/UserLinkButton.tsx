import React from 'react';
import './UserLinks.css';

interface UserLinkButtonProps {
  title: string;
  url: string;
  className?: string;
}

const UserLinkButton: React.FC<UserLinkButtonProps> = ({ title, url, className = '' }) => {
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Función para detectar si es una URL externa o interna
  const isExternalUrl = (url: string): boolean => {
    return url.startsWith('http') || url.startsWith('https') || url.startsWith('//');
  };

  // Seleccionar el icono adecuado según el tipo de URL
  const getIcon = (): string => {
    if (url.includes('instagram')) return '📸';
    if (url.includes('twitter') || url.includes('x.com')) return '🐦';
    if (url.includes('facebook')) return '👥';
    if (url.includes('youtube')) return '📹';
    if (url.includes('linkedin')) return '💼';
    if (url.includes('github')) return '💻';
    if (url.includes('tiktok')) return '🎵';
    if (url.includes('spotify')) return '🎧';
    if (url.includes('whatsapp')) return '💬';
    if (url.includes('telegram')) return '📱';
    return isExternalUrl(url) ? '🔗' : '➡️';
  };

  // Determinar la clase CSS basada en el dominio
  const getLinkClass = (): string => {
    if (url.includes('instagram')) return 'user-link-instagram';
    if (url.includes('twitter') || url.includes('x.com')) return 'user-link-twitter';
    if (url.includes('facebook')) return 'user-link-facebook';
    if (url.includes('youtube')) return 'user-link-youtube';
    if (url.includes('linkedin')) return 'user-link-linkedin';
    if (url.includes('github')) return 'user-link-github';
    if (url.includes('tiktok')) return 'user-link-tiktok';
    if (url.includes('spotify')) return 'user-link-spotify';
    if (url.includes('whatsapp')) return 'user-link-whatsapp';
    if (url.includes('telegram')) return 'user-link-telegram';
    return 'user-link-default';
  };

  return (
    <button 
      className={`user-link-button ${getLinkClass()} ${className}`}
      onClick={handleClick}
      aria-label={`Visitar ${title}`}
    >
      <span className="user-link-icon">{getIcon()}</span>
      <span className="user-link-title">{title}</span>
      <span className="user-link-arrow">→</span>
    </button>
  );
};

export default UserLinkButton; 