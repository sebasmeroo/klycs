import React from 'react';
import './CardTitle.css';

interface CardTitleProps {
  title?: string | null;
  textColor?: string;
  className?: string;
}

const CardTitle: React.FC<CardTitleProps> = ({
  title,
  textColor = '#333333',
  className = ''
}) => {

  if (!title) {
    return null;
  }

  return (
    <h2 
      className={`rendered-card-title-linktree text-center mb-3 ${className}`} 
      style={{ color: textColor }}
    >
      {title}
    </h2>
  );
};

export default CardTitle; 