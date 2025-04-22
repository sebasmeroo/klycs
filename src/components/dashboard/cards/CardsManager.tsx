import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import './Cards.css';
import { useNavigate } from 'react-router-dom';
import CardEditorContainer from '../../cardeditor/CardEditorContainer';
import '../../cardeditor/CardEditor.css';
import { compressImage, CompressionStatus } from '../../../utils/imageCompression';
import CompressionInfo from '../../common/CompressionInfo';
import { deleteImageFromStorage } from '../../../utils/storageUtils';

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
  backgroundType?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
}

interface CardsManagerProps {
  userData: any;
}

const CardsManager: React.FC<CardsManagerProps> = ({ userData }) => {
  const navigate = useNavigate();
  const [openEditorCardId, setOpenEditorCardId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoGenerateLinks, setAutoGenerateLinks] = useState(true);
  const [showCardForm, setShowCardForm] = useState(false);
  
  // Estados para el formulario de enlaces
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Estado para la gestión de productos
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [currentCardForProduct, setCurrentCardForProduct] = useState<string | null>(null);
  
  // Estado para compresión de imagen
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>('idle');
  const [compressionData, setCompressionData] = useState<{
    originalSize?: number;
    compressedSize?: number;
    originalFormat?: string;
    compressionRatio?: number;
  }>({});
  
  // Cargar tarjetas existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.cards) {
      // Asegurarse de que todas las tarjetas tengan el array de productos
      const updatedCards = userData.cards.map((card: any) => ({
        ...card,
        products: card.products || []
      }));
      
      setCards(updatedCards);
      
      // Actualizar en Firestore solo si hay cambios
      if (JSON.stringify(updatedCards) !== JSON.stringify(userData.cards)) {
        saveCardsToFirestore(updatedCards);
      }
    } else if (userData) {
      // Si el usuario no tiene tarjetas, inicializar con un array vacío
      updateDoc(doc(db, 'users', userData.uid), { cards: [] })
        .catch(err => console.error("Error al inicializar cards:", err));
    }
  }, [userData]);

  // Persistir editor inline abierto al recargar
  useEffect(() => {
    const saved = localStorage.getItem('openEditorCardId');
    if (saved) {
      setOpenEditorCardId(saved);
    }
  }, []);

  useEffect(() => {
    if (openEditorCardId) {
      localStorage.setItem('openEditorCardId', openEditorCardId);
    } else {
      localStorage.removeItem('openEditorCardId');
    }
  }, [openEditorCardId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      try {
        // Actualizar estado para mostrar que la compresión está en proceso
        setCompressionStatus('compressing');
        
        // Comprimir imagen antes de usarla
        const compressionResult = await compressImage(selectedFile);
        
        // Actualizar estado con resultado de compresión
        setCompressionStatus(compressionResult.success ? 'success' : 'error');
        setCompressionData({
          originalSize: compressionResult.originalSize,
          compressedSize: compressionResult.compressedSize,
          originalFormat: compressionResult.originalFormat,
          compressionRatio: compressionResult.compressionRatio
        });
        
        // Usar el archivo comprimido
        setFile(compressionResult.file);
        
        // Crear preview local
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        }
        reader.readAsDataURL(compressionResult.file);
        
      } catch (error) {
        console.error('Error al comprimir imagen:', error);
        setCompressionStatus('error');
        
        // Usar el archivo original si falla la compresión
        setFile(selectedFile);
        
        // Crear preview del archivo original
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        }
        reader.readAsDataURL(selectedFile);
      }
    } else {
      setFile(null);
      setImagePreview(null);
      setCompressionStatus('idle');
    }
  };

  // Función para generar una URL automática
  const generateAutoUrl = (title: string, username: string) => {
    // Asegurar que title y username sean strings válidos
    const safeTitle = title || 'card';
    const safeUsername = username || 'usuario';
    
    const slug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    // Usar el dominio de Firebase Hosting en lugar de window.location.origin
    const firebaseHostingDomain = 'https://klycs-58190.firebaseapp.com';
    
    // Generar un timestamp único
    const timestamp = Date.now().toString(36);
    
    return `${firebaseHostingDomain}/${safeUsername}/card/${slug}-${timestamp}`;
  };

  // Guardar tarjetas en Firestore
  const saveCardsToFirestore = async (updatedCards: Card[]) => {
    if (!userData || !userData.uid) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      await updateDoc(userDocRef, { cards: updatedCards });
      setSuccess('Tarjetas guardadas correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error al guardar tarjetas:', error);
      setError('Error al guardar cambios. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Añadir o actualizar tarjeta
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Debes proporcionar un título para la tarjeta');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let imageURL = '';
      const autoUrl = generateAutoUrl(title, userData.username || userData.uid);
      
      // Si hay un archivo nuevo, subirlo a Storage
      if (file) {
        // Si estamos editando una tarjeta existente, eliminar la imagen antigua
        if (editingId) {
          const currentCard = cards.find(c => c.id === editingId);
          if (currentCard?.imageURL) {
            // Eliminar la imagen antigua
            await deleteImageFromStorage(currentCard.imageURL);
            console.log('Imagen antigua de tarjeta eliminada');
          }
        }
        
        // La compresión ya se hizo en handleFileChange
        const storageRef = ref(storage, `cards/${userData.uid}/${uuidv4()}`);
        await uploadBytes(storageRef, file);
        imageURL = await getDownloadURL(storageRef);
      } else if (editingId) {
        // Mantener la imagen actual si es una edición
        const currentCard = cards.find(c => c.id === editingId);
        imageURL = currentCard?.imageURL || '';
      }
      
      let updatedCards = [...cards];
      
      if (editingId) {
        // Actualizar tarjeta existente
        updatedCards = updatedCards.map(card => 
          card.id === editingId ? { 
            ...card, 
            title, 
            description,
            imageURL: imageURL || card.imageURL,
            autoUrl
          } : card
        );
        setEditingId(null);
      } else {
        // Añadir nueva tarjeta
        const newCard: Card = {
          id: uuidv4(),
          title,
          description,
          imageURL,
          links: [],
          products: [],
          autoUrl,
          active: true,
          views: 0,
          createdAt: Date.now()
        };
        updatedCards = [...updatedCards, newCard];
      }
      
      setCards(updatedCards);
      await saveCardsToFirestore(updatedCards);
      
      // Limpiar formulario
      setTitle('');
      setDescription('');
      setFile(null);
      setImagePreview(null);
      
      setSuccess('Tarjeta guardada correctamente');
    } catch (error: any) {
      console.error('Error al guardar tarjeta:', error);
      setError('Error al guardar la tarjeta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
      // Resetear el estado de compresión después de guardar
      setCompressionStatus('idle');
    }
  };

  // Editar tarjeta - abrir editor inline
  const handleEdit = (card: Card) => {
    setOpenEditorCardId(card.id);
  };

  // Eliminar tarjeta - también eliminar las imágenes asociadas
  const handleDelete = (id: string) => {
    // Encontrar la tarjeta para eliminar sus imágenes
    const cardToDelete = cards.find(card => card.id === id);
    
    // Eliminar la imagen principal si existe
    if (cardToDelete?.imageURL) {
      deleteImageFromStorage(cardToDelete.imageURL)
        .then(success => {
          if (success) console.log('Imagen principal de tarjeta eliminada');
        });
    }
    
    // Eliminar la imagen de fondo si existe
    if (cardToDelete?.backgroundImageURL) {
      deleteImageFromStorage(cardToDelete.backgroundImageURL)
        .then(success => {
          if (success) console.log('Imagen de fondo de tarjeta eliminada');
        });
    }
    
    const updatedCards = cards.filter(card => card.id !== id);
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
  };

  // Alternar estado activo de la tarjeta
  const toggleActive = (id: string) => {
    const updatedCards = cards.map(card => 
      card.id === id ? { ...card, active: !card.active } : card
    );
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
  };

  // Abrir formulario para añadir un enlace a una tarjeta
  const openAddLinkForm = (cardId: string) => {
    setEditingCardId(cardId);
    setLinkTitle('');
    setLinkUrl('');
    setEditingLinkId(null);
    setShowLinkForm(true);
  };

  // Editar un enlace existente
  const handleEditLink = (cardId: string, link: CardLink) => {
    setEditingCardId(cardId);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setEditingLinkId(link.id);
    setShowLinkForm(true);
  };

  // Guardar enlace (nuevo o editado)
  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkTitle.trim()) {
      setError('Debes proporcionar un título para el enlace');
      return;
    }
    
    if (!linkUrl.trim()) {
      setError('Debes proporcionar una URL para el enlace');
      return;
    }
    
    // Validar URL y añadir http:// si no lo tiene
    let formattedUrl = linkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    // Encontrar la tarjeta que estamos editando
    const updatedCards = cards.map(card => {
      if (card.id === editingCardId) {
        let updatedLinks = [...card.links];
        
        if (editingLinkId) {
          // Actualizar enlace existente
          updatedLinks = updatedLinks.map(link => 
            link.id === editingLinkId ? { 
              ...link, 
              title: linkTitle, 
              url: formattedUrl
            } : link
          );
        } else {
          // Añadir nuevo enlace
          const newLink: CardLink = {
            id: uuidv4(),
            title: linkTitle,
            url: formattedUrl,
            active: true
          };
          updatedLinks = [...updatedLinks, newLink];
        }
        
        return { ...card, links: updatedLinks };
      }
      return card;
    });
    
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
    
    // Limpiar formulario
    setLinkTitle('');
    setLinkUrl('');
    setEditingCardId(null);
    setEditingLinkId(null);
    setShowLinkForm(false);
    
    setSuccess('Enlace guardado correctamente');
  };

  // Eliminar enlace de una tarjeta
  const handleDeleteLink = (cardId: string, linkId: string) => {
    const updatedCards = cards.map(card => {
      if (card.id === cardId) {
        const updatedLinks = card.links.filter(link => link.id !== linkId);
        return { ...card, links: updatedLinks };
      }
      return card;
    });
    
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
  };

  // Alternar estado activo de un enlace
  const toggleLinkActive = (cardId: string, linkId: string) => {
    const updatedCards = cards.map(card => {
      if (card.id === cardId) {
        const updatedLinks = card.links.map(link => 
          link.id === linkId ? { ...link, active: !link.active } : link
        );
        return { ...card, links: updatedLinks };
      }
      return card;
    });
    
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
  };

  // Funciones para manejo de productos
  const openProductSelector = (cardId: string) => {
    setCurrentCardForProduct(cardId);
    setShowProductSelector(true);
  };

  // Agregar un producto a la tarjeta
  const handleAddProductToCard = (cardId: string, product: Product) => {
    const updatedCards = cards.map(card => {
      if (card.id === cardId) {
        // Verificar si el producto ya está en la tarjeta
        const productExists = card.products.some(p => p.id === product.id);
        if (productExists) {
          return card; // No agregar duplicados
        }
        
        return {
          ...card,
          products: [...card.products, product]
        };
      }
      return card;
    });
    
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
    setSuccess('Producto agregado a la tarjeta');
  };

  // Eliminar un producto de la tarjeta
  const handleRemoveProductFromCard = (cardId: string, productId: string) => {
    const updatedCards = cards.map(card => {
      if (card.id === cardId) {
        return {
          ...card,
          products: card.products.filter(p => p.id !== productId)
        };
      }
      return card;
    });
    
    setCards(updatedCards);
    saveCardsToFirestore(updatedCards);
    setSuccess('Producto eliminado de la tarjeta');
  };

  // Copiar enlace al portapapeles
  const copyLinkToClipboard = (linkUrl: string) => {
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

  // Función para alternar la visibilidad del formulario
  const toggleCardForm = () => {
    setShowCardForm(!showCardForm);
    // Si estamos ocultando el formulario, resetear los campos
    if (showCardForm) {
      setTitle('');
      setDescription('');
      setFile(null);
      setImagePreview(null);
      setEditingId(null);
    }
  };

  // Cerrar editor inline
  const handleCloseEditor = () => {
    setOpenEditorCardId(null);
    // Limpiar persistencia al cerrar
    localStorage.removeItem('openEditorCardId');
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

  return (
    <div className="cards-container">
      <div className="cards-header">
        <h2 className="cards-title">Administrar Tarjetas</h2>
        <p className="cards-description">Crea y administra tarjetas que podrás compartir con tus clientes.</p>
        
        {/* Botón para mostrar/ocultar el formulario */}
        <button 
          onClick={toggleCardForm} 
          className="toggle-form-button"
        >
          {showCardForm ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
              Ocultar Formulario
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              Crear Nueva Tarjeta
            </>
          )}
        </button>
      </div>
      
      {/* Mostrar mensajes de error o éxito */}
      {error && <div className="cards-alert cards-alert-error">{error}</div>}
      {success && <div className="cards-alert cards-alert-success">{success}</div>}
      
      {/* Formulario para crear/editar tarjetas - ahora con animación */}
      <div className={`card-form ${!showCardForm ? 'card-form-hidden' : ''}`}>
        <h3 className="card-form-title">
          {editingId ? 'Editar Tarjeta' : 'Crear Nueva Tarjeta'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="card-form-group">
            <label htmlFor="title" className="card-form-label">Título</label>
            <input
              type="text"
              id="title"
              className="card-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la tarjeta"
              required
            />
          </div>
          
          <div className="card-form-group">
            <label htmlFor="description" className="card-form-label">Descripción</label>
            <textarea
              id="description"
              className="card-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la tarjeta"
              rows={3}
            />
          </div>
          
          <div className="card-form-group">
            <label htmlFor="image" className="card-form-label">Imagen de la tarjeta</label>
            <input 
              type="file" 
              id="image" 
              name="image" 
              accept="image/*" 
              onChange={handleFileChange} 
              className="card-form-file-input"
            />
            {imagePreview && (
              <div>
                <img src={imagePreview} alt="Vista previa" className="card-form-image-preview" />
              </div>
            )}
            <CompressionInfo 
              status={compressionStatus}
              originalSize={compressionData.originalSize}
              compressedSize={compressionData.compressedSize}
              originalFormat={compressionData.originalFormat}
              compressionRatio={compressionData.compressionRatio}
            />
          </div>
          
          <button 
            type="submit" 
            className="card-form-submit"
            disabled={loading}
          >
            {loading ? 'Guardando...' : editingId ? 'Actualizar Tarjeta' : 'Crear Tarjeta'}
          </button>
        </form>
      </div>
      
      {/* Lista de tarjetas existentes */}
      <h3 className="cards-title">Tus Tarjetas</h3>
      {loading && <div className="cards-loading">Cargando...</div>}
      
      {cards.length === 0 ? (
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
                      onClick={() => copyLinkToClipboard(card.autoUrl || '')}
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