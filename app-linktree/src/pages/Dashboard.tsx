import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
// Importar useAuth para obtener el plan
import { useAuth } from '../context/AuthContext'; 
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
import BookingList from '../components/dashboard/bookings/BookingList';
import ProfessionalsManager from '../components/dashboard/team/ProfessionalsManager';
import FullCalendarComponent from '../components/booking/FullCalendarComponent';
import ProfessionalFilterList from '../components/dashboard/bookings/ProfessionalFilterList';

// Iconos para el menú
import { FiUser, FiGrid, FiBox, FiCreditCard, FiBarChart2, FiShare2, FiSettings, FiLogOut, FiCalendar, FiHome, FiUsers } from 'react-icons/fi';

// Definir los tipos de pestañas posibles, incluyendo la nueva 'team'
type DashboardTab = 'profile' | 'cards' | 'products' | 'stripe' | 'analytics' | 'share' | 'bookings' | 'team';

const Dashboard = () => {
  // Obtener el plan efectivo del contexto
  const { effectivePlan } = useAuth(); 

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const saved = localStorage.getItem('dashboardActiveTab');
    return saved ? (saved as DashboardTab) : 'profile';
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
    // Lista de pestañas válidas VISIBLES según el plan
    let validTabs: DashboardTab[] = ['profile', 'cards', 'products', 'stripe', 'analytics', 'share'];
    if (effectivePlan === 'PRO' || effectivePlan === 'ADMIN') {
      validTabs.push('team', 'bookings');
    }

    // Si la pestaña activa ya no es válida para el plan actual, redirigir a 'profile'
    if (!validTabs.includes(activeTab)) {
       console.warn(`Pestaña activa ${activeTab} no válida para el plan ${effectivePlan}. Redirigiendo a perfil.`);
       // Usar un useEffect para cambiar el estado después del renderizado inicial si es necesario,
       // o simplemente renderizar el perfil directamente aquí si el cambio de estado inmediato causa problemas.
       setActiveTab('profile'); 
       return <ProfileSettings userData={userData} />;
    }
    
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
      case 'bookings':
        // Asegurar que solo se accede si el plan lo permite (aunque el menú ya lo controla)
        if (effectivePlan === 'PRO' || effectivePlan === 'ADMIN') {
           return (
             <div className="dashboard-bookings-layout">
               <div className="calendar-main-area">
                 <div className="booking-calendar-wrapper">
                   <FullCalendarComponent userId={userData?.uid} />
                 </div>
               </div>
             </div>
           );
        } else {
          // Si de alguna manera llega aquí sin el plan correcto, redirigir
           setActiveTab('profile');
           return <ProfileSettings userData={userData} />;
        }
      case 'team':
        // Asegurar que solo se accede si el plan lo permite
         if (effectivePlan === 'PRO' || effectivePlan === 'ADMIN') {
            return <ProfessionalsManager userId={userData?.uid} />;
         } else {
            setActiveTab('profile');
            return <ProfileSettings userData={userData} />;
         }
      default: // Redirigir a perfil si algo raro pasa
         setActiveTab('profile');
         return <ProfileSettings userData={userData} />;
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
            className="klycs-nav-item"
            onClick={() => navigate('/dashboard')}
          >
            <FiHome />
            <span>Home</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <FiGrid />
            <span>Cards</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <FiBox />
            <span>Products</span>
            <span className="arrow">›</span>
          </div>
          
          {/* --- EQUIPO (Solo PRO y ADMIN) --- */} 
          {(effectivePlan === 'PRO' || effectivePlan === 'ADMIN') && (
            <div 
              className={`klycs-nav-item ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <FiUsers />
              <span>Equipo</span>
              <span className="arrow">›</span>
            </div>
          )}
          {/* --- FIN EQUIPO --- */} 
          
          <div 
            className={`klycs-nav-item ${activeTab === 'stripe' ? 'active' : ''}`}
            onClick={() => setActiveTab('stripe')}
          >
            <FiCreditCard />
            <span>Stripe</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => setActiveTab('share')}
          >
            <FiShare2 />
            <span>Share</span>
            <span className="arrow">›</span>
          </div>
          
          <div 
            className={`klycs-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <FiBarChart2 />
            <span>Analytics</span>
            <span className="arrow">›</span>
          </div>
          
          {/* --- BOOKINGS (Solo PRO y ADMIN) --- */} 
          {(effectivePlan === 'PRO' || effectivePlan === 'ADMIN') && (
            <div 
              className={`klycs-nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <FiCalendar />
              <span>Bookings</span>
              <span className="arrow">›</span>
            </div>
          )}
           {/* --- FIN BOOKINGS --- */} 
           
          <div 
            className={`klycs-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <FiSettings />
            <span>Settings</span>
            <span className="arrow">›</span>
          </div>
        </div>
         
        {/* Perfil de usuario en la barra lateral */}
        <div className="klycs-user-profile">
            {/* ... (contenido del perfil) ... */}
        </div>
      </div>
      
      {/* Contenido principal (donde se renderiza la pestaña activa) */} 
      <div className="klycs-main-content">
        <div className="dashboard-content"> 
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;