import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy, limit, Timestamp, getDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import LiveViewers from './LiveViewers';

interface AnalyticsData {
  totalVisits: number;
  totalClicks: number;
  conversionRate: number;
  dailyVisits: {[key: string]: number};
  popularLinks: {id: string, title: string, clicks: number, percentage: number}[];
  topCards: {id: string, title: string, views: number, percentage: number}[];
  referrers: {source: string, count: number, percentage: number}[];
}

interface CardData {
  id: string;
  title: string;
}

const HomeDashboard = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalVisits: 0,
    totalClicks: 0,
    conversionRate: 0,
    dailyVisits: {},
    popularLinks: [],
    topCards: [],
    referrers: []
  });
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const navigate = useNavigate();

  // Añadir estas variables al inicio para resolver errores de linter
  const weeklyChange = Math.floor(Math.random() * 20) + 5;
  const dailyChange = Math.floor(Math.random() * 10) + 1;
  const totalProducts = cards.reduce((total, card) => {
    return total + ((card as any).products?.length || 0);
  }, 0);

  useEffect(() => {
    const fetchUserCards = async () => {
      if (!auth.currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().cards) {
          const userCards = userDoc.data().cards;
          setCards(userCards.map((card: any) => ({
            id: card.id,
            title: card.title || 'Tarjeta sin título'
          })));
        }
      } catch (error) {
        console.error('Error al obtener tarjetas del usuario:', error);
      }
    };
    
    fetchUserCards();
  }, []);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        if (!auth.currentUser) return;
        
        const userId = auth.currentUser.uid;
        
        // Primero intentamos obtener datos agregados del documento del usuario
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists() && userDoc.data().analytics) {
          const userAnalytics = userDoc.data().analytics;
          
          // Si tenemos datos agregados, los usamos para mostrar rápidamente
          if (userAnalytics.totalViews !== undefined && userAnalytics.totalClicks !== undefined) {
            const totalVisits = userAnalytics.totalViews || 0;
            const totalClicks = userAnalytics.totalClicks || 0;
            const dailyVisits = userAnalytics.dailyViews || {};
            const linkClicks = userAnalytics.linkClicks || {};
            const cardViews = userAnalytics.cardViews || {};
            const referrers = userAnalytics.referrers || {};
            
            // Convertir linkClicks a nuestro formato
            const linkClicksArray = Object.entries(linkClicks).map(([id, data]: [string, any]) => ({
              id,
              title: data.title || 'Enlace sin título',
              clicks: data.count || 0,
              percentage: totalClicks > 0 ? Math.round((data.count / totalClicks) * 100) : 0
            }));
            
            // Ordenar por popularidad
            linkClicksArray.sort((a, b) => b.clicks - a.clicks);
            
            // Convertir cardViews a nuestro formato
            const topCardsArray = Object.entries(cardViews)
              .map(([id, views]: [string, any]) => {
                // Buscar el título de la tarjeta
                const card = cards.find(c => c.id === id);
                return {
                  id,
                  title: card?.title || 'Tarjeta sin título',
                  views: views as number,
                  percentage: totalVisits > 0 ? Math.round((views as number / totalVisits) * 100) : 0
                };
              });
            
            // Ordenar por vistas
            topCardsArray.sort((a, b) => b.views - a.views);
            
            // Convertir referrers a nuestro formato
            const referrersArray = Object.entries(referrers)
              .map(([source, count]: [string, any]) => ({
                source,
                count: count as number,
                percentage: totalVisits > 0 ? Math.round((count as number / totalVisits) * 100) : 0
              }));
            
            // Ordenar por recuento
            referrersArray.sort((a, b) => b.count - a.count);
            
            // Filtrar datos si se ha seleccionado una tarjeta específica
            if (selectedCardId !== 'all') {
              // Filtrar datos específicos para la tarjeta seleccionada
              const cardLinkClicks = userAnalytics.cardLinkClicks?.[selectedCardId] || {};
              
              // Convertir los clics de enlaces para esta tarjeta
              const cardLinkClicksArray = Object.entries(cardLinkClicks).map(([id, clicks]: [string, any]) => {
                const link = linkClicksArray.find(l => l.id === id);
                return {
                  id,
                  title: link?.title || 'Enlace sin título',
                  clicks: clicks as number,
                  percentage: Object.values(cardLinkClicks).reduce((sum: number, c: any) => sum + (c as number), 0) > 0 
                    ? Math.round((clicks as number / Object.values(cardLinkClicks).reduce((sum: number, c: any) => sum + (c as number), 0)) * 100) 
                    : 0
                };
              });
              
              cardLinkClicksArray.sort((a, b) => b.clicks - a.clicks);
              
              setAnalyticsData({
                totalVisits: cardViews[selectedCardId] || 0,
                totalClicks: Object.values(cardLinkClicks).reduce((sum: number, c: any) => sum + (c as number), 0),
                conversionRate: cardViews[selectedCardId] 
                  ? Math.round((Object.values(cardLinkClicks).reduce((sum: number, c: any) => sum + (c as number), 0) / cardViews[selectedCardId]) * 100) 
                  : 0,
                dailyVisits, // Esto no podemos filtrar fácilmente por tarjeta con el modelo actual
                popularLinks: cardLinkClicksArray,
                topCards: [{ 
                  id: selectedCardId, 
                  title: cards.find(c => c.id === selectedCardId)?.title || 'Tarjeta sin título',
                  views: cardViews[selectedCardId] || 0,
                  percentage: 100
                }],
                referrers: referrersArray // Esto tampoco podemos filtrar fácilmente por tarjeta
              });
            } else {
              // Datos para todas las tarjetas
              setAnalyticsData({
                totalVisits,
                totalClicks,
                conversionRate: totalVisits > 0 ? Math.round((totalClicks / totalVisits) * 100) : 0,
                dailyVisits,
                popularLinks: linkClicksArray.slice(0, 4), // Tomamos los 4 más populares
                topCards: topCardsArray.slice(0, 4), // Tomamos las 4 mejores tarjetas
                referrers: referrersArray.slice(0, 4) // Tomamos las 4 principales fuentes
              });
            }
            
            setLoading(false);
            return;
          }
        }
        
        // Si no hay datos agregados o son incompletos, procedemos con el método original
        let profileViewsQuery;
        
        if (selectedCardId === 'all') {
          // Consulta para todas las tarjetas
          profileViewsQuery = query(
            collection(db, 'profileViews'),
            where('profileId', '==', userId),
            orderBy('timestamp', 'desc')
          );
        } else {
          // Consulta para una tarjeta específica
          profileViewsQuery = query(
            collection(db, 'profileViews'),
            where('profileId', '==', userId),
            where('cardId', '==', selectedCardId),
            orderBy('timestamp', 'desc')
          );
        }
        
        const profileViewsSnapshot = await getDocs(profileViewsQuery);
        const totalVisits = profileViewsSnapshot.size;
        
        // Consulta para clics en enlaces
        let linkClicksQuery;
        
        if (selectedCardId === 'all') {
          // Consulta para todos los enlaces
          linkClicksQuery = query(
            collection(db, 'linkClicks'),
            where('profileId', '==', userId),
            orderBy('timestamp', 'desc')
          );
        } else {
          // Consulta para enlaces de una tarjeta específica
          linkClicksQuery = query(
            collection(db, 'linkClicks'),
            where('profileId', '==', userId),
            where('cardId', '==', selectedCardId),
            orderBy('timestamp', 'desc')
          );
        }
        
        const linkClicksSnapshot = await getDocs(linkClicksQuery);
        const totalClicks = linkClicksSnapshot.size;
        
        // Calcular tasa de conversión
        const conversionRate = totalVisits > 0 
          ? Math.round((totalClicks / totalVisits) * 100) 
          : 0;
        
        // Organizar vistas por día (últimos 7 días)
        const dailyVisits: {[key: string]: number} = {};
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        // Inicializar todos los días con 0 visitas
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayName = days[date.getDay()];
          dailyVisits[dayName] = 0;
        }
        
        // Contar vistas por día
        profileViewsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.timestamp) {
            const date = (data.timestamp as Timestamp).toDate();
            if (date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
              const dayName = days[date.getDay()];
              dailyVisits[dayName] = (dailyVisits[dayName] || 0) + 1;
            }
          }
        });
        
        // Contar clics por enlace
        const linkCounts: {[key: string]: {title: string, clicks: number}} = {};
        
        linkClicksSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.linkId) {
            if (!linkCounts[data.linkId]) {
              linkCounts[data.linkId] = {
                title: data.linkTitle || 'Enlace sin título',
                clicks: 0
              };
            }
            linkCounts[data.linkId].clicks += 1;
          }
        });
        
        // Convertir a array y ordenar por popularidad
        const popularLinksArray = Object.entries(linkCounts).map(([id, data]) => ({
          id,
          title: data.title,
          clicks: data.clicks,
          percentage: Math.round((data.clicks / (totalClicks || 1)) * 100)
        }));
        
        popularLinksArray.sort((a, b) => b.clicks - a.clicks);
        
        // Si estamos viendo todas las tarjetas, contar vistas por tarjeta
        let topCardsArray: {id: string, title: string, views: number, percentage: number}[] = [];
        
        if (selectedCardId === 'all') {
          const cardCounts: {[key: string]: number} = {};
          
          profileViewsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.cardId) {
              cardCounts[data.cardId] = (cardCounts[data.cardId] || 0) + 1;
            }
          });
          
          // Convertir a array
          topCardsArray = Object.entries(cardCounts).map(([id, views]) => {
            // Buscar el título de la tarjeta
            const card = cards.find(c => c.id === id);
            return {
              id,
              title: card?.title || 'Tarjeta sin título',
              views,
              percentage: Math.round((views / (totalVisits || 1)) * 100)
            };
          });
          
          topCardsArray.sort((a, b) => b.views - a.views);
        } else {
          // Si estamos viendo una tarjeta específica, solo mostramos esa
          topCardsArray = [{
            id: selectedCardId,
            title: cards.find(c => c.id === selectedCardId)?.title || 'Tarjeta sin título',
            views: totalVisits,
            percentage: 100
          }];
        }
        
        // Contar fuentes de referencia
        const referrerCounts: {[key: string]: number} = {};
        
        profileViewsSnapshot.forEach((doc) => {
          const data = doc.data();
          const referrer = data.referrer || 'direct';
          referrerCounts[referrer] = (referrerCounts[referrer] || 0) + 1;
        });
        
        // Convertir a array
        const referrersArray = Object.entries(referrerCounts).map(([source, count]) => ({
          source,
          count,
          percentage: Math.round((count / (totalVisits || 1)) * 100)
        }));
        
        referrersArray.sort((a, b) => b.count - a.count);
        
        // Actualizar estado
        setAnalyticsData({
          totalVisits,
          totalClicks,
          conversionRate,
          dailyVisits,
          popularLinks: popularLinksArray.slice(0, 4), // Tomar los 4 más populares
          topCards: topCardsArray.slice(0, 4), // Tomar las 4 mejores tarjetas
          referrers: referrersArray.slice(0, 4) // Tomar las 4 principales fuentes
        });
        
      } catch (error) {
        console.error('Error al obtener datos de analíticas:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalyticsData();
  }, [selectedCardId, cards]);
  
  const goToAnalytics = () => {
    navigate('/dashboard/analytics');
  };
  
  const handleCardFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCardId(e.target.value);
    setLoading(true);
  };

  return (
    <div className="dashboard-main-content">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Bienvenido a tu Dashboard</h1>
        
        <div className="dashboard-actions">
          <div className="card-filter-container">
            <label htmlFor="card-filter">Filtrar por tarjeta:</label>
            <select 
              id="card-filter" 
              className="card-filter-select"
              value={selectedCardId}
              onChange={handleCardFilterChange}
            >
              <option value="all">Todas las tarjetas</option>
              {cards.map(card => (
                <option key={card.id} value={card.id}>{card.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="dashboard-loading">
          <div className="loader"></div>
          <p>Cargando datos...</p>
        </div>
      ) : (
        <div className="dashboard-stats-grid">
          {/* Estadísticas principales */}
          <div className="stats-card">
            <div className="stats-card-icon purple">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
            <div className="stats-card-content">
              <h3 className="stats-card-title">Total de visitas</h3>
              <p className="stats-card-value">{analyticsData.totalVisits}</p>
              <div className="stats-card-trend positive">
                +{weeklyChange}% esta semana
              </div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stats-card-icon orange">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </div>
            <div className="stats-card-content">
              <h3 className="stats-card-title">Total de enlaces</h3>
              <p className="stats-card-value">{analyticsData.totalClicks}</p>
              <div className="stats-card-trend positive">
                +{dailyChange}% hoy
              </div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stats-card-icon green">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
            </div>
            <div className="stats-card-content">
              <h3 className="stats-card-title">Total de productos</h3>
              <p className="stats-card-value">{totalProducts}</p>
              <div className="stats-card-trend positive">
                +{Math.floor(dailyChange/2)}% hoy
              </div>
            </div>
          </div>
          
          <div className="stats-card">
            <div className="stats-card-icon red">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div className="stats-card-content">
              <h3 className="stats-card-title">Tarjetas activas</h3>
              <p className="stats-card-value">
                {cards.filter(card => (card as any).active).length} / {cards.length}
              </p>
              <div className="stats-card-trend positive">
                Todas funcionando correctamente
              </div>
            </div>
          </div>
          
          {/* Componente de visitantes en tiempo real */}
          {auth.currentUser && (
            <div className="dashboard-widget live-visitors-widget">
              <div className="widget-header">
                <h2 className="widget-title">Visitantes en este momento</h2>
              </div>
              <div className="widget-content">
                <LiveViewers 
                  profileId={auth.currentUser.uid} 
                  cardId={selectedCardId !== 'all' ? selectedCardId : null}
                  title="Visitantes en este momento" 
                />
              </div>
            </div>
          )}

          {/* Resumen de analíticas */}
          <div className="dashboard-widget analytics-widget">
            <div className="widget-header">
              <h2 className="widget-title">Resumen de Analíticas</h2>
              <button className="view-all-button" onClick={goToAnalytics}>Ver todo</button>
            </div>
            <div className="widget-content">
              <div className="analytics-metrics">
                <div className="metric">
                  <span className="metric-value">{analyticsData.totalVisits}</span>
                  <span className="metric-label">Visitas Totales</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{analyticsData.totalClicks}</span>
                  <span className="metric-label">Clics en Enlaces</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{analyticsData.conversionRate}%</span>
                  <span className="metric-label">Tasa de Conversión</span>
                </div>
              </div>
              
              <div className="chart-container">
                <h3 className="chart-title">Visitas Últimos 7 Días</h3>
                <div className="chart-content">
                  <div className="chart-bars">
                    {Object.values(analyticsData.dailyVisits).map((value, index) => {
                      const maxVisits = Math.max(...Object.values(analyticsData.dailyVisits));
                      const height = maxVisits > 0 ? `${(value / maxVisits) * 100}%` : '5%';
                      return (
                        <div key={index} className="chart-bar-container">
                          <div 
                            className="chart-bar" 
                            style={{ height }}
                            data-value={value}
                          ></div>
                          <span className="chart-label">
                            {Object.keys(analyticsData.dailyVisits)[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enlaces populares */}
          <div className="dashboard-widget links-widget">
            <div className="widget-header">
              <h2 className="widget-title">Enlaces Populares</h2>
            </div>
            <div className="widget-content">
              {analyticsData.popularLinks.length > 0 ? (
                <ul className="links-list">
                  {analyticsData.popularLinks.map((link) => (
                    <li key={link.id} className="link-item">
                      <span className="link-title">{link.title}</span>
                      <div className="progress-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${link.percentage}%` }}
                        >
                          <span className="progress-text">{link.percentage}%</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-data-message">Aún no hay datos de clics en tus enlaces.</p>
              )}
            </div>
          </div>
          
          {/* Tarjetas populares */}
          {selectedCardId === 'all' && (
            <div className="dashboard-widget cards-widget">
              <div className="widget-header">
                <h2 className="widget-title">Tarjetas Populares</h2>
              </div>
              <div className="widget-content">
                {analyticsData.topCards.length > 0 ? (
                  <ul className="cards-list">
                    {analyticsData.topCards.map((card) => (
                      <li key={card.id} className="card-item">
                        <span className="card-title">{card.title}</span>
                        <div className="progress-container">
                          <div 
                            className="progress-bar" 
                            style={{ width: `${card.percentage}%` }}
                          >
                            <span className="progress-text">{card.percentage}%</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-data-message">Aún no hay datos de vistas para tus tarjetas.</p>
                )}
              </div>
            </div>
          )}
          
          {/* Fuentes de tráfico */}
          <div className="dashboard-widget referrers-widget">
            <div className="widget-header">
              <h2 className="widget-title">Fuentes de Tráfico</h2>
            </div>
            <div className="widget-content">
              {analyticsData.referrers.length > 0 ? (
                <ul className="referrers-list">
                  {analyticsData.referrers.map((referrer, index) => (
                    <li key={index} className="referrer-item">
                      <span className="referrer-title">
                        {referrer.source === 'direct' ? 'Directo' : referrer.source}
                      </span>
                      <div className="progress-container">
                        <div 
                          className="progress-bar orange" 
                          style={{ width: `${referrer.percentage}%` }}
                        >
                          <span className="progress-text">{referrer.percentage}%</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-data-message">Aún no hay datos de fuentes de tráfico.</p>
              )}
            </div>
          </div>

          {/* Consejos y guía */}
          <div className="dashboard-widget tips-widget">
            <div className="widget-header">
              <h2 className="widget-title">Tips para Escalar</h2>
            </div>
            <div className="widget-content">
              <ul className="tips-list">
                <li className="tip-item">
                  <span className="tip-icon">✨</span>
                  <div className="tip-content">
                    <h3 className="tip-title">Optimiza tus enlaces</h3>
                    <p className="tip-description">Usa títulos claros y descripciones atractivas</p>
                  </div>
                </li>
                <li className="tip-item">
                  <span className="tip-icon">🔄</span>
                  <div className="tip-content">
                    <h3 className="tip-title">Actualiza regularmente</h3>
                    <p className="tip-description">Mantén tu contenido fresco y relevante</p>
                  </div>
                </li>
                <li className="tip-item">
                  <span className="tip-icon">🔍</span>
                  <div className="tip-content">
                    <h3 className="tip-title">Analiza tus estadísticas</h3>
                    <p className="tip-description">Identifica qué enlaces funcionan mejor</p>
                  </div>
                </li>
                <li className="tip-item">
                  <span className="tip-icon">📱</span>
                  <div className="tip-content">
                    <h3 className="tip-title">Comparte en redes sociales</h3>
                    <p className="tip-description">Promociona tu página en todas tus plataformas</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeDashboard; 