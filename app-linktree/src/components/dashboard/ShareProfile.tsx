import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './ShareProfile.css'; // Estilos principales

// Importar los nuevos subcomponentes
import CardSelector from './share/CardSelector';
import SharePreview from './share/SharePreview';
import DirectLink from './share/DirectLink';
import SocialShare from './share/SocialShare';
import ShareTips from './share/ShareTips';

// Interfaz para los datos de la tarjeta que se cargan y se pasan
interface CardForShareData {
  id: string;
  title: string;
  autoUrl?: string;
  imageURL?: string;
}

// Props del componente principal (si las tuviera, actualmente no)
interface ShareProfileProps {}

const ShareProfile: React.FC<ShareProfileProps> = () => {
  const { user } = useAuth();
  const [userCards, setUserCards] = useState<CardForShareData[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedCardData, setSelectedCardData] = useState<CardForShareData | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cargar tarjetas del usuario
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setUserCards([]);
      setSelectedCardId('');
      setSelectedCardData(null);
      setShareUrl('');
      return;
    }

    setLoading(true);
    setError(null);
    const cardsCollectionRef = collection(db, 'cards');
    const q = query(cardsCollectionRef, where("userId", "==", user.uid));

    getDocs(q)
      .then((querySnapshot) => {
        const fetchedCards = querySnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || 'Tarjeta sin Título',
          autoUrl: doc.data().autoUrl,
          imageURL: doc.data().imageURL, // Asumiendo que este es el campo
        })) as CardForShareData[];
        
        setUserCards(fetchedCards);

        if (fetchedCards.length > 0) {
          const firstCard = fetchedCards[0];
          setSelectedCardId(firstCard.id);
        } else {
          setSelectedCardId('');
          setSelectedCardData(null);
          setShareUrl('');
        }
      })
      .catch(err => {
        console.error("Error cargando tarjetas del usuario para compartir:", err);
        setError("Error al cargar tus tarjetas. Inténtalo de nuevo.");
        setUserCards([]);
        setSelectedCardId('');
        setSelectedCardData(null);
        setShareUrl('');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  // Actualizar datos y URL cuando cambia la tarjeta seleccionada
  useEffect(() => {
    if (!selectedCardId || !user?.uid || userCards.length === 0) {
      setSelectedCardData(null);
      setShareUrl('');
      return;
    }

    const currentCard = userCards.find(card => card.id === selectedCardId);

    if (currentCard) {
      setSelectedCardData(currentCard);
      setShareUrl(currentCard.autoUrl || `https://klycs-58190.firebaseapp.com/${user.uid}/card/${currentCard.id}`);
    } else {
      if (userCards.length > 0) {
        setSelectedCardId(userCards[0].id); 
      } else {
        setSelectedCardData(null);
        setShareUrl('');
      }
    }
  }, [selectedCardId, userCards, user]);

  if (loading) {
    return (
      <div className="share-profile-container">
         <p className="analytics-loading">Cargando tus tarjetas...</p>
      </div>
    );
  }

  return (
    <div className="share-profile-container">
      {/* <h2 className="share-profile-title">Compartir Tarjeta</h2> */}
      
      {error && <div className="username-alert error-alert">{error}</div>} 

      {!userCards || userCards.length === 0 && !loading && !error ? (
        <div className="username-alert info-alert">
          ℹ️ No tienes tarjetas creadas todavía. 
          <Link to="/card/new" className="create-card-link">Crea tu primera tarjeta</Link> para empezar a compartir.
        </div>
      ) : (
        <>
          <CardSelector 
            cards={userCards}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            disabled={loading}
          />

          {selectedCardData && shareUrl && (
            <div className="share-grid"> 
              <div className="share-column-left">
                <SharePreview 
                  cardTitle={selectedCardData.title}
                  imageURL={selectedCardData.imageURL}
                  shareUrl={shareUrl}
                />
              </div>
              
              <div className="share-column-right">
                <DirectLink shareUrl={shareUrl} />
                <SocialShare shareUrl={shareUrl} cardTitle={selectedCardData.title} />
                <ShareTips />
              </div>
            </div>
          )}
          {!selectedCardData && !loading && userCards.length > 0 && (
             <div className="username-alert info-alert">
               Selecciona una tarjeta de la lista para ver opciones de compartir.
             </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShareProfile; 