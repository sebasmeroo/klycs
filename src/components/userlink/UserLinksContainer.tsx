import React from 'react';
import UserLinkButton from './UserLinkButton';
import './UserLinks.css';

interface Link {
  id: string;
  title: string;
  url: string;
  active?: boolean;
}

interface UserLinksContainerProps {
  links: Link[];
  className?: string;
}

const UserLinksContainer: React.FC<UserLinksContainerProps> = ({ links, className = '' }) => {
  // Filtrar solo los enlaces activos
  const activeLinks = links.filter(link => link.active !== false);

  if (activeLinks.length === 0) {
    return null;
  }

  return (
    <div className={`user-links-container ${className}`}>
      {activeLinks.map(link => (
        <UserLinkButton
          key={link.id}
          title={link.title}
          url={link.url}
        />
      ))}
    </div>
  );
};

export default UserLinksContainer; 