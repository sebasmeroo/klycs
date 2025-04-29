import React, { useState, useEffect, useRef } from 'react';
import { doc, deleteDoc, updateDoc, collection, query, where, onSnapshot, Unsubscribe, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import './Cards.css';
import { useNavigate } from 'react-router-dom';
import CardEditorContainer from '../../cardeditor/CardEditorContainer';
import '../../cardeditor/CardEditor.css';
import { deleteImageFromStorage } from '../../../utils/storageUtils';
import { BookingSettings } from '../../cardeditor/types';
import { useAuth } from '../../../context/AuthContext';

// Interfaces para tipado
interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  imageURL: string;
  url?: string;
  autoUrl?: string;
  active: boolean;
}

interface Card {
  id: string;
  title: string;
  description: string;
  imageURL?: string;
  links: CardLink[];
  products: Product[];
  autoUrl?: string;
  active: boolean;
  views: number;
  createdAt: number;
  backgroundType?: 'image' | 'color' | 'gradient' | 'pattern';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
  userId: string;
  template?: string;
  storeName?: string;
}

interface CardsManagerProps {
  userData: any;
}

// Definir límites de tarjetas por plan
const CARD_LIMITS = {
  FREE: 1,
  BASIC: 5,
  PRO: 20,
  ADMIN: Infinity, // O un número muy grande
};

const CardsManager: React.FC<CardsManagerProps> = ({ userData }) => {
  const navigate = useNavigate();
  const { effectivePlan, loadingAuth, loadingProfile } = useAuth();
  const [openEditorCardId, setOpenEditorCardId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const initialSavedCardIdRef = useRef<string | null>(null); // Ref para guardar el ID inicial
  
  // Nuevo useEffect para cargar tarjetas desde la colección 'cards' en tiempo real
  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsubscribe: Unsubscribe = () => {}; // Inicializar unsubscribe

    if (userData && userData.uid) {
      console.log(`Estableciendo listener para tarjetas del usuario: ${userData.uid}`);
      const cardsRef = collection(db, 'cards');
      const q = query(cardsRef, where("userId", "==", userData.uid));

      unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const fetchedCards = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Card[];
          console.log("Tarjetas recibidas:", fetchedCards.length);
          setCards(fetchedCards);

          // *** VALIDACIÓN DEL ID GUARDADO ***
          const savedId = initialSavedCardIdRef.current;
          if (savedId) {
            const cardExists = fetchedCards.some(card => card.id === savedId);
            if (cardExists) {
              console.log('[CardsManager] ID guardado encontrado en tarjetas fetcheadas, estableciendo openEditorCardId:', savedId);
              setOpenEditorCardId(savedId);
            } else {
              console.log('[CardsManager] ID guardado NO encontrado en tarjetas fetcheadas, limpiando localStorage y manteniendo editor cerrado.');
              localStorage.removeItem('openEditorCardId');
              setOpenEditorCardId(null); // Asegurarse de que esté cerrado
            }
          } else {
            // Si no había ID guardado, asegurarse de que el editor esté cerrado
            setOpenEditorCardId(null);
          }
          // *** FIN VALIDACIÓN ***

          setLoading(false);
        },
        (error) => {
          console.error("Error al escuchar tarjetas:", error);
          setError("Error al cargar las tarjetas. Inténtalo de nuevo.");
          setLoading(false);
        }
      );
    } else {
      console.log("No hay userData.uid, no se puede cargar tarjetas.");
      setCards([]); // Asegurar que las tarjetas estén vacías si no hay usuario
      setLoading(false);
    }

    // Función de limpieza para cancelar la suscripción
    return () => {
      console.log("Cancelando listener de tarjetas.");
      unsubscribe();
    };
  }, [userData]); // Depender de userData para obtener el uid

  // LEER de localStorage AL MONTAR (solo guardar en Ref)
  useEffect(() => {
    initialSavedCardIdRef.current = localStorage.getItem('openEditorCardId');
    console.log('[CardsManager] Leyendo de localStorage openEditorCardId (guardado en Ref):', initialSavedCardIdRef.current);
    // NO establecer el estado aquí
  }, []);

  // GUARDAR en localStorage cuando openEditorCardId cambie (y no sea null)
  useEffect(() => {
    if (openEditorCardId) {
      console.log('[CardsManager] Guardando en localStorage openEditorCardId:', openEditorCardId);
      localStorage.setItem('openEditorCardId', openEditorCardId);
    } else {
      console.log('[CardsManager] Eliminando de localStorage openEditorCardId');
      localStorage.removeItem('openEditorCardId');
    }
  }, [openEditorCardId]);

  // Calcular si el usuario puede crear más tarjetas
  const currentCardCount = cards.length;
  const cardLimit = CARD_LIMITS[effectivePlan] || 0; // Límite para el plan actual
  const canCreateMoreCards = currentCardCount < cardLimit;

  // Función para manejar la creación de una *nueva* tarjeta (con validación de límite)
  const handleCreateNewCard = async () => {
     if (!userData || !userData.uid) {
       setError("Necesitas estar logueado para crear una tarjeta.");
       return;
     }

     // Doble validación: comprobar límite antes de continuar
     if (!canCreateMoreCards) {
        setError(`Has alcanzado el límite de ${cardLimit} tarjetas para tu plan ${effectivePlan}.`);
        return;
     }

     setLoading(true);
     setError(null);
     const newCardId = uuidv4();

     // Datos para el documento principal de la tarjeta (sin bookingSettings)
     const newCardData: Omit<Card, 'id'> = {
       userId: userData.uid,
       title: "Nueva Tarjeta",
       description: "",
       links: [],
       products: [],
       active: true,
       views: 0,
       createdAt: Date.now(),
       template: 'standard',
       backgroundType: 'color',
       backgroundColor: '#ffffff'
     };

     // Datos iniciales para el documento settings en la subcolección
     const initialBookingSettings: BookingSettings = {
         enabled: false,
         services: [],
         availability: {},
         acceptOnlinePayments: false,
         allowProfessionalSelection: false // Añadir valor por defecto explícito
     };

     try {
       // 1. Crear el documento principal de la tarjeta
       const newCardRef = doc(db, 'cards', newCardId);
       await setDoc(newCardRef, newCardData);
       console.log("Documento principal de tarjeta creado con ID:", newCardId);

       // 2. Crear el documento 'settings' en la subcolección 'bookingSettings'
       const settingsRef = doc(db, 'cards', newCardId, 'bookingSettings', 'settings');
       await setDoc(settingsRef, initialBookingSettings);
       console.log(`Documento settings creado en cards/${newCardId}/bookingSettings/settings`);

       // Abrir el editor para la nueva tarjeta
       console.log('[CardsManager] Estableciendo openEditorCardId después de crear:', newCardId);
       setOpenEditorCardId(newCardId);

     } catch (error: any) {
       console.error("Error creando nueva tarjeta y/o settings:", error);
       setError("Error al crear la tarjeta. Inténtalo de nuevo.");
       // Considerar lógica de rollback si falla el segundo setDoc?
     } finally {
       setLoading(false);
     }
  };

  // Editar tarjeta - abrir editor inline
  const handleEdit = (card: Card) => {
    console.log('[CardsManager] Estableciendo openEditorCardId desde handleEdit:', card.id);
    setOpenEditorCardId(card.id);
  };

  // Modificar handleDelete para operar en la colección 'cards'
  const handleDelete = async (id: string) => {
    // Encontrar la tarjeta localmente para obtener URLs de imagen
    const cardToDelete = cards.find(card => card.id === id);
    
    // Eliminar imágenes asociadas (igual que antes)
    if (cardToDelete?.imageURL) {
      deleteImageFromStorage(cardToDelete.imageURL).catch(console.error);
    }
    if (cardToDelete?.backgroundImageURL) {
      deleteImageFromStorage(cardToDelete.backgroundImageURL).catch(console.error);
    }
    
    // Eliminar el documento de la colección 'cards'
    try {
      setLoading(true); // Indicar carga durante la eliminación
      const cardRef = doc(db, 'cards', id);
      await deleteDoc(cardRef);
      console.log("Tarjeta eliminada de Firestore:", id);
      // No necesitamos actualizar el estado local `cards` manualmente,
      // onSnapshot se encargará de ello.
      setSuccess("Tarjeta eliminada correctamente.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error al eliminar tarjeta:", error);
      setError("Error al eliminar la tarjeta. Inténtalo de nuevo.");
    } finally {
       setLoading(false);
    }
  };

  // Modificar toggleActive para operar en la colección 'cards'
  const toggleActive = async (id: string) => {
    const cardToToggle = cards.find(card => card.id === id);
    if (!cardToToggle) return;

    const newActiveState = !cardToToggle.active;
    
    try {
      setLoading(true);
      const cardRef = doc(db, 'cards', id);
      await updateDoc(cardRef, { active: newActiveState });
      console.log(`Estado 'active' de la tarjeta ${id} cambiado a ${newActiveState}`);
      // onSnapshot actualizará el estado local `cards`.
      setSuccess(`Tarjeta ${newActiveState ? 'activada' : 'desactivada'}.`);
       setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error al cambiar estado active:", error);
      setError("Error al cambiar el estado de la tarjeta.");
    } finally {
       setLoading(false);
    }
  };

  // Copiar link (sin cambios aparentes necesarios)
  const copyLinkToClipboard = (linkUrl: string | undefined) => {
    if (!linkUrl) {
        setError('Esta tarjeta aún no tiene una URL generada.');
        return;
    }
    navigator.clipboard.writeText(linkUrl)
      .then(() => {
        setSuccess('Enlace copiado al portapapeles');
        setTimeout(() => setSuccess(null), 3000);
      })
      .catch(err => {
        setError('Error al copiar el enlace');
        console.error('Error al copiar:', err);
      });
  };

  // Cerrar editor inline
  const handleCloseEditor = () => {
    console.log('[CardsManager] Estableciendo openEditorCardId a null desde handleCloseEditor');
    setOpenEditorCardId(null);
  };

  // Si hay un editor abierto, mostrarlo inline
  if (openEditorCardId) {
    return (
      <>
        <div className="dashboard-content">
          <div className="card">
            <CardEditorContainer
              cardId={openEditorCardId}
              userData={userData}
              onReturn={handleCloseEditor}
            />
          </div>
        </div>
      </>
    );
  }

  // Si el contexto aún está cargando, mostrar un mensaje
  if (loadingAuth || loadingProfile) {
      return <div className="cards-loading">Cargando información del plan...</div>;
  }

  return (
    <div className="cards-container">
      <div className="cards-header">
        <h2 className="cards-title">Administrar Tarjetas</h2>
        <p className="cards-description">Crea y administra tarjetas que podrás compartir con tus clientes.</p>
        
        {/* Botón para crear nueva tarjeta, ahora con validación */} 
        <button 
          onClick={handleCreateNewCard} 
          className="toggle-form-button" // Reutilizamos estilos si quieres
          disabled={loading || !canCreateMoreCards} // Deshabilitar si está cargando O si no puede crear más
        >
          {loading ? (
            'Creando...'
          ) : (
            'Crear Nueva Tarjeta'
          )}
        </button>
        
        {/* Mensaje opcional si se alcanza el límite */} 
        {!loading && !canCreateMoreCards && effectivePlan !== 'ADMIN' && (
           <div className="cards-alert cards-alert-error" style={{marginTop: '-0.5rem', marginBottom: '1rem'}}>
              Has alcanzado el límite de {cardLimit} tarjeta(s) para tu plan {effectivePlan}.
           </div>
        )}

      </div>
      
      {/* Mostrar mensajes de error o éxito generales */} 
      {error && <div className="cards-alert cards-alert-error">{error}</div>}
      {success && <div className="cards-alert cards-alert-success">{success}</div>}
      
      {/* Lista de tarjetas existentes */}
      <h3 className="cards-title">Tus Tarjetas ({currentCardCount}/{cardLimit === Infinity ? '∞' : cardLimit})</h3>
      {/* Ajustar mensaje de carga inicial si aún no se han cargado las tarjetas */} 
      {loading && cards.length === 0 && <div className="cards-loading">Cargando tus tarjetas...</div>}
      
      {!loading && cards.length === 0 ? (
        <p className="cards-description">No has creado ninguna tarjeta todavía.</p>
      ) : (
        <div className="cards-list">
          {cards.map(card => (
            <div key={card.id} className={`cards-item ${!card.active ? 'cards-item-inactive' : ''}`}>
              <div className="card-image-container">
                {card.imageURL ? (
                  <img src={card.imageURL} alt={card.title} className="card-image" />
                ) : (
                  <div className="card-image-placeholder"></div>
                )}
                {card.active ? (
                  <span className="card-active-badge">Activa</span>
                ) : (
                  <span className="card-inactive-badge">Inactiva</span>
                )}
              </div>
              
              <div className="card-content">
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description || 'Sin descripción'}</p>
                
                <div className="card-stats">
                  <div className="card-views">
                    <span className="card-views-icon">👁️</span> {card.views || 0} visitas
                  </div>
                  <div className="card-date">
                    {new Date(card.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="card-links-count">
                  <span className="card-link-badge">Enlaces: {card.links?.length || 0}</span>
                  <span className="card-link-badge">Productos: {card.products?.length || 0}</span>
                </div>
                
                {card.autoUrl && (
                  <div className="card-url">
                    <span className="text-truncate">{card.autoUrl}</span>
                    <button 
                      className="card-copy-button"
                      onClick={() => copyLinkToClipboard(card.autoUrl)}
                    >
                      Copiar
                    </button>
                  </div>
                )}
                
                <div className="card-actions">
                  <button 
                    className="card-button card-button-primary"
                    onClick={() => handleEdit(card)}
                  >
                    Editar
                  </button>
                  <button 
                    className="card-button"
                    onClick={() => toggleActive(card.id)}
                  >
                    {card.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button 
                    className="card-button card-button-danger"
                    onClick={() => handleDelete(card.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardsManager; 