import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
// Importación del CSS de Klycs Dashboard
import '../styles/klycsdashboard';
import '../components/dashboard/style/Dashboard.css';

// Componentes para el Dashboard
import { ProfileSettings } from '../components/dashboard/profile';
import LinksManager from '../components/dashboard/links/LinksManager';
import ProductsManager from '../components/dashboard/products/ProductsManager';
import CardsManager from '../components/dashboard/cards/CardsManager';
import StripeConnect from '../components/dashboard/StripeConnect';
import Analytics from '../components/dashboard/Analytics';
import ShareProfile from '../components/dashboard/ShareProfile';

// Iconos para el menú
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const ProductIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="8" x2="8" y2="8"></line>
    <line x1="16" y1="16" x2="8" y2="16"></line>
    <line x1="10" y1="12" x2="3" y2="12"></line>
  </svg>
);

const PaymentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
    <line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);

const AnalyticsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
    <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
  </svg>
);

const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const Dashboard = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('dashboardActiveTab');
    return saved ?? 'profile';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          console.log('Fetcheando datos del usuario en Dashboard:', auth.currentUser.uid);
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            // Si el documento existe, usar esos datos
            const userData = userDoc.data();
            console.log('Datos del usuario obtenidos de Firestore:', userData);
            
            // Verificar si tiene productos
            if (!userData.products) {
              console.log('El usuario no tiene productos, inicializando array vacío');
              userData.products = [];
              // Guardar para actualizar el documento
              await updateDoc(userDocRef, { products: [] });
            } else {
              console.log('Productos del usuario encontrados:', userData.products);
            }
            
            setUserData(userData);
          } else {
            // Si el documento no existe, crear uno nuevo
            console.info('Creando nuevo documento de usuario');
            
            // Datos iniciales del usuario
            const newUserData = {
              uid: auth.currentUser.uid,
              email: auth.currentUser.email,
              displayName: auth.currentUser.displayName || '',
              photoURL: auth.currentUser.photoURL || '',
              username: '',  // El usuario deberá configurar su username
              bio: '',
              links: [],
              products: [],
              stripeConnected: false,
              createdAt: new Date()
            };
            
            // Guardar en Firestore
            await setDoc(userDocRef, newUserData);
            
            // Actualizar estado
            setUserData(newUserData);
          }
        } catch (error: any) {
          console.error('Error al cargar datos del usuario:', error);
          setError(error.message || 'Error al cargar datos del usuario');
        } finally {
          setLoading(false);
        }
      } else {
        // Si no hay usuario autenticado, redirigir al login
        navigate('/login');
      }
    };

    fetchUserData();
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem('dashboardActiveTab', activeTab);
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
      setError(error.message || 'Error al cerrar sesión');
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p>Cargando tu perfil...</p>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-alert dashboard-alert-error">
          {error}
        </div>
        <button className="dashboard-button" onClick={() => navigate('/login')}>
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  // Si no hay datos de usuario después de cargar, mostrar error
  if (!userData) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-alert dashboard-alert-error">
          No se pudieron cargar los datos del usuario. Por favor, inténtalo de nuevo.
        </div>
        <button className="dashboard-button" onClick={() => navigate('/login')}>
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings userData={userData} />;
      case 'cards':
        return <CardsManager userData={userData} />;
      case 'products':
        return <ProductsManager userData={userData} />;
      case 'stripe':
        return <StripeConnect userData={userData} />;
      case 'analytics':
        return <Analytics userData={userData} />;
      case 'share':
        return <ShareProfile userData={userData} />;
      default:
        return null;
    }
  };

  return (
    <div className="klycs-dashboard">
      {/* Barra lateral */}
      <div className={`klycs-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="klycs-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#ff4500">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h-2v-8h2v8zm5 0h-2v-8h2v8z" />
          </svg>
          <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '1.25rem' }}>Klycs</span>
        </div>
        
        {/* Botón de Pro */}
        <button className="klycs-pro-button">
          <span>👑</span> KLYCS PRO
        </button>
        
        {/* Menú de navegación */}
        <div className="klycs-nav">
          <div 
            className={`klycs-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => window.location.href = '/'}
          >
            <HomeIcon />
            <span>Home</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <LinkIcon />
            <span>Link in Bio & Website</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <ProductIcon />
            <span>Products</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'stripe' ? 'active' : ''}`}
            onClick={() => setActiveTab('stripe')}
          >
            <PaymentIcon />
            <span>Affiliate</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => setActiveTab('share')}
          >
            <ShareIcon />
            <span>Marketing</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <AnalyticsIcon />
            <span>Analytics</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <SettingsIcon />
            <span>Settings</span>
            <span className="arrow">›</span>
          </div>
        </div>
        
        {/* Perfil de usuario en la barra lateral */}
        <div className="klycs-user-profile">
          <div className="klycs-user-profile-avatar">
            {userData.photoURL ? (
              <img src={userData.photoURL} alt={userData.displayName || userData.username || ''} />
            ) : (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: '#e2e8f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#64748b',
                fontWeight: 'bold'
              }}>
                {(userData.displayName || userData.username || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="klycs-user-profile-name">
            @{userData.username || 'username'}
          </div>
          <span className="arrow">›</span>
        </div>
      </div>
      
      {/* Contenido principal */}
      <div className="klycs-main-content">
        {/* Encabezado de usuario */}
        <div className="klycs-user-header">
          <div className="klycs-user-info">
            <div className="klycs-user-avatar">
              {userData.photoURL ? (
                <img src={userData.photoURL} alt={userData.displayName || userData.username || ''} />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: '#e2e8f0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#64748b',
                  fontWeight: 'bold',
                  fontSize: '1.25rem'
                }}>
                  {(userData.displayName || userData.username || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="klycs-user-welcome">
              <h2>Hola, {userData.displayName || userData.username || 'Usuario'} 👋</h2>
              <p>Bienvenido a tu panel de control</p>
            </div>
          </div>
          
          <button className="klycs-pro-button" style={{ margin: 0, maxWidth: '180px' }}>
            <span>👑</span> Actualizar a PRO
          </button>
        </div>
        
        {/* Contenido de la pestaña activa */}
        <div className="dashboard-content">
          <div className="card">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 