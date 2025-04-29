import React from 'react';

interface LinkItemProps {
  link: {
    id: string;
    title: string;
    url: string;
  };
}

const LinkItem: React.FC<LinkItemProps> = ({ link }) => {
  const { title, url } = link;

  const handleClick = () => {
    // Aquí se podría implementar un contador de clics para analíticas
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button 
      className="user-link-item"
      onClick={handleClick}
      aria-label={`Visitar ${title}`}
    >
      <span className="link-title">{title}</span>
      <span className="link-arrow">→</span>
    </button>
  );
};

export default LinkItem; 