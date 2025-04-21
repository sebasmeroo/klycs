import React from 'react';
import './UserLinks.css';
import UserLinkButton from './UserLinkButton';

interface LinkButtonProps {
  title: string;
  url: string;
}

// Componente de compatibilidad que utiliza UserLinkButton internamente
const LinkButton: React.FC<LinkButtonProps> = ({ title, url }) => {
  return (
    <UserLinkButton 
      title={title} 
      url={url} 
    />
  );
};

export default LinkButton; 