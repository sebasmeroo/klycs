import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { FiShoppingBag, FiPlus, FiTrash2, FiArrowLeft, FiSave, FiInfo, FiLayers, FiLink, FiLoader } from 'react-icons/fi';
import { deleteImageFromStorage } from '../../utils/storageUtils';

// Importar componentes mejorados
import CardForm from './CardForm';
import CardPreview from './CardPreview';
import LinksManager from './LinksManager';
import ProductSelector from './ProductSelector';
import { Card, CardLink, Product, CardBackground, CardTheme } from './types';
import { compressImage, CompressionStatus } from '../../utils/imageCompression';
import CompressionInfo from '../common/CompressionInfo';

// Importar estilos
import './CardEditor.css';

interface CardEditorContainerProps {
  cardId: string;
  userData: any;
  onReturn?: () => void;
}

// Extender la interfaz Card con las propiedades adicionales que necesitamos
interface ExtendedCard extends Omit<Card, 'backgroundType'> {
  backgroundType?: 'image' | 'color' | 'gradient' | 'pattern';
}

const CardEditorContainer: React.FC<CardEditorContainerProps> = ({ 
  cardId, 
  userData,
  onReturn 
}) => {
  const navigate = useNavigate();
  
  // Estados para la tarjeta
  const [card, setCard] = useState<ExtendedCard | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para almacenar las imágenes comprimidas para subir
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);

  // Estados para compresión de imágenes
  const [mainImageCompressionStatus, setMainImageCompressionStatus] = useState<CompressionStatus>('idle');
  const [mainImageCompressionData, setMainImageCompressionData] = useState<{
    originalSize?: number;
    compressedSize?: number;
    originalFormat?: string;
    compressionRatio?: number;
  }>({});
  
  const [bgImageCompressionStatus, setBgImageCompressionStatus] = useState<CompressionStatus>('idle');
  const [bgImageCompressionData, setBgImageCompressionData] = useState<{
    originalSize?: number;
    compressedSize?: number;
    originalFormat?: string;
    compressionRatio?: number;
  }>({});
  
  // Estados para fondo y tema
  const [background, setBackground] = useState<CardBackground>({ 
    type: 'color',
    color: '#ffffff'
  });
  const [theme, setTheme] = useState<CardTheme>({
    primaryColor: '#6366f1',
    secondaryColor: '#4f46e5',
    textColor: '#333333',
    linkColor: '#6366f1'
  });
  const [layout, setLayout] = useState<'standard' | 'compact' | 'featured' | 'grid' | 'custom'>('standard');
  const [animation, setAnimation] = useState<'none' | 'fade' | 'slide' | 'bounce'>('none');
  
  // Estados para los enlaces
  const [links, setLinks] = useState<CardLink[]>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Estados para productos
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [cardProducts, setCardProducts] = useState<Product[]>([]);

  // Estado de sección seleccionada para navegación lateral
  const [selectedSection, setSelectedSection] = useState<'basic-info'|'background-style'|'links-section'|'products-section'>('basic-info');

  useEffect(() => {
    const fetchCardData = async () => {
      try {
        console.log("Intentando cargar tarjeta con ID:", cardId);
        setLoading(true);
        setError(null);
        
        if (!cardId) {
          setError("ID de tarjeta no especificado");
          setLoading(false);
          return;
        }
        
        if (!auth.currentUser) {
          console.log("Usuario no autenticado, redirigiendo a login");
          navigate('/login');
          return;
        }

        try {
          // Primero buscamos en los datos del usuario que ya tenemos cargados
          if (userData && userData.cards) {
            console.log("Buscando tarjeta en datos del usuario");
            const userCards = userData.cards || [];
            const cardData = userCards.find((c: ExtendedCard) => c.id === cardId);
            
            if (cardData) {
              console.log("Tarjeta encontrada en los datos del usuario:", cardData.title);
              processCardData(cardData);
              return;
            }
          }
          
          // Si no se encuentra en userData, intentamos en la colección 'cards'
          const cardRef = doc(db, 'cards', cardId);
          const cardDoc = await getDoc(cardRef);
          
          if (cardDoc.exists()) {
            console.log("Tarjeta encontrada en colección 'cards'");
            const cardData = cardDoc.data() as ExtendedCard;
            processCardData(cardData);
          } else {
            console.log("Tarjeta no encontrada en ninguna ubicación");
            setError('Tarjeta no encontrada');
            setLoading(false);
          }
        } catch (error: any) {
          console.error('Error al acceder a Firestore:', error);
          setError(`Error al acceder a la base de datos: ${error.message}`);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error cargando datos de la tarjeta:', error);
        setError(`Error cargando datos de la tarjeta: ${error.message}`);
        setLoading(false);
      }
    };
    
    // Función auxiliar para procesar los datos de la tarjeta
    const processCardData = (cardData: ExtendedCard) => {
      // Formatear productos si existen
      const products = cardData.products?.map((product: any) => ({
        ...product,
        price: typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0
      })) || [];

      setCard(cardData);
      setTitle(cardData.title);
      setDescription(cardData.description || '');
      if (cardData.imageURL) {
        setImagePreview(cardData.imageURL);
      }
      
      // Configurar el fondo
      const cardBackground: CardBackground = {
        type: (cardData.backgroundType as 'image' | 'color' | 'gradient' | 'pattern') || 'color'
      };

      if (cardBackground.type === 'color') {
        cardBackground.color = cardData.backgroundColor || '#ffffff';
      } else if (cardBackground.type === 'gradient') {
        cardBackground.gradient = cardData.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)';
      } else if (cardBackground.type === 'image') {
        cardBackground.imageURL = cardData.backgroundImageURL || undefined;
      }

      setBackground(cardBackground);
      
      // Configurar enlaces y productos
      setLinks(cardData.links || []);
      setCardProducts(products);
      
      // Cargar productos del usuario
      if (auth.currentUser) {
        fetchUserProducts();
      }
      
      setLoading(false);
    };

    if (userData && cardId) {
      fetchCardData();
    }
  }, [cardId, userData, navigate]);

  const fetchUserProducts = async () => {
    try {
      if (!userData) return;
      
      // Obtener productos del usuario
      const products = userData.products || [];
      setUserProducts(products);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      try {
        // Actualizar estado para mostrar que la compresión está en proceso
        setMainImageCompressionStatus('compressing');
        
        // Comprimir imagen antes de guardarla
        const result = await compressImage(selectedFile);
        
        // Actualizar estado de compresión con el resultado
        setMainImageCompressionStatus(result.success ? 'success' : 'error');
        setMainImageCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        // Guardar el archivo comprimido para subirlo después
        setMainImageFile(result.file);
        
        // Crear preview local
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        }
        reader.readAsDataURL(result.file);
        
      } catch (error) {
        console.error('Error al comprimir imagen principal:', error);
        setMainImageCompressionStatus('error');
        
        // En caso de error, usar el archivo original
        setMainImageFile(selectedFile);
        
        // Crear preview del archivo original
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        }
        reader.readAsDataURL(selectedFile);
      }
    }
  };

  const handleBackgroundTypeChange = (type: 'image' | 'color' | 'gradient') => {
    setBackground(prev => ({ ...prev, type }));
  };

  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackground(prev => ({ ...prev, color: e.target.value }));
  };

  const handleBackgroundGradientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBackground(prev => ({ ...prev, gradient: e.target.value }));
  };

  const handleBackgroundFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      try {
        // Actualizar estado para mostrar que la compresión está en proceso
        setBgImageCompressionStatus('compressing');
        
        // Comprimir imagen de fondo antes de guardarla
        const result = await compressImage(selectedFile, {
          maxSizeMB: 1.0,  // Permitir que las imágenes de fondo sean un poco más grandes
          maxWidthOrHeight: 1920
        });
        
        // Actualizar estado de compresión con el resultado
        setBgImageCompressionStatus(result.success ? 'success' : 'error');
        setBgImageCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        // Guardar el archivo comprimido para subirlo después
        setBackgroundImageFile(result.file);
        
        // Crear preview local para la imagen de fondo
        const reader = new FileReader();
        reader.onloadend = () => {
          setBackground(prev => ({ ...prev, imageURL: reader.result as string }));
        }
        reader.readAsDataURL(result.file);
        
      } catch (error) {
        console.error('Error al comprimir imagen de fondo:', error);
        setBgImageCompressionStatus('error');
        
        // En caso de error, usar el archivo original
        setBackgroundImageFile(selectedFile);
        
        // Crear preview del archivo original
        const reader = new FileReader();
        reader.onloadend = () => {
          setBackground(prev => ({ ...prev, imageURL: reader.result as string }));
        }
        reader.readAsDataURL(selectedFile);
      }
    }
  };

  const handleThemeChange = (newTheme: Partial<CardTheme>) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const handleLayoutChange = (newLayout: string) => {
    setLayout(newLayout as 'standard' | 'compact' | 'featured' | 'grid' | 'custom');
  };

  const handleAnimationChange = (newAnimation: string) => {
    setAnimation(newAnimation as 'none' | 'fade' | 'slide' | 'bounce');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      if (!card) {
        throw new Error('Tarjeta no encontrada');
      }

      // Variables para las URLs de las imágenes
      let imageURL = card.imageURL || '';
      let backgroundImageURL = card.backgroundImageURL || '';

      // 1. Subir la imagen principal si hay una nueva
      if (mainImageFile) {
        try {
          // Eliminar la imagen antigua si existe antes de subir la nueva
          if (card.imageURL) {
            const deleted = await deleteImageFromStorage(card.imageURL);
            if (deleted) {
              console.log('Imagen principal antigua eliminada');
            }
          }
          
          // Generar un solo UUID para la ruta
          const mainImageId = uuidv4();
          const mainImagePath = `cards/${userData.uid}/${mainImageId}`;
          
          console.log('Subiendo imagen principal a:', mainImagePath);
          const mainImageRef = ref(storage, mainImagePath);
          
          // Subir la imagen comprimida
          await uploadBytes(mainImageRef, mainImageFile);
          
          // Obtener la URL de la imagen subida
          imageURL = await getDownloadURL(mainImageRef);
          console.log('Imagen principal subida con éxito:', imageURL);
        } catch (uploadError: any) {
          console.error('Error al subir imagen principal:', uploadError);
          // Error más descriptivo
          const errorMessage = uploadError.code === 'storage/unauthorized' 
            ? 'No tienes permisos para subir esta imagen. Contacta con el administrador.'
            : 'Error al subir la imagen principal. Inténtalo de nuevo.';
          throw new Error(errorMessage);
        }
      }

      // 2. Subir la imagen de fondo si hay una nueva y el tipo de fondo es 'image'
      if (backgroundImageFile && background.type === 'image') {
        try {
          // Eliminar la imagen de fondo antigua si existe
          if (card.backgroundImageURL) {
            const deleted = await deleteImageFromStorage(card.backgroundImageURL);
            if (deleted) {
              console.log('Imagen de fondo antigua eliminada');
            }
          }
          
          // Generar un solo UUID para la ruta
          const bgImageId = uuidv4();
          const bgImagePath = `cards/${userData.uid}/${bgImageId}`;
          
          console.log('Subiendo imagen de fondo a:', bgImagePath);
          const bgImageRef = ref(storage, bgImagePath);
          
          // Subir la imagen comprimida
          await uploadBytes(bgImageRef, backgroundImageFile);
          
          // Obtener la URL de la imagen de fondo subida
          backgroundImageURL = await getDownloadURL(bgImageRef);
          console.log('Imagen de fondo subida con éxito:', backgroundImageURL);
        } catch (uploadError: any) {
          console.error('Error al subir imagen de fondo:', uploadError);
          // Error más descriptivo
          const errorMessage = uploadError.code === 'storage/unauthorized' 
            ? 'No tienes permisos para subir esta imagen de fondo. Contacta con el administrador.'
            : 'Error al subir la imagen de fondo. Inténtalo de nuevo.';
          throw new Error(errorMessage);
        }
      }

      // Crear objeto con los datos actualizados
      const updatedCardData: Partial<ExtendedCard> = {
        title,
        description,
        // Asignar URL de imagen principal si existe
        imageURL,
        // Convertir el nuevo formato de fondo al formato esperado por la DB
        backgroundType: background.type,
        links: links || [],
        products: cardProducts || []
      };

      // Añadir propiedades condicionales según el tipo de fondo
      if (background.type === 'color' && background.color) {
        updatedCardData.backgroundColor = background.color;
      }
      
      if (background.type === 'gradient' && background.gradient) {
        updatedCardData.backgroundGradient = background.gradient;
      }
      
      if (background.type === 'image') {
        updatedCardData.backgroundImageURL = backgroundImageURL || background.imageURL;
      }

      // Priorizar la actualización en el documento del usuario
      if (userData && userData.cards) {
        // Asegurarnos que todos los campos estén presentes
        const updatedCard = {
          ...card,
          ...updatedCardData,
          // Asegurar que estos campos siempre estén presentes
          id: cardId,
          createdAt: card.createdAt || Date.now(),
          active: typeof card.active !== 'undefined' ? card.active : true,
          views: card.views || 0
        };
        
        // Crear una copia completa de userData.cards para evitar problemas de referencia
        const cardsCopy = JSON.parse(JSON.stringify(userData.cards));
        
        // Buscar el índice de la tarjeta
        const cardIndex = cardsCopy.findIndex((c: any) => c.id === cardId);
        
        // Actualizar las tarjetas en userData
        let updatedUserCards;
        if (cardIndex !== -1) {
          // Reemplazar la tarjeta existente
          updatedUserCards = [...cardsCopy];
          updatedUserCards[cardIndex] = updatedCard;
        } else {
          // Añadir la tarjeta si no existe
          updatedUserCards = [...cardsCopy, updatedCard];
        }
        
        // Actualizar las tarjetas en el documento del usuario en Firestore
        const userRef = doc(db, 'users', auth.currentUser.uid);
        console.log('Actualizando tarjeta en documento de usuario. ID:', cardId);
        
        try {
          await updateDoc(userRef, { cards: updatedUserCards });
          console.log('Tarjeta actualizada correctamente en el documento del usuario');
          
          // Actualizar el estado local con la tarjeta actualizada
          setCard(updatedCard as ExtendedCard);
          
          // Si hemos subido imágenes exitosamente, limpiar los archivos temporales
          setMainImageFile(null);
          setBackgroundImageFile(null);
          
          // Resetear estados de compresión
          setMainImageCompressionStatus('idle');
          setBgImageCompressionStatus('idle');
        } catch (updateError: any) {
          console.error('Error al actualizar la tarjeta en Firestore:', updateError);
          setError(`Error al guardar: ${updateError.message}`);
          setLoading(false);
          return;
        }
      } else {
        throw new Error('No se pueden encontrar las tarjetas del usuario');
      }
      
      setSuccess('Tarjeta actualizada con éxito');
      setLoading(false);
      
      // No cerrar automáticamente: el usuario permanece para ver confirmación
      
    } catch (error: any) {
      console.error('Error al actualizar la tarjeta:', error);
      setError(`Error al actualizar la tarjeta: ${error.message}`);
      setLoading(false);
    }
  };

  const openAddLinkForm = () => {
    setEditingLinkId(null);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkForm(true);
  };

  const handleEditLink = (link: CardLink) => {
    setEditingLinkId(link.id);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setShowLinkForm(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingLinkId) {
      // Actualizar enlace existente
      const updatedLinks = links.map(link => 
        link.id === editingLinkId
          ? { ...link, title: linkTitle, url: linkUrl }
          : link
      );
      setLinks(updatedLinks);
    } else {
      // Crear nuevo enlace
      const newLink: CardLink = {
        id: uuidv4(),
        title: linkTitle,
        url: linkUrl,
        active: true
      };
      setLinks([...links, newLink]);
    }
    
    // Limpiar formulario
    setLinkTitle('');
    setLinkUrl('');
    setEditingLinkId(null);
    setShowLinkForm(false);
  };

  const handleDeleteLink = (linkId: string) => {
    const updatedLinks = links.filter(link => link.id !== linkId);
    setLinks(updatedLinks);
  };

  const toggleLinkActive = (linkId: string) => {
    const updatedLinks = links.map(link => 
      link.id === linkId ? { ...link, active: !link.active } : link
    );
    setLinks(updatedLinks);
  };

  const cancelLinkEdit = () => {
    setLinkTitle('');
    setLinkUrl('');
    setEditingLinkId(null);
    setShowLinkForm(false);
  };

  const toggleProductSelectorVisibility = () => {
    setShowProductSelector(!showProductSelector);
  };

  const handleAddProductToCard = (product: Product) => {
    // Verificar si el producto ya está en la tarjeta
    if (!cardProducts || !Array.isArray(cardProducts)) {
      // Si cardProducts no es un array, inicializarlo
      setCardProducts([product]);
      console.log('Producto añadido a productos inicializados:', product);
    } else if (!cardProducts.some(p => p.id === product.id)) {
      // Si el producto no está en la lista, añadirlo
      const updatedProducts = [...cardProducts, product];
      setCardProducts(updatedProducts);
      console.log('Producto añadido a la tarjeta:', product, 'Lista actualizada:', updatedProducts);
    } else {
      console.log('El producto ya está en la tarjeta:', product);
    }
  };

  const handleRemoveProductFromCard = (productId: string) => {
    if (cardProducts && Array.isArray(cardProducts)) {
      const updatedProducts = cardProducts.filter(product => product.id !== productId);
      setCardProducts(updatedProducts);
      console.log('Producto eliminado de la tarjeta:', productId, 'Lista actualizada:', updatedProducts);
    }
  };

  // Si está cargando, mostrar indicador
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p>Cargando datos de la tarjeta...</p>
      </div>
    );
  }

  // Si hay error y no hay tarjeta, mostrar mensaje
  if (error && !card) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="card-editor-container">
      {/* Notificación fija de éxito */}
      {success && !loading && (
        <div className="notification success-notification">
          {success}
        </div>
      )}
      <div className="card-editor-header">
        {onReturn && (
          <div className="header-actions">
            <div className="back-link" onClick={onReturn}>
              <FiArrowLeft />
              <span className="back-text">Volver a tarjetas</span>
            </div>
            <button
              type="button"
              className="save-header-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <><FiLoader className="spin-icon" /><span>Guardando...</span></>
              ) : (
                <><FiSave /><span>Guardar Cambios</span></>
              )}
            </button>
          </div>
        )}
      </div>
      {/* Navegación lateral */}
      <div className="editor-main">
        <aside className="editor-sidebar">
          <ul>
            <li><button onClick={() => setSelectedSection('basic-info')}><FiInfo /></button></li>
            <li><button onClick={() => setSelectedSection('background-style')}><FiLayers /></button></li>
            <li><button onClick={() => setSelectedSection('links-section')}><FiLink /></button></li>
            <li><button onClick={() => setSelectedSection('products-section')}><FiShoppingBag /></button></li>
          </ul>
        </aside>
        <div className={`editor-content selected-${selectedSection}`}>
          {/* Mensaje de error */}
          {error && (
            <div className="alert alert-error mb-4">
              {error}
            </div>
          )}
          {/* Sección de formulario básica y fondo */}
          {(selectedSection === 'basic-info' || selectedSection === 'background-style') && (
            <div className="card-editor-content">
              <div className="card-editor-form-container selected-${selectedSection}">
                <CardForm 
                  title={title}
                  description={description}
                  backgroundType={background.type === 'pattern' ? 'color' : background.type}
                  backgroundColor={background.color || '#ffffff'}
                  backgroundGradient={background.gradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)'}
                  handleTitleChange={handleTitleChange}
                  handleDescriptionChange={handleDescriptionChange}
                  handleFileChange={handleFileChange}
                  handleSubmit={handleSubmit}
                  handleBackgroundTypeChange={handleBackgroundTypeChange}
                  handleBackgroundColorChange={handleBackgroundColorChange}
                  handleBackgroundGradientChange={handleBackgroundGradientChange}
                  handleBackgroundFileChange={handleBackgroundFileChange}
                />
                
                {/* Información de compresión para imagen principal */}
                {mainImageCompressionStatus !== 'idle' && (
                  <div className="compression-info-container">
                    <CompressionInfo 
                      status={mainImageCompressionStatus}
                      originalSize={mainImageCompressionData.originalSize}
                      compressedSize={mainImageCompressionData.compressedSize}
                      originalFormat={mainImageCompressionData.originalFormat}
                      compressionRatio={mainImageCompressionData.compressionRatio}
                      showDetails={true}
                    />
                  </div>
                )}
                
                {/* Información de compresión para imagen de fondo */}
                {bgImageCompressionStatus !== 'idle' && background.type === 'image' && (
                  <div className="compression-info-container">
                    <CompressionInfo 
                      status={bgImageCompressionStatus}
                      originalSize={bgImageCompressionData.originalSize}
                      compressedSize={bgImageCompressionData.compressedSize}
                      originalFormat={bgImageCompressionData.originalFormat}
                      compressionRatio={bgImageCompressionData.compressionRatio}
                      showDetails={true}
                    />
                  </div>
                )}
              </div>
              <div className="card-preview-container">
                <div 
                  className="card-preview" 
                  style={
                    background.type === 'color' 
                      ? { backgroundColor: background.color }
                      : background.type === 'gradient' 
                        ? { background: background.gradient }
                        : background.type === 'image' && background.imageURL
                          ? { 
                              backgroundImage: `url(${background.imageURL})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat'
                            }
                          : {}
                  }
                >
                  {imagePreview && (
                    <div className="preview-image-container">
                      <img src={imagePreview} alt={title} className="preview-main-image" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Sección de enlaces */}
          {selectedSection === 'links-section' && (
            <LinksManager 
              links={links}
              linkTitle={linkTitle}
              linkUrl={linkUrl}
              editingLinkId={editingLinkId}
              showLinkForm={showLinkForm}
              setLinkTitle={setLinkTitle}
              setLinkUrl={setLinkUrl}
              openAddLinkForm={openAddLinkForm}
              handleSaveLink={handleSaveLink}
              handleEditLink={handleEditLink}
              handleDeleteLink={handleDeleteLink}
              toggleLinkActive={toggleLinkActive}
              cancelLinkEdit={cancelLinkEdit}
            />
          )}
          {/* Sección de productos */}
          {selectedSection === 'products-section' && (
            <div className="products-section">
              <div className="section-header">
                <h3 className="section-title">
                  <FiShoppingBag /> 
                  Productos
                </h3>
                <button
                  type="button"
                  className="add-button"
                  onClick={toggleProductSelectorVisibility}
                >
                  <FiPlus /> Añadir productos
                </button>
              </div>
              
              {/* Lista de productos en la tarjeta */}
              {cardProducts.length > 0 ? (
                <div className="selected-products">
                  <div className="selected-products-grid">
                    {cardProducts.map(product => (
                      <div key={product.id} className="selected-product-card">
                        {product.imageURL && (
                          <div className="selected-product-image">
                            <img 
                              src={product.imageURL} 
                              alt={product.title} 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Sin+imagen';
                              }}
                            />
                          </div>
                        )}
                        <div className="selected-product-info">
                          <h4 className="selected-product-title">{product.title}</h4>
                          <p className="selected-product-price">{product.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                        </div>
                        <div className="selected-product-actions">
                          <button
                            type="button"
                            className="remove-selected-product"
                            onClick={() => handleRemoveProductFromCard(product.id)}
                            title="Eliminar producto"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-selected-products">
                  <p>No has seleccionado ningún producto para esta tarjeta.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Selector de productos (modal) */}
      {showProductSelector && (
        <ProductSelector 
          userProducts={userProducts}
          cardProducts={cardProducts}
          handleAddProductToCard={handleAddProductToCard}
          handleRemoveProductFromCard={handleRemoveProductFromCard}
          toggleProductSelector={toggleProductSelectorVisibility}
        />
      )}
    </div>
  );
};

export default CardEditorContainer; 