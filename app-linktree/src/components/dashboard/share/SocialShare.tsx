import React from 'react';
import {
  FacebookShareButton, FacebookIcon,
  TwitterShareButton, TwitterIcon,
  LinkedinShareButton, LinkedinIcon,
  WhatsappShareButton, WhatsappIcon,
  TelegramShareButton, TelegramIcon,
} from 'react-share';

interface SocialShareProps {
  shareUrl: string;
  cardTitle?: string; // Título de la tarjeta para personalizar los mensajes
}

const SocialShare: React.FC<SocialShareProps> = ({ shareUrl, cardTitle }) => {
  const title = cardTitle || 'Klycs';
  const message = `Mira mi tarjeta Klycs: ${title}`;
  const linkedinSummary = `Échale un vistazo a mi tarjeta digital Klycs: ${title}.`;

  if (!shareUrl) {
    return null; // No mostrar nada si no hay URL para compartir
  }

  return (
    <div className="share-section">
      <h3>Compartir Directamente</h3>
      <div className="social-share-buttons">
        <WhatsappShareButton url={shareUrl} title={message} separator=" " >
          <WhatsappIcon size={32} round />
        </WhatsappShareButton>
        
        <TwitterShareButton url={shareUrl} title={message}>
          <TwitterIcon size={32} round />
        </TwitterShareButton>
        
        <FacebookShareButton url={shareUrl} hashtag="#KlycsCard">
          <FacebookIcon size={32} round />
        </FacebookShareButton>
        
        <LinkedinShareButton url={shareUrl} title={`Mi Tarjeta Klycs: ${title}`} summary={linkedinSummary} source="Klycs App">
          <LinkedinIcon size={32} round />
        </LinkedinShareButton>

        <TelegramShareButton url={shareUrl} title={message}>
            <TelegramIcon size={32} round />
        </TelegramShareButton>
      </div>
    </div>
  );
};

export default SocialShare; 