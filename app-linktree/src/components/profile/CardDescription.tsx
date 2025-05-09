import React from 'react';
import './CardDescription.css';

interface CardDescriptionProps {
  description?: string | null;
  textColor?: string;
  className?: string;
}

const CardDescription: React.FC<CardDescriptionProps> = ({
  description,
  textColor = '#333333',
  className = ''
}) => {

  if (!description) {
    return null;
  }

  return (
    <p 
      className={`rendered-description-linktree text-center mb-4 ${className}`}
      style={{ color: textColor }}
    >
      {description}
    </p>
  );
};

export default CardDescription; 