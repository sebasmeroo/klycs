import React, { useState, useEffect } from 'react';
import { doc, collection, query, where, onSnapshot, getDoc, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '../../../firebase/config';
import { useNavigate } from 'react-router-dom';
import '../../../styles/CardDashboard.css';
import CardEditorContainer from '../../cardeditor/CardEditorContainer';

// Iconos importados de react-icons
import { FiPlus, FiUsers, FiCalendar, FiEdit, FiEye, FiLink } from 'react-icons/fi';
import { BsGraphUp, BsGrid } from 'react-icons/bs';
import { BiLineChart } from 'react-icons/bi';

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
}

interface CardsDashboardProps {
  userData: any;
}

const CardsDashboard: React.FC<CardsDashboardProps> = ({ userData }) => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [viewsData, setViewsData] = useState<Record<string, number>>({});
  const [totalLinks, setTotalLinks] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyChange, setWeeklyChange] = useState(0);
  const [dailyChange, setDailyChange] = useState(0);

  // Obtener datos de las tarjetas y estadísticas en tiempo real
  useEffect(() => {
    if (!userData || !userData.uid) {
      setLoading(false);
      setCards([]);
      setTotalLinks(0);
      setTotalProducts(0);
      setViewsData({});
      return;
    }

    setLoading(true);
    let unsubscribeCards: Unsubscribe = () => {};
    let unsubscribeViews: Unsubscribe = () => {};

    // 1. Suscripción a las tarjetas del usuario
    const cardsQuery = query(collection(db, 'cards'), where('userId', '==', userData.uid));
    unsubscribeCards = onSnapshot(cardsQuery, 
      (snapshot) => {
        let fetchedCards: Card[] = [];
        let links = 0;
        let products = 0;

        snapshot.forEach(doc => {
          const cardData = doc.data() as Omit<Card, 'id'>; // Asegurarse del tipo
          const card = { id: doc.id, ...cardData };
          fetchedCards.push(card);
          links += card.links?.length || 0;
          products += card.products?.length || 0;
        });

        setCards(fetchedCards);
        setTotalLinks(links);
        setTotalProducts(products);

        // Simular cambios semanales y diarios para demo
        setWeeklyChange(Math.floor(Math.random() * 20) + 5);
        setDailyChange(Math.floor(Math.random() * 10) + 1);
        
        setLoading(false); // Marcar como cargado después de obtener tarjetas
      }, 
      (error) => {
        console.error("Error al obtener tarjetas:", error);
        setLoading(false);
      }
    );

    // 2. Suscripción en tiempo real a las vistas (mantenida)
    const profileViewsRef = collection(db, 'profileViews');
    const viewsQuery = query(profileViewsRef, where('profileId', '==', userData.uid));
    unsubscribeViews = onSnapshot(viewsQuery, (snapshot) => {
      const cardVisits: Record<string, number> = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.cardId) {
          cardVisits[data.cardId] = (cardVisits[data.cardId] || 0) + 1;
        }
      });

      setViewsData(cardVisits); // Actualizar vistas por tarjeta
    }, (error) => {
      console.error("Error en la suscripción de vistas:", error);
    });

    // Función de limpieza para cancelar ambas suscripciones
    return () => {
      console.log("Cancelando listeners de dashboard (cards y views).");
      unsubscribeCards();
      unsubscribeViews();
    };
  }, [userData]); // Dependencia principal es userData

  const handleEditCard = (cardId: string) => {
    setEditingCardId(cardId);
  };

  const handleCloseEditor = () => {
    setEditingCardId(null);
  };

  const getCardViewCount = (cardId: string) => {
    return viewsData[cardId] || 0;
  };

  // Función auxiliar para obtener el total de vistas (puede elegir la fuente)
  const getTotalViews = () => {
     // Opción 1: Sumar las vistas guardadas en cada tarjeta
     // return cards.reduce((sum, card) => sum + (card.views || 0), 0);

     // Opción 2: Sumar las vistas contadas en tiempo real por viewsData
     return Object.values(viewsData).reduce((sum, count) => sum + count, 0);
  };

  // Si estamos editando una tarjeta, mostrar el editor
  if (editingCardId) {
    return (
      <div className="dashboard-container">
        <button onClick={handleCloseEditor} className="dashboard-button-secondary">Volver al Dashboard</button>
        <CardEditorContainer 
          cardId={editingCardId}
          userData={userData}
          onReturn={handleCloseEditor}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <div className="dashboard-actions">
          <button className="card-btn primary" onClick={() => navigate('/card/new')}>
            <FiPlus /> Nueva Tarjeta
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        {/* Tarjetas de estadísticas */}
        <div className="stats-card">
          <div className="stats-card-header">
            <div>
              <p className="stats-card-title">Total de visitas</p>
              <h3 className="stats-card-value">{getTotalViews().toLocaleString()}</h3>
              <div className="stats-card-trend positive">
                +{weeklyChange}% esta semana
              </div>
            </div>
            <div className="stats-card-icon" style={{ backgroundColor: '#6366f1' }}>
              <FiEye />
            </div>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-header">
            <div>
              <p className="stats-card-title">Total de enlaces</p>
              <h3 className="stats-card-value">{totalLinks.toLocaleString()}</h3>
              <div className="stats-card-trend positive">
                +{dailyChange}% hoy
              </div>
            </div>
            <div className="stats-card-icon" style={{ backgroundColor: '#f59e0b' }}>
              <FiLink />
            </div>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-header">
            <div>
              <p className="stats-card-title">Total de productos</p>
              <h3 className="stats-card-value">{totalProducts.toLocaleString()}</h3>
              <div className="stats-card-trend positive">
                +{Math.floor(dailyChange/2)}% hoy
              </div>
            </div>
            <div className="stats-card-icon" style={{ backgroundColor: '#22c55e' }}>
              <BsGrid />
            </div>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-header">
            <div>
              <p className="stats-card-title">Tarjetas activas</p>
              <h3 className="stats-card-value">
                {cards.filter(card => card.active).length} / {cards.length}
              </h3>
              <div className="stats-card-trend positive">
                Todas funcionando correctamente
              </div>
            </div>
            <div className="stats-card-icon" style={{ backgroundColor: '#ef4444' }}>
              <FiCalendar />
            </div>
          </div>
        </div>
        
        {/* Tarjetas de proyectos destacados */}
        {cards.slice(0, 3).map((card, index) => (
          <div 
            key={card.id} 
            className={`project-card ${index === 0 ? 'finance' : index === 1 ? 'education' : 'travel'}`}
          >
            <div className="project-card-header">
              <div className="project-card-tag">
                {card.active ? 'Activa' : 'Inactiva'}
              </div>
              <div className="project-card-actions">
                <button onClick={() => handleEditCard(card.id)}>
                  <FiEdit />
                </button>
              </div>
            </div>
            <div className="project-card-content">
              <h3 className="project-card-title">{card.title}</h3>
              <p className="project-card-subtitle">
                {card.description ? 
                  (card.description.length > 50 ? 
                    card.description.substring(0, 50) + '...' : 
                    card.description) : 
                  'Sin descripción'
                }
              </p>
              <div className="project-card-value">
                {getCardViewCount(card.id)} visitas
              </div>
            </div>
            <div className="project-card-footer">
              <div className="project-card-stat">
                <span>Enlaces: {card.links?.length || 0}</span>
              </div>
              <div className="project-card-stat">
                <span>Productos: {card.products?.length || 0}</span>
              </div>
            </div>
          </div>
        ))}
        
        {/* Secciones de gráficos y calendario */}
        <div className="chart-section">
          <div className="chart-header">
            <h3 className="chart-title">Rendimiento anual <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(28%)</span></h3>
            <div>
              <button className="card-btn">
                <BiLineChart /> Exportar
              </button>
            </div>
          </div>
          <div className="chart-content">
            {/* Aquí iría un componente de gráfico real. Para este ejemplo, mostramos una representación básica */}
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'flex-end', 
              gap: '12px', 
              padding: '10px 0'
            }}>
              {['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'].map((month, i) => (
                <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ 
                    height: `${50 + Math.sin(i * 0.8) * 30 + Math.random() * 40}px`, 
                    width: '100%', 
                    background: 'linear-gradient(180deg, rgba(99,102,241,0.8) 0%, rgba(79,70,229,0.4) 100%)',
                    borderRadius: '6px 6px 0 0'
                  }}></div>
                  <span style={{ fontSize: '0.8rem', marginTop: '8px', color: '#64748b' }}>{month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="calendar-section">
          <div className="calendar-header">
            <h3 className="chart-title">Calendario <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(4 App)</span></h3>
            <div>
              <button className="card-btn">
                <FiCalendar /> Ver
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {Array.from({ length: 35 }, (_, i) => {
              const hasEvent = [4, 7, 12, 18, 24, 27, 30].includes(i);
              const isActive = i === 15;
              return (
                <div
                  key={i}
                  className={`calendar-day ${hasEvent ? 'has-event' : ''} ${isActive ? 'active' : ''}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Sección de tarjetas en grid */}
      <h2 style={{ fontSize: '1.5rem', margin: '2rem 0 1rem' }}>Tus Tarjetas</h2>
      
      <div className="cards-grid">
        <div className="create-new-section" onClick={() => navigate('/card/new')}>
          <div className="create-new-icon">
            <FiPlus />
          </div>
          <h3 className="create-new-title">Crear Nueva Tarjeta</h3>
          <p className="create-new-description">
            Añade una nueva tarjeta para compartir con tus clientes
          </p>
        </div>
        
        {cards.map(card => (
          <div key={card.id} className="card-item">
            <div 
              className="card-header" 
              style={{ 
                backgroundImage: card.imageURL ? `url(${card.imageURL})` : undefined 
              }}
            >
              <div className="card-badge">
                {card.active ? 'Activa' : 'Inactiva'}
              </div>
            </div>
            <div className="card-content">
              <h3 className="card-title">{card.title}</h3>
              <p className="card-description">
                {card.description || 'Sin descripción'}
              </p>
              
              <div className="card-stats">
                <div className="card-stat">
                  <FiEye /> {getCardViewCount(card.id)} vistas
                </div>
                <div className="card-stat">
                  <FiLink /> {card.links?.length || 0} enlaces
                </div>
              </div>
              
              <div className="card-actions">
                <button 
                  className="card-btn primary"
                  onClick={() => handleEditCard(card.id)}
                >
                  <FiEdit /> Editar
                </button>
                {card.autoUrl && (
                  <button 
                    className="card-btn"
                    onClick={() => window.open(card.autoUrl, '_blank')}
                  >
                    <FiEye /> Ver
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardsDashboard; 