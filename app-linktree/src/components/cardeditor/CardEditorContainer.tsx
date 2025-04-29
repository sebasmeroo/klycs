import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { FiShoppingBag, FiPlus, FiTrash2, FiArrowLeft, FiSave, FiInfo, FiLayers, FiLink, FiLoader, FiEye, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import { deleteImageFromStorage, uploadCardImage } from '../../utils/storageUtils';

// Importar componentes mejorados
import CardForm from './CardForm';
import LinksManager from './LinksManager';
import ProductSelector from './ProductSelector';
import { Card, CardLink, Product, CardBackground, CardTheme, TemplateType, BookingSettings } from './types';
import { 
  compressImage, 
  compressBackgroundImage, 
  getImagePreview, 
  type CompressionStatus 
} from '../../utils/imageCompression';
import CompressionInfo from '../common/CompressionInfo';
import BookingManager from '../booking/BookingManager';

// Importar estilos
import './CardEditor.css';

interface CardEditorContainerProps {
  cardId: string;
  userData: any;
  onReturn?: () => void;
}

// Interfaz Card sin bookingSettings, ya que vive en subcolección
interface ExtendedCard extends Omit<Card, 'backgroundType' | 'bookingSettings'> {
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
  
  // Estados para template
  const [template, setTemplate] = useState<TemplateType>('basic');
  const [storeName, setStoreName] = useState('');
  
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
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Estados para drag-to-scroll
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [startYPreview, setStartYPreview] = useState(0);
  const [scrollTopStartPreview, setScrollTopStartPreview] = useState(0);

  // Estado de sección seleccionada para navegación lateral
  const [selectedSection, setSelectedSection] = useState<'basic-info'|'background-style'|'links-section'|'products-section'|'booking-section'>('basic-info');

  // *** Nuevo estado para la configuración de reservas - inicializar con undefined ***
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | undefined>(undefined);

  // Función para abrir la vista pública de la tarjeta en nueva pestaña
  const handlePreviewClick = () => {
    const origin = window.location.origin;
    const usernameParam = userData.username || userData.uid;
    const publicUrl = `${origin}/${usernameParam}/card/${cardId}`;
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const fetchCardAndSettingsData = async () => {
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
        // 1. Cargar datos de la tarjeta principal
        const cardRef = doc(db, 'cards', cardId);
        const cardDoc = await getDoc(cardRef);

        if (!cardDoc.exists()) {
          console.log("Tarjeta no encontrada en la colección 'cards'");
          setError('Tarjeta no encontrada');
          setLoading(false);
          return;
        }

        console.log("Tarjeta principal encontrada");
        const cardData = cardDoc.data() as ExtendedCard;

        // Validar permiso
        if (cardData.userId !== auth.currentUser?.uid) {
          console.error("Error: El usuario no tiene permiso para editar esta tarjeta.");
          setError("No tienes permiso para editar esta tarjeta.");
          setLoading(false);
          return;
        }

        // 2. Cargar datos de bookingSettings desde la subcolección
        let fetchedBookingSettings: BookingSettings | undefined = undefined;
        const settingsRef = doc(db, 'cards', cardId, 'bookingSettings', 'settings');
        try {
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists()) {
            console.log("BookingSettings encontrados en subcolección");
            fetchedBookingSettings = settingsDoc.data() as BookingSettings;
          } else {
            console.warn("No se encontró documento 'settings' en la subcolección bookingSettings. Se usarán valores por defecto.");
            // Podríamos crear el documento aquí si falta por alguna razón?
            // O simplemente inicializar con valores por defecto como hacemos abajo.
          }
        } catch (settingsError: any) { // Capturar error específico de settings
           console.error("Error cargando BookingSettings desde subcolección:", settingsError);
           // No establecer error principal, pero loguear.
           // Continuar con la carga del resto de la tarjeta.
        }

        // 3. Procesar y actualizar estados locales
        processCardData(cardData, fetchedBookingSettings);

      } catch (error: any) {
        console.error('Error al acceder a Firestore para cargar tarjeta principal:', error);
        setError(`Error al cargar la tarjeta: ${error.message}`);
        setLoading(false);
      }
    };

    if (userData && cardId && auth.currentUser) {
      fetchCardAndSettingsData();
    }
  }, [cardId, userData, navigate]); // Dependencias

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

  const handleTemplateChange = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
  };

  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStoreName(e.target.value);
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
        
        // Crear preview local usando la función de utilidad
        const previewUrl = await getImagePreview(result.file);
        setImagePreview(previewUrl);
        
      } catch (error) {
        console.error('Error al comprimir imagen principal:', error);
        setMainImageCompressionStatus('error');
        
        // En caso de error, usar el archivo original
        setMainImageFile(selectedFile);
        
        // Crear preview del archivo original
        const previewUrl = await getImagePreview(selectedFile);
        setImagePreview(previewUrl);
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
        
        // Comprimir imagen de fondo utilizando la función especializada
        const result = await compressBackgroundImage(selectedFile);
        
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
        
        // Crear preview local para la imagen de fondo usando la función de utilidad
        const previewUrl = await getImagePreview(result.file);
        setBackground(prev => ({ ...prev, imageURL: previewUrl }));
        
      } catch (error) {
        console.error('Error al comprimir imagen de fondo:', error);
        setBgImageCompressionStatus('error');
        
        // En caso de error, usar el archivo original
        setBackgroundImageFile(selectedFile);
        
        // Crear preview del archivo original usando la función de utilidad
        const previewUrl = await getImagePreview(selectedFile);
        setBackground(prev => ({ ...prev, imageURL: previewUrl }));
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
      if (!auth.currentUser) throw new Error('Usuario no autenticado');
      if (!card) throw new Error('Datos de la tarjeta no cargados'); 
      const userId = auth.currentUser.uid;
      if (!userId) throw new Error('No se pudo obtener el ID del usuario');

      // 1. Subir imágenes si es necesario y obtener URLs
      let imageURL = card.imageURL || '';
      let backgroundImageURL = card.backgroundImageURL || ''; // Usar el valor actual del estado 'card' como base
      if (mainImageFile) { imageURL = await uploadCardImage(mainImageFile, userId, 'main', card.imageURL); }
      if (backgroundImageFile && background.type === 'image') { backgroundImageURL = await uploadCardImage(backgroundImageFile, userId, 'background', card.backgroundImageURL); }

      // 2. Preparar datos para el DOCUMENTO PRINCIPAL de la tarjeta
      const cardDataToUpdate: Partial<ExtendedCard> = {
        userId: userId, 
        title,
        description,
        imageURL,
        links: links || [],
        products: cardProducts || [],
        template,
        storeName,
        backgroundType: background.type,
        active: card.active, // Mantener estado active y views del estado 'card'
        views: card.views || 0,
        // NO incluimos bookingSettings aquí
      };

      // Añadir campos de fondo condicionalmente al documento principal
      if (background.type === 'color' && background.color) {
        cardDataToUpdate.backgroundColor = background.color;
        cardDataToUpdate.backgroundGradient = undefined; 
        cardDataToUpdate.backgroundImageURL = undefined;
      } else if (background.type === 'gradient' && background.gradient) {
        cardDataToUpdate.backgroundGradient = background.gradient;
        cardDataToUpdate.backgroundColor = undefined;
        cardDataToUpdate.backgroundImageURL = undefined;
      } else if (background.type === 'image') {
        cardDataToUpdate.backgroundImageURL = backgroundImageURL || background.imageURL; // Usar URL subida o la del estado 'background'
        cardDataToUpdate.backgroundColor = undefined;
        cardDataToUpdate.backgroundGradient = undefined;
      } else {
         cardDataToUpdate.backgroundColor = undefined;
         cardDataToUpdate.backgroundGradient = undefined;
         cardDataToUpdate.backgroundImageURL = undefined;
      }

      // Eliminar claves undefined del objeto principal
      Object.keys(cardDataToUpdate).forEach(keyStr => {
        const key = keyStr as keyof Partial<ExtendedCard>;
        if (cardDataToUpdate[key] === undefined) {
          delete cardDataToUpdate[key];
        }
      });

      // 3. Guardar datos del DOCUMENTO PRINCIPAL
      const cardDocRef = doc(db, 'cards', cardId);
      console.log('Actualizando documento principal de tarjeta:', cardDataToUpdate);
      await updateDoc(cardDocRef, cardDataToUpdate);
      console.log('Documento principal actualizado.');

      // 4. Guardar datos de bookingSettings en la SUBCOLECCIÓN
      if (bookingSettings !== undefined) { // Solo guardar si hay datos de settings
        const settingsRef = doc(db, 'cards', cardId, 'bookingSettings', 'settings');
        console.log('Actualizando documento de settings en subcolección:', bookingSettings);
        // Usar setDoc con merge: true es una buena práctica aquí para no sobrescribir
        // campos que no estén en nuestro objeto local si hubieran sido añadidos por otro lado.
        // O simplemente setDoc si siempre queremos sobreescribir con el estado actual.
        await setDoc(settingsRef, bookingSettings, { merge: true }); 
        console.log('Documento de settings actualizado.');
      } else {
         console.log('No hay datos de bookingSettings en el estado local para guardar.');
      }

      // 5. Actualizar estado local y feedback
      const updatedLocalCard = { 
          ...card, 
          ...cardDataToUpdate // Actualizar con los datos guardados en el doc principal
      } as ExtendedCard;
      setCard(updatedLocalCard);
      setBookingSettings(bookingSettings); // Asegurarse que el estado local de settings está sincronizado

      setMainImageFile(null);
      setBackgroundImageFile(null);
      setMainImageCompressionStatus('idle');
      setBgImageCompressionStatus('idle');
      setSuccess('Tarjeta actualizada con éxito');

    } catch (error: any) {
      console.error('Error al actualizar la tarjeta y/o settings:', error);
      setError(`Error al actualizar: ${error.message}`);
    } finally {
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

  // Construir la URL pública para el iframe
  const getPublicCardUrl = () => {
    if (!userData || !cardId) return '';
    const origin = window.location.origin;
    const usernameParam = userData.username || userData.uid;
    // Asegurarse de que no haya dobles barras
    return `${origin}/${usernameParam}/card/${cardId}`.replace(/([^:]\/)\/+/g, "$1");
  };

  const publicCardUrl = getPublicCardUrl();

  // Función para recargar el iframe cambiando la key
  const handleReloadPreview = () => {
    setIframeKey(prevKey => prevKey + 1);
  };

  // --- Manejadores para Drag-to-Scroll --- 
  const handlePreviewMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Solo activa si el clic es directamente sobre el contenedor (no el botón de recarga)
    if (e.target !== e.currentTarget) return; 
    
    const iframeContentWindow = iframeRef.current?.contentWindow;
    if (!iframeContentWindow) return;

    setIsDraggingPreview(true);
    setStartYPreview(e.pageY); // Usar pageY para coordenadas relativas al documento
    // Intentar obtener scrollTop del documento dentro del iframe
    const currentScrollTop = iframeContentWindow.document.documentElement.scrollTop || iframeContentWindow.document.body.scrollTop;
    setScrollTopStartPreview(currentScrollTop);
    e.currentTarget.style.cursor = 'grabbing'; // Cambiar cursor en el contenedor
    e.preventDefault();
  };

  const handlePreviewMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    if (isDraggingPreview) {
      setIsDraggingPreview(false);
      e.currentTarget.style.cursor = 'grab'; // Restaurar cursor
    }
  };

  const handlePreviewMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (isDraggingPreview) {
      setIsDraggingPreview(false);
      e.currentTarget.style.cursor = 'grab'; // Restaurar cursor
    }
  };

  const handlePreviewMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPreview) return;
    e.preventDefault();
    const iframeContentWindow = iframeRef.current?.contentWindow;
    if (!iframeContentWindow) return;

    const y = e.pageY;
    const walk = y - startYPreview; // Cuánto se movió el ratón
    const newScrollTop = scrollTopStartPreview - walk; // Calcular nueva posición
    
    // Intentar hacer scroll dentro del iframe
    iframeContentWindow.scrollTo(0, newScrollTop);
  };
  // --- Fin Manejadores Drag-to-Scroll ---

  // *** Nuevo handler para actualizar bookingSettings ***
  const handleBookingSettingsChange = (newSettings: BookingSettings) => {
    setBookingSettings(newSettings);
  };

  const processCardData = (cardData: ExtendedCard, initialBookingSettings?: BookingSettings) => {
    // Formatear productos si existen
    const products = (cardData.products || []).map((product: any) => {
      // Unir con la lista de productos del usuario para obtener imageURL
      const original = userData.products?.find((u: any) => u.id === product.id);
      return {
        ...product,
        price: typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0,
        imageURL: original?.imageURL || ''
      };
    });

    setCard(cardData);
    setTitle(cardData.title);
    setDescription(cardData.description || '');
    if (cardData.imageURL) {
      setImagePreview(cardData.imageURL);
    }
    
    // Configurar plantilla
    setTemplate(cardData.template || 'basic');
    setStoreName(cardData.storeName || '');
    
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
    
    // *** Inicializar el estado de bookingSettings ***
    setBookingSettings(initialBookingSettings || {
      enabled: false,
      services: [],
      availability: {},
      acceptOnlinePayments: false,
      allowProfessionalSelection: false
    });
    
    // Cargar productos del usuario
    if (auth.currentUser) {
      fetchUserProducts();
    }
    
    setLoading(false);
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
            {/* Botón para abrir la vista pública de la tarjeta */}
            <button
              type="button"
              className="preview-header-button"
              onClick={handlePreviewClick}
            >
              <FiEye /><span>Previsualizar Tarjeta</span>
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
            <li><button onClick={() => setSelectedSection('booking-section')}><FiCalendar /></button></li>
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
              <div className="card-editor-form-container">
                 {/* --- Sección Selector de Plantilla --- */}
                 <div className="form-section template-selector-section"> 
                   <h4 className="section-title"><FiLayers /> Plantilla</h4>
                   <div className="template-selector">
                     {(['basic', 'link', 'shop'] as TemplateType[]).map(t => (
                       <button 
                         key={t} 
                         type="button"
                         className={`template-btn ${template === t ? 'active' : ''}`}
                         onClick={() => handleTemplateChange(t)}
                       >
                         {t.charAt(0).toUpperCase() + t.slice(1)} {/* Capitalizar nombre */}
                       </button>
                     ))}
                   </div>
                   {/* Campo Store Name (solo visible si template es 'shop') */} 
                   {template === 'shop' && (
                     <div className="form-group mt-3"> 
                       <label htmlFor="storeName" className="form-label">Nombre de la Tienda</label>
                       <input 
                         type="text" 
                         id="storeName"
                         className="form-control" 
                         value={storeName} 
                         onChange={(e) => setStoreName(e.target.value)} 
                       />
                     </div>
                   )}
                 </div>
                 {/* --- Fin Selector Plantilla --- */}

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
              <div 
                 className="card-preview-container" 
                 style={{ cursor: isDraggingPreview ? 'grabbing' : 'grab' }} // Aplicar cursor dinámico
                 onMouseDown={handlePreviewMouseDown} 
                 onMouseLeave={handlePreviewMouseLeave}
                 onMouseUp={handlePreviewMouseUp}
                 onMouseMove={handlePreviewMouseMove}
              >
                 {/* Botón de Recarga (asegurar que no interfiera con mousedown) */}
                 <button 
                   type="button" 
                   onClick={handleReloadPreview} 
                   className="reload-preview-button" 
                   title="Recargar previsualización"
                   style={{ zIndex: 11 }} // Aumentar z-index por si acaso
                 >
                   <FiRefreshCw />
                 </button>
                 {publicCardUrl ? (
                   <iframe 
                     ref={iframeRef} // Asignar ref
                     key={iframeKey} 
                     src={publicCardUrl}
                     className="card-preview-iframe" 
                     title="Previsualización de Tarjeta Pública"
                     style={{ pointerEvents: isDraggingPreview ? 'none' : 'auto' }} // Deshabilitar eventos de ratón en iframe mientras se arrastra el contenedor
                   ></iframe>
                 ) : (
                   <div className="card-preview-placeholder">
                     <p>No se puede generar la URL de previsualización.</p>
                   </div>
                 )}
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
          {/* *** Nueva Sección para Reservas *** */}
          {selectedSection === 'booking-section' && (
            <BookingManager 
              cardId={cardId}
              initialSettings={bookingSettings} 
              onSettingsChange={handleBookingSettingsChange} 
            />
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