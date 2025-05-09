import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, orderBy, QueryDocumentSnapshot, DocumentData, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { FiShoppingBag, FiPlus, FiTrash2, FiArrowLeft, FiSave, FiInfo, FiLayers, FiLink, FiLoader, FiEye, FiRefreshCw, FiCalendar, FiMove, FiFilm } from 'react-icons/fi';
import { deleteImageFromStorage, uploadCardImage } from '../../utils/storageUtils';
import { getIdTokenResult } from 'firebase/auth';

// Importar TODOS los tipos necesarios desde types.ts
import { Card, CardLink, Product, CardBackground, CardTheme, TemplateType, BookingSettings, CardSectionType, CARD_SECTION_TYPES, Professional, CoverMediaItem } from './types';

// Importar componentes mejorados
import CardForm from './CardForm';
import LinksManager from './LinksManager';
import ProductSelector from './ProductSelector';
import { 
  compressImage, 
  compressBackgroundImage, 
  getImagePreview, 
  type CompressionStatus 
} from '../../utils/imageCompression';
import CompressionInfo from '../common/CompressionInfo';
import BookingManager from '../booking/BookingManager';
import SectionOrderEditor from './subcomponents/SectionOrderEditor';
import CardVisualsEditor from './subcomponents/CardVisualsEditor';
import CardProductsEditor from './subcomponents/CardProductsEditor';
import TemplateSelector from './subcomponents/TemplateSelector';
import CardPreviewPane from './subcomponents/CardPreviewPane';
import CoverSliderEditor from './subcomponents/CoverSliderEditor';

// Importar estilos
import './CardEditor.css';

// Asumimos o definimos un tipo para las secciones del editor si no existe
// Si ya existe un tipo como EditorSectionType, lo modificaremos.
// Si no, lo creamos:
type EditorSectionType = 
  | 'basic-info' 
  | 'background-style' 
  | 'links-section' 
  | 'products-section' 
  | 'booking-section' 
  | 'layout-section'
  | 'coverSlider-editor';

interface CardEditorContainerProps {
  cardId: string;
  userData: any;
  onReturn?: () => void;
}

// Definir un orden por defecto para las secciones
const DEFAULT_SECTION_ORDER: CardSectionType[] = ['userProfileInfo', 'header', 'image', 'description', 'links', 'products', 'booking'];

const CardEditorContainer: React.FC<CardEditorContainerProps> = ({ 
  cardId, 
  userData,
  onReturn 
}) => {
  const navigate = useNavigate();
  
  // --- Estados Principales --- 
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // --- Estados de la Tarjeta (se inicializan en processCardData) --- 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Preview local
  const [mainImageFile, setMainImageFile] = useState<File | null>(null); // Archivo para subir
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null); // Archivo para subir
  const [background, setBackground] = useState<CardBackground>({ type: 'color', color: '#ffffff' });
  const [theme, setTheme] = useState<CardTheme>({ primaryColor: '#6366f1', secondaryColor: '#4f46e5', textColor: '#333333', linkColor: '#6366f1' });
  const [template, setTemplate] = useState<TemplateType>('basic');
  const [storeName, setStoreName] = useState('');
  const [links, setLinks] = useState<CardLink[]>([]); // Estado principal de los enlaces
  const [cardProducts, setCardProducts] = useState<Product[]>([]); // Productos de la tarjeta actual
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | undefined>(undefined);
  const [sectionOrder, setSectionOrder] = useState<CardSectionType[]>(DEFAULT_SECTION_ORDER);
  const [userProducts, setUserProducts] = useState<Product[]>([]); // Productos disponibles del usuario
  const [coverMediaItems, setCoverMediaItems] = useState<CoverMediaItem[]>([]); // <-- RESTAURAR ESTADO

  // --- Estados del Editor UI --- 
  const [selectedSection, setSelectedSection] = useState<EditorSectionType>('basic-info');
  const [layout, setLayout] = useState<'standard' | 'compact' | 'featured' | 'grid' | 'custom'>('standard');
  const [animation, setAnimation] = useState<'none' | 'fade' | 'slide' | 'bounce'>('none');
  const [mainImageCompressionStatus, setMainImageCompressionStatus] = useState<CompressionStatus>('idle');
  const [mainImageCompressionData, setMainImageCompressionData] = useState<{ originalSize?: number; compressedSize?: number; originalFormat?: string; compressionRatio?: number }>({});
  const [bgImageCompressionStatus, setBgImageCompressionStatus] = useState<CompressionStatus>('idle');
  const [bgImageCompressionData, setBgImageCompressionData] = useState<{ originalSize?: number; compressedSize?: number; originalFormat?: string; compressionRatio?: number }>({});
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [startYPreview, setStartYPreview] = useState(0);
  const [scrollTopStartPreview, setScrollTopStartPreview] = useState(0);

  // Definir qué plantillas están disponibles
  const availableTemplates: TemplateType[] = ['basic', 'link', 'shop', 'headerStore', 'miniShop']; // Asegúrate que coincida con tus tipos y lógica

  // Función para abrir la vista pública de la tarjeta en nueva pestaña
  const handlePreviewClick = () => {
    const origin = window.location.origin;
    const usernameParam = userData.username || userData.uid;
    const publicUrl = `${origin}/${usernameParam}/card/${cardId}`;
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const fetchCardAndRelatedData = async () => {
      setLoading(true);
      setError(null);
      setLinks([]);
      setCardProducts([]);

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

      const currentUserId = auth.currentUser.uid;

      try {
        // --- 1. Cargar datos del Documento Principal de la Tarjeta --- 
        const cardRef = doc(db, 'cards', cardId);
        const cardDoc = await getDoc(cardRef);

        if (!cardDoc.exists()) {
          console.log("Tarjeta no encontrada en la colección 'cards'");
          setError('Tarjeta no encontrada');
          setLoading(false);
          return;
        }

        console.log("Tarjeta principal encontrada");
        const cardData = { id: cardDoc.id, ...cardDoc.data() } as Card;

        // Validar permiso
        if (cardData.userId !== currentUserId) {
          console.error("Error: El usuario no tiene permiso para editar esta tarjeta.");
          setError("No tienes permiso para editar esta tarjeta.");
          setLoading(false);
          return;
        }

        // --- 2. Cargar Enlaces desde Subcolección --- 
        let fetchedLinks: CardLink[] = [];
        try {
          const linksRef = collection(db, 'cards', cardId, 'links');
          const linksQuery = query(linksRef, orderBy('order', 'asc'));
          const linksSnapshot = await getDocs(linksQuery);
          fetchedLinks = linksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardLink));
          console.log("Enlaces cargados:", fetchedLinks.length);
        } catch (linkError) {
          console.error("Error cargando enlaces desde subcolección:", linkError);
        }

        // --- 3. Cargar Productos Asociados desde Subcolección --- 
        let fetchedAssociatedProducts: Product[] = [];
        try {
          const associatedProductsRef = collection(db, 'cards', cardId, 'cardProducts');
          const associatedProductsQuery = query(associatedProductsRef, orderBy('order', 'asc'));
          const associatedProductsSnapshot = await getDocs(associatedProductsQuery);
          console.log("Asociaciones de producto encontradas:", associatedProductsSnapshot.docs.length);
          
          const productIdsToFetch = associatedProductsSnapshot.docs.map(doc => doc.data().productId as string);

          if (productIdsToFetch.length > 0) {
            const userProductsRef = collection(db, 'users', currentUserId, 'products');
            const productDetailsQuery = query(userProductsRef, where('__name__', 'in', productIdsToFetch.slice(0, 30)));
            const productDetailsSnapshot = await getDocs(productDetailsQuery);
            
            const productDetailsMap = new Map<string, Product>();
            productDetailsSnapshot.docs.forEach(doc => {
              productDetailsMap.set(doc.id, { id: doc.id, ...doc.data() } as Product);
            });
            
            fetchedAssociatedProducts = associatedProductsSnapshot.docs.map(assocDoc => {
              const productId = assocDoc.data().productId;
              return productDetailsMap.get(productId);
            }).filter((p): p is Product => p !== undefined);
            
            console.log("Detalles de productos asociados cargados:", fetchedAssociatedProducts.length);
          }
        } catch (productError) {
          console.error("Error cargando productos asociados:", productError);
        }

        // --- 4. Cargar BookingSettings desde Subcolección (si aplica) --- 
        let fetchedBookingSettings: BookingSettings | undefined = undefined;
        const settingsRef = doc(db, 'cards', cardId, 'bookingSettings', 'settings');
        try {
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists()) {
            console.log("BookingSettings encontrados en subcolección");
            fetchedBookingSettings = settingsDoc.data() as BookingSettings;
          } else {
            console.warn("No se encontró documento 'settings' en la subcolección bookingSettings. Se usarán valores por defecto.");
          }
        } catch (settingsError: any) {
           console.error("Error cargando BookingSettings desde subcolección:", settingsError);
        }

        // --- 5. Procesar y actualizar todos los estados locales --- 
        processCardData(cardData, fetchedLinks, fetchedAssociatedProducts, fetchedBookingSettings);

      } catch (error: any) {
        console.error('Error al acceder a Firestore para cargar tarjeta principal:', error);
        setError(`Error al cargar la tarjeta: ${error.message}`);
        setLoading(false);
      }
    };

    if (userData && cardId && auth.currentUser) {
      fetchCardAndRelatedData();
    }

    if (auth.currentUser) {
        fetchUserProducts(auth.currentUser.uid); 
    } else {
        console.warn("No hay usuario autenticado, no se pueden cargar productos.")
    }

  }, [cardId, userData, navigate]);

  const fetchUserProducts = async (userId: string) => {
    try {
      console.log(`Cargando productos para el usuario: ${userId}`);
      const productsRef = collection(db, 'users', userId, 'products');
      const q = query(productsRef);
      const querySnapshot = await getDocs(q);
      
      const fetchedProducts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      console.log("Productos del usuario cargados:", fetchedProducts.length);
      setUserProducts(fetchedProducts);
      
    } catch (error) {
      console.error('Error al cargar productos desde Firestore:', error);
      setError("Error al cargar los productos disponibles.");
      setUserProducts([]);
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
        setMainImageCompressionStatus('compressing');
        
        const result = await compressImage(selectedFile);
        
        setMainImageCompressionStatus(result.success ? 'success' : 'error');
        setMainImageCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        setMainImageFile(result.file);
        
        const previewUrl = await getImagePreview(result.file);
        setImagePreview(previewUrl);
        
      } catch (error) {
        console.error('Error al comprimir imagen principal:', error);
        setMainImageCompressionStatus('error');
        
        setMainImageFile(selectedFile);
        
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
        setBgImageCompressionStatus('compressing');
        
        const result = await compressBackgroundImage(selectedFile);
        
        setBgImageCompressionStatus(result.success ? 'success' : 'error');
        setBgImageCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        setBackgroundImageFile(result.file);
        
        const previewUrl = await getImagePreview(result.file);
        setBackground(prev => ({ ...prev, imageURL: previewUrl }));
        
      } catch (error) {
        console.error('Error al comprimir imagen de fondo:', error);
        setBgImageCompressionStatus('error');
        
        setBackgroundImageFile(selectedFile);
        
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

      // --- Determinar el estado premium LEYENDO CLAIMS ---
      let determinedPremiumStatus = false; // Por defecto false
      try {
        // Forzar refresco del token para obtener los claims más recientes
        const idTokenResult = await auth.currentUser.getIdTokenResult(true); 
        const stripeRole = idTokenResult.claims.stripeRole as string | undefined;
        console.log("[handleSubmit] Claims obtenidos:", idTokenResult.claims);
        console.log("[handleSubmit] Stripe Role Claim:", stripeRole);
        
        // AJUSTA 'pro' SI EL NOMBRE DE TU ROL PREMIUM ES DIFERENTE
        if (stripeRole === 'pro') { 
          determinedPremiumStatus = true;
          console.log("[handleSubmit] Claim indica premium. determinedPremiumStatus = true");
        } else {
          console.log("[handleSubmit] Claim NO indica premium. determinedPremiumStatus = false");
        }
      } catch (claimError) {
         console.error("[handleSubmit] Error al obtener claims, asumiendo no premium:", claimError);
         determinedPremiumStatus = false; // Asumir no premium si hay error leyendo claims
      }
      
      console.log("[handleSubmit] Estado premium determinado final (determinedPremiumStatus):", determinedPremiumStatus);

      let imageURL = card.imageURL || '';
      let backgroundImageURL = card.backgroundImageURL || '';
      if (mainImageFile) { imageURL = await uploadCardImage(mainImageFile, userId, 'main', card.imageURL); }
      if (backgroundImageFile && background.type === 'image') { backgroundImageURL = await uploadCardImage(backgroundImageFile, userId, 'background', card.backgroundImageURL); }

      const cardDataToUpdate: Partial<Card> = {
        userId: userId, 
        title,
        description,
        imageURL,
        template,
        storeName,
        backgroundType: background.type as Card['backgroundType'],
        active: card.active,
        views: card.views || 0,
        theme: theme,
        sectionOrder: sectionOrder,
        coverMediaItems: coverMediaItems, 
        isPremiumUser: determinedPremiumStatus, // <-- USAR EL VALOR DE LOS CLAIMS
        lastUpdate: Date.now() 
      };
      
      // Lógica para limpiar campos de fondo según el tipo (existente)
      if (background.type === 'color' && background.color) {
        cardDataToUpdate.backgroundColor = background.color;
        cardDataToUpdate.backgroundGradient = undefined; 
        cardDataToUpdate.backgroundImageURL = undefined;
      } else if (background.type === 'gradient' && background.gradient) {
        cardDataToUpdate.backgroundGradient = background.gradient;
        cardDataToUpdate.backgroundColor = undefined;
        cardDataToUpdate.backgroundImageURL = undefined;
      } else if (background.type === 'image') {
        cardDataToUpdate.backgroundImageURL = backgroundImageURL || background.imageURL;
        cardDataToUpdate.backgroundColor = undefined;
        cardDataToUpdate.backgroundGradient = undefined;
      } else {
         cardDataToUpdate.backgroundColor = undefined;
         cardDataToUpdate.backgroundGradient = undefined;
         cardDataToUpdate.backgroundImageURL = undefined;
      }

      // Eliminar claves undefined antes de guardar (existente)
      Object.keys(cardDataToUpdate).forEach(keyStr => {
        const key = keyStr as keyof Partial<Card>;
        if (cardDataToUpdate[key] === undefined) {
          delete cardDataToUpdate[key];
        }
      });

      console.log('[handleSubmit] Datos que se guardarán en Firestore:', cardDataToUpdate);
      const cardDocRef = doc(db, 'cards', cardId);
      await updateDoc(cardDocRef, cardDataToUpdate);
      console.log('Documento principal actualizado.');

      // Actualizar settings de booking si existen (existente)
      if (bookingSettings !== undefined) {
        const settingsRef = doc(db, 'cards', cardId, 'bookingSettings', 'settings');
        console.log('Actualizando documento de settings en subcolección:', bookingSettings);
        await setDoc(settingsRef, bookingSettings, { merge: true }); 
        console.log('Documento de settings actualizado.');
      } else {
         console.log('No hay datos de bookingSettings en el estado local para guardar.');
      }

      // Actualizar estado local (existente)
      const updatedLocalCard = { 
          ...card, 
          ...cardDataToUpdate 
      } as Card;
      setCard(updatedLocalCard);
      setBookingSettings(bookingSettings);
      setCoverMediaItems(coverMediaItems); 

      // Resetear estados de UI (existente)
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

  const toggleProductSelectorVisibility = () => {
    setShowProductSelector(!showProductSelector);
  };

  const handleAddProductToCard = async (product: Product) => {
    if (!card) {
      setError("Datos de la tarjeta no cargados.");
      return;
    }
    // Evitar añadir si ya está (revisión en el estado local primero para UI rápida)
    if (cardProducts.some(p => p.id === product.id)) {
      console.log("El producto ya está en la tarjeta (estado local).");
      return;
    }

    const associationId = await handleAddProductAssociationInFirestore(card.id, product.id);

    if (associationId) {
      // Actualizar el estado local 'cardProducts' para reflejar el cambio en la UI
      // El producto que se añade ya es el objeto Product completo
      setCardProducts(prevProducts => [...prevProducts, product]);
      setSuccess(`Producto '${product.title}' añadido a la tarjeta.`);
    } else {
      // El error ya se establece en handleAddProductAssociationInFirestore
      // pero podrías añadir un mensaje más específico si quieres.
    }
  };

  const handleRemoveProductFromCard = async (productIdToRemove: string) => {
    if (!card) {
      setError("Datos de la tarjeta no cargados.");
      return;
    }

    const success = await handleRemoveProductAssociationFromFirestore(card.id, productIdToRemove);

    if (success) {
      // Actualizar el estado local 'cardProducts'
      setCardProducts(prevProducts => prevProducts.filter(p => p.id !== productIdToRemove));
      const removedProduct = userProducts.find(p => p.id === productIdToRemove);
      setSuccess(`Producto '${removedProduct?.title || 'seleccionado'}' quitado de la tarjeta.`);
    } else {
      // El error ya se establece en handleRemoveProductAssociationFromFirestore
    }
  };

  const getPublicCardUrl = () => {
    if (!userData || !cardId) return '';
    const origin = window.location.origin;
    const usernameParam = userData.username || userData.uid;
    return `${origin}/${usernameParam}/card/${cardId}`.replace(/([^:]\/)\/+/g, "$1");
  };

  const publicCardUrl = getPublicCardUrl();

  const handleReloadPreview = () => {
    setIframeKey(prevKey => prevKey + 1);
  };

  const handlePreviewMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; 
    
    const iframeContentWindow = iframeRef.current?.contentWindow;
    if (!iframeContentWindow) return;

    setIsDraggingPreview(true);
    setStartYPreview(e.pageY);
    const currentScrollTop = iframeContentWindow.document.documentElement.scrollTop || iframeContentWindow.document.body.scrollTop;
    setScrollTopStartPreview(currentScrollTop);
    e.currentTarget.style.cursor = 'grabbing';
    e.preventDefault();
  };

  const handlePreviewMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    if (isDraggingPreview) {
      setIsDraggingPreview(false);
      e.currentTarget.style.cursor = 'grab';
    }
  };

  const handlePreviewMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (isDraggingPreview) {
      setIsDraggingPreview(false);
      e.currentTarget.style.cursor = 'grab';
    }
  };

  const handlePreviewMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPreview) return;
    e.preventDefault();
    const iframeContentWindow = iframeRef.current?.contentWindow;
    if (!iframeContentWindow) return;

    const y = e.pageY;
    const walk = y - startYPreview;
    const newScrollTop = scrollTopStartPreview - walk;
    
    iframeContentWindow.scrollTo(0, newScrollTop);
  };

  const handleBookingSettingsChange = (newSettings: BookingSettings) => {
    setBookingSettings(newSettings);
  };

  const handleOrderChange = (newOrder: CardSectionType[]) => {
    setSectionOrder(newOrder);
  };

  const processCardData = (
    cardData: Card, 
    initialLinks: CardLink[], 
    initialProducts: Product[], 
    initialBookingSettings?: BookingSettings
  ) => {
    setCard(cardData);
    setTitle(cardData.title || '');
    setDescription(cardData.description || '');
    setImagePreview(cardData.imageURL || null);
    setTemplate(cardData.template || 'basic');
    setStoreName(cardData.storeName || '');
    
    const cardBackground: CardBackground = { type: cardData.backgroundType || 'color' };
    if (cardBackground.type === 'color') cardBackground.color = cardData.backgroundColor || '#ffffff';
    else if (cardBackground.type === 'gradient') cardBackground.gradient = cardData.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)';
    else if (cardBackground.type === 'image') cardBackground.imageURL = cardData.backgroundImageURL || undefined;
    setBackground(cardBackground);
    setTheme(cardData.theme || { primaryColor: '#6366f1', secondaryColor: '#4f46e5', textColor: '#333333', linkColor: '#6366f1' });

    setLinks(initialLinks);
    setCardProducts(initialProducts);
    setCoverMediaItems(cardData.coverMediaItems || []);
    
    if (cardData.sectionOrder && cardData.sectionOrder.length > 0) {
      const validSectionsFromDB = cardData.sectionOrder.filter(section => 
          (CARD_SECTION_TYPES as ReadonlyArray<string>).includes(section)
      );
      const uniqueValidSections = [...new Set(validSectionsFromDB)];
      
      const missingSections = DEFAULT_SECTION_ORDER.filter(s => !uniqueValidSections.includes(s));
      
      setSectionOrder([...uniqueValidSections, ...missingSections]);
    } else {
      setSectionOrder(DEFAULT_SECTION_ORDER);
    }
    
    setBookingSettings(initialBookingSettings || { enabled: false, services: [], availability: {}, acceptOnlinePayments: false });

    if (auth.currentUser) {
      fetchUserProducts(auth.currentUser.uid);
    }
    
    setLoading(false);
  };

  // --- NUEVAS FUNCIONES CRUD PARA ENLACES EN FIRESTORE ---
  const handleAddLinkToFirestore = async (currentCardId: string, linkData: Omit<CardLink, 'id' | 'active'> & { active?: boolean }): Promise<string | null> => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      return null;
    }
    try {
      const linksCollectionRef = collection(db, 'cards', currentCardId, 'links');
      // Añadir un campo 'order' si quieres mantener un orden específico, por ejemplo, basado en la longitud actual de links
      const dataToAdd = {
        ...linkData,
        title: linkData.title.trim(), // Asegurar que no haya espacios extra
        url: linkData.url.trim(),
        active: linkData.active !== undefined ? linkData.active : true,
        createdAt: Date.now(), // Opcional: timestamp de creación
        order: links.length // Ejemplo básico de orden
      };
      const docRef = await addDoc(linksCollectionRef, dataToAdd);
      console.log("Enlace añadido a Firestore con ID: ", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error añadiendo enlace a Firestore: ", error);
      setError("Error al guardar el nuevo enlace.");
      return null;
    }
  };

  const handleUpdateLinkInFirestore = async (currentCardId: string, linkId: string, linkData: Partial<Omit<CardLink, 'id'>>): Promise<boolean> => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      return false;
    }
    try {
      const linkDocRef = doc(db, 'cards', currentCardId, 'links', linkId);
      const dataToUpdate: Partial<Omit<CardLink, 'id'> & { lastUpdated?: number }> = { ...linkData };
      if (linkData.title) dataToUpdate.title = linkData.title.trim();
      if (linkData.url) dataToUpdate.url = linkData.url.trim();
      dataToUpdate.lastUpdated = Date.now(); // Opcional: timestamp de actualización

      await updateDoc(linkDocRef, dataToUpdate);
      console.log("Enlace actualizado en Firestore: ", linkId);
      return true;
    } catch (error) {
      console.error("Error actualizando enlace en Firestore: ", error);
      setError("Error al actualizar el enlace.");
      return false;
    }
  };

  const handleDeleteLinkFromFirestore = async (currentCardId: string, linkId: string): Promise<boolean> => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      return false;
    }
    try {
      const linkDocRef = doc(db, 'cards', currentCardId, 'links', linkId);
      await deleteDoc(linkDocRef);
      console.log("Enlace eliminado de Firestore: ", linkId);
      // Opcional: Reordenar los demás enlaces si el campo 'order' es importante
      return true;
    } catch (error) {
      console.error("Error eliminando enlace de Firestore: ", error);
      setError("Error al eliminar el enlace.");
      return false;
    }
  };
  // --- FIN FUNCIONES CRUD PARA ENLACES ---

  // --- NUEVAS FUNCIONES CRUD PARA PRODUCTOS ASOCIADOS A LA TARJETA EN FIRESTORE ---
  const handleAddProductAssociationInFirestore = async (currentCardId: string, productIdToAdd: string): Promise<string | null> => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      return null;
    }
    if (!currentCardId || !productIdToAdd) {
      setError("ID de tarjeta o producto no válido.");
      return null;
    }

    try {
      // Verificar si la asociación ya existe para evitar duplicados
      const cardProductsRef = collection(db, 'cards', currentCardId, 'cardProducts');
      const q = query(cardProductsRef, where("productId", "==", productIdToAdd));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.warn(`El producto ${productIdToAdd} ya está asociado a la tarjeta ${currentCardId}.`);
        // Podríamos devolver el ID existente si es necesario, o simplemente null/indicar que no se añadió de nuevo.
        return querySnapshot.docs[0].id; // Opcional: devolver ID existente
      }

      const dataToAdd = {
        productId: productIdToAdd,
        addedAt: serverTimestamp(), // Usar serverTimestamp para la marca de tiempo del servidor
        order: cardProducts.length // Ejemplo básico de orden (los productos ya en estado + 1)
      };
      const docRef = await addDoc(cardProductsRef, dataToAdd);
      console.log(`Asociación de producto ${productIdToAdd} añadida a tarjeta ${currentCardId} con ID de asociación: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error("Error añadiendo asociación de producto a Firestore: ", error);
      setError("Error al añadir el producto a la tarjeta.");
      return null;
    }
  };

  const handleRemoveProductAssociationFromFirestore = async (currentCardId: string, productIdToRemove: string): Promise<boolean> => {
    if (!auth.currentUser) {
      setError("Usuario no autenticado.");
      return false;
    }
    if (!currentCardId || !productIdToRemove) {
      setError("ID de tarjeta o producto no válido.");
      return false;
    }

    try {
      const cardProductsRef = collection(db, 'cards', currentCardId, 'cardProducts');
      const q = query(cardProductsRef, where("productId", "==", productIdToRemove));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn(`No se encontró la asociación del producto ${productIdToRemove} en la tarjeta ${currentCardId} para eliminar.`);
        return false; // No se encontró nada que borrar
      }

      // Debería haber solo un documento de asociación por producto en una tarjeta
      const associationDocId = querySnapshot.docs[0].id;
      const docToDeleteRef = doc(db, 'cards', currentCardId, 'cardProducts', associationDocId);
      await deleteDoc(docToDeleteRef);
      console.log(`Asociación del producto ${productIdToRemove} eliminada de la tarjeta ${currentCardId}.`);
      // Opcional: Reordenar los demás productos si el campo 'order' es importante
      return true;
    } catch (error) {
      console.error("Error eliminando asociación de producto de Firestore: ", error);
      setError("Error al quitar el producto de la tarjeta.");
      return false;
    }
  };
  // --- FIN FUNCIONES CRUD PARA PRODUCTOS ASOCIADOS ---

  // NUEVO HANDLER para actualizar los items del carrusel desde CoverSliderEditor
  const handleUpdateCoverMediaItems = (newItems: CoverMediaItem[]) => {
    setCoverMediaItems(newItems);
    // Actualizar el estado 'card' para que la preview (si depende de él) y el guardado funcionen
    if (card) {
      setCard(prevCard => ({
        ...(prevCard as Card),
        coverMediaItems: newItems,
      }));
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p>Cargando datos de la tarjeta...</p>
      </div>
    );
  }

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

  // Determinar si el usuario es premium (esto debería venir de userData o un contexto)
  const isPremium = true; // FORZAR A TRUE PARA PRUEBAS

  return (
    <div className="card-editor-container">
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
      <div className="editor-main">
        <aside className="editor-sidebar">
          <ul>
            <li><button onClick={() => setSelectedSection('basic-info')} title="Información Básica"><FiInfo /></button></li>
            <li><button onClick={() => setSelectedSection('background-style')} title="Estilo de Fondo"><FiLayers /></button></li>
            {/* OPCIÓN DE CARRUSEL SI ES PREMIUM (TEMPORALMENTE FORZADO) */}
            {true && (
              <li><button onClick={() => setSelectedSection('coverSlider-editor')} title="Carrusel de Portada" className={selectedSection === 'coverSlider-editor' ? 'active' : ''}><FiFilm /></button></li>
            )}
            <li><button onClick={() => setSelectedSection('links-section')} title="Enlaces"><FiLink /></button></li>
            <li><button onClick={() => setSelectedSection('products-section')} title="Productos"><FiShoppingBag /></button></li>
            <li><button onClick={() => setSelectedSection('booking-section')} title="Reservas"><FiCalendar /></button></li>
            <li><button onClick={() => setSelectedSection('layout-section')} title="Orden de Secciones"><FiMove /></button></li>
          </ul>
        </aside>
        <div className={`editor-content selected-${selectedSection}`}>
          {error && (
            <div className="alert alert-error mb-4">
              {error}
            </div>
          )}
          {(selectedSection === 'basic-info' || selectedSection === 'background-style') && (
            <div className="card-editor-content">
              <div className="card-editor-form-container">
                 <TemplateSelector 
                    availableTemplates={availableTemplates}
                    currentTemplate={template}
                    onTemplateChange={handleTemplateChange}
                    storeName={storeName}
                    onStoreNameChange={handleStoreNameChange}
                 />
                 <CardVisualsEditor 
                    title={title}
                    description={description}
                    background={background}
                    theme={theme}
                    mainImageCompressionStatus={mainImageCompressionStatus}
                    mainImageCompressionData={mainImageCompressionData}
                    bgImageCompressionStatus={bgImageCompressionStatus}
                    bgImageCompressionData={bgImageCompressionData}
                    handleTitleChange={handleTitleChange}
                    handleDescriptionChange={handleDescriptionChange}
                    handleFileChange={handleFileChange}
                    handleBackgroundTypeChange={handleBackgroundTypeChange}
                    handleBackgroundColorChange={handleBackgroundColorChange}
                    handleBackgroundGradientChange={handleBackgroundGradientChange}
                    handleBackgroundFileChange={handleBackgroundFileChange}
                    handleThemeChange={handleThemeChange}
                    handleSubmit={handleSubmit}
                 />
              </div>
              <CardPreviewPane 
                publicCardUrl={publicCardUrl}
                iframeKey={iframeKey}
                iframeRef={iframeRef}
                isDraggingPreview={isDraggingPreview}
                onReloadPreview={handleReloadPreview}
                onMouseDown={handlePreviewMouseDown}
                onMouseLeave={handlePreviewMouseLeave}
                onMouseUp={handlePreviewMouseUp}
                onMouseMove={handlePreviewMouseMove}
              />
            </div>
          )}
          {selectedSection === 'links-section' && card && (
            <LinksManager 
              cardId={card.id}
              links={links}
              onLocalLinksChange={setLinks}
              onAddLinkToFirestore={handleAddLinkToFirestore}
              onUpdateLinkInFirestore={handleUpdateLinkInFirestore}
              onDeleteLinkFromFirestore={handleDeleteLinkFromFirestore}
            />
          )}
          {selectedSection === 'products-section' && (
            <CardProductsEditor 
              cardProducts={cardProducts} 
              toggleProductSelectorVisibility={toggleProductSelectorVisibility} 
              handleRemoveProductFromCard={handleRemoveProductFromCard} 
            />
          )}
          {selectedSection === 'booking-section' && (
            <BookingManager 
              cardId={cardId}
              initialSettings={bookingSettings} 
              onSettingsChange={handleBookingSettingsChange} 
            />
          )}
          {selectedSection === 'layout-section' && (
            <SectionOrderEditor 
              sectionOrder={sectionOrder} 
              onOrderChange={handleOrderChange}
            />
          )}
          {/* RENDERIZAR COVER SLIDER EDITOR (TEMPORALMENTE FORZADO) */}
          {selectedSection === 'coverSlider-editor' && true && auth.currentUser && (
            <CoverSliderEditor 
              currentItems={coverMediaItems} 
              onUpdateItems={handleUpdateCoverMediaItems} 
              cardId={cardId} 
              userId={auth.currentUser.uid}
            />
          )}
        </div>
      </div>
      
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