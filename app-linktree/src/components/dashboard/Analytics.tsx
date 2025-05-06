import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { FiUsers, FiMousePointer, FiTarget } from 'react-icons/fi';
import './Analytics.css';

interface AnalyticsProps {
  userData: any; // Mantenemos userData para obtener el userId
}

interface CardForSelector {
  id: string;
  title: string;
}

interface AnalyticsEvent {
  id: string;
  type: 'view' | 'click';
  timestamp: number;
  userAgent?: string;
  linkId?: string;
  linkUrl?: string;
}

interface ProcessedData {
  totalViews: number;
  totalClicks: number;
  ctr: number;
  viewsPerDay: { date: string; views: number }[];
  clicksPerLink: { title: string; url: string; clicks: number }[];
}

interface Card {
  id: string;
  title: string;
  links: { id: string; title: string; url: string }[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const Analytics: React.FC<AnalyticsProps> = ({ userData }) => {
  const { user } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<ProcessedData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const userId = userData?.uid;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const cardsRef = collection(db, 'cards');
    const q = query(cardsRef, where("userId", "==", user.uid));

    getDocs(q)
      .then((querySnapshot) => {
        const userCards = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Card[];
        setCards(userCards);
        if (userCards.length > 0) {
          setSelectedCardId(userCards[0].id);
        } else {
          setLoading(false); 
        }
      })
      .catch((err) => {
        console.error("Error fetching user cards:", err);
        setError("Error al cargar tus tarjetas.");
        setLoading(false);
      });
  }, [user]);

  const processAnalyticsData = useCallback((events: AnalyticsEvent[], card: Card | undefined): ProcessedData => {
    console.log(`Procesando ${events.length} eventos para el rango: ${timeRange}`);
    const now = Date.now();
    let startTime = 0;

    switch (timeRange) {
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        startTime = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
      default:
        startTime = 0; 
    }

    const filteredEvents = events.filter(event => event.timestamp >= startTime);
    console.log(`${filteredEvents.length} eventos después de filtrar por tiempo.`);

    let totalViews = 0;
    let totalClicks = 0;
    const viewsPerDayMap: { [key: string]: number } = {};
    const clicksPerLinkMap: { [key: string]: { title: string; url: string; clicks: number } } = {};

    const linkIdToTitleMap = card?.links?.reduce((acc, link) => {
        acc[link.id] = link.title;
        return acc;
    }, {} as { [key: string]: string }) || {};

    filteredEvents.forEach(event => {
      const date = new Date(event.timestamp).toLocaleDateString('es-ES');
      
      if (event.type === 'view') {
        totalViews++;
        viewsPerDayMap[date] = (viewsPerDayMap[date] || 0) + 1;
      } else if (event.type === 'click' && event.linkId && event.linkUrl) {
        totalClicks++;
        const linkTitle = linkIdToTitleMap[event.linkId] || event.linkUrl; 
        if (!clicksPerLinkMap[event.linkId]) {
          clicksPerLinkMap[event.linkId] = { title: linkTitle, url: event.linkUrl, clicks: 0 };
        }
        clicksPerLinkMap[event.linkId].clicks++;
      }
    });

    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

    const viewsPerDay = Object.entries(viewsPerDayMap)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime()); 

    const clicksPerLink = Object.values(clicksPerLinkMap).sort((a, b) => b.clicks - a.clicks); 

    return { totalViews, totalClicks, ctr, viewsPerDay, clicksPerLink };
  }, [timeRange]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedCardId || !user) return;

    setLoading(true);
    setError(null);
    setAnalyticsData(null);

    try {
      const cardRef = doc(db, 'cards', selectedCardId);
      const cardSnap = await getDoc(cardRef);
      const cardData = cardSnap.exists() ? { id: cardSnap.id, ...cardSnap.data() } as Card : undefined;

      if (!cardData) {
          throw new Error("No se encontró la tarjeta seleccionada.");
      }

      const eventsRef = collection(db, 'cards', selectedCardId, 'analyticsEvents');
      const qEvents = query(eventsRef, orderBy('timestamp', 'desc'));
      const eventsSnapshot = await getDocs(qEvents);
      const events = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp: number;
        if (data.timestamp?.toDate) {
          timestamp = data.timestamp.toDate().getTime();
        } else if (typeof data.timestamp === 'number') {
          timestamp = data.timestamp;
        } else {
          console.warn('Timestamp inválido encontrado:', data.timestamp);
          timestamp = Date.now(); 
        }
        return {
            id: doc.id,
            ...data,
            timestamp: timestamp,
        } as AnalyticsEvent;
       });

      console.log(`Eventos crudos cargados para ${selectedCardId}:`, events.length);

      const processed = processAnalyticsData(events, cardData);
      setAnalyticsData(processed);

    } catch (err: any) {
      console.error("Error loading analytics data:", err);
      setError(`Error al cargar los datos de analíticas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCardId, user, processAnalyticsData]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  const formatCTR = (ctr: number) => {
    return ctr.toFixed(2) + '%';
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2 className="analytics-title">Análisis de la Tarjeta</h2>
        {cards.length > 0 && (
          <div className="card-selector-container">
             <label htmlFor="card-select">Selecciona una tarjeta:</label>
             <select
                id="card-select"
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                disabled={loading}
             >
               {cards.map(card => (
                 <option key={card.id} value={card.id}>{card.title}</option>
               ))}
             </select>
          </div>
        )}
      </div>
       <div className="time-selector">
           <button onClick={() => handleTimeRangeChange('7d')} className={timeRange === '7d' ? 'active' : ''} disabled={loading}>Last 7 days</button> 
           <button onClick={() => handleTimeRangeChange('30d')} className={timeRange === '30d' ? 'active' : ''} disabled={loading}>Last month</button>
           <button onClick={() => handleTimeRangeChange('90d')} className={timeRange === '90d' ? 'active' : ''} disabled={loading}>Last 90 days</button>
           <button onClick={() => handleTimeRangeChange('all')} className={timeRange === 'all' ? 'active' : ''} disabled={loading}>All time</button>
       </div>

      {loading && <div className="analytics-loading">Cargando datos...</div>}
      {error && <div className="analytics-error">{error}</div>}
      {!loading && !error && !analyticsData && cards.length > 0 && (
        <div className="analytics-no-data">Selecciona una tarjeta para ver sus analíticas o no hay datos para el periodo seleccionado.</div>
      )}
      {!loading && !error && cards.length === 0 && (
          <div className="analytics-no-data">No tienes tarjetas creadas todavía. Crea una para empezar a ver analíticas.</div>
      )}

      {analyticsData && !loading && (
        <div className="analytics-grid"> 
          <div className="kpi-card kpi-views">
            <div className="kpi-icon-container"><FiUsers size={24} /></div>
            <div className="kpi-content">
                <div className="kpi-title">Total Views</div>
                <div className="kpi-value">{analyticsData.totalViews}</div>
                <div className="kpi-change placeholder">+0.0% from last period</div> 
            </div>
          </div>
          <div className="kpi-card kpi-clicks">
             <div className="kpi-icon-container"><FiMousePointer size={24} /></div>
             <div className="kpi-content">
                <div className="kpi-title">Total Clicks</div>
                <div className="kpi-value">{analyticsData.totalClicks}</div>
                <div className="kpi-change placeholder">+0.0% from last period</div>
             </div>
          </div>
          <div className="kpi-card kpi-ctr">
             <div className="kpi-icon-container"><FiTarget size={24} /></div>
             <div className="kpi-content">
                <div className="kpi-title">Click-Through Rate</div>
                <div className="kpi-value">{formatCTR(analyticsData.ctr)}</div>
                 <div className="kpi-change placeholder">vs last period</div>
             </div>
          </div>

          {analyticsData.viewsPerDay.length > 0 && (
            <div className="chart-container main-chart"> 
              <h3>Visitas por Día</h3> 
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.viewsPerDay} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false}/>
                  <XAxis 
                    dataKey="date" 
                    stroke="#aaa" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                     stroke="#aaa" 
                     fontSize={12} 
                     tickLine={false} 
                     axisLine={false}
                     tickFormatter={(value) => `${value}`}
                   />
                  <Tooltip
                     cursor={{fill: '#55555550'}}
                     contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px' }}
                     labelStyle={{ color: '#eee' }}
                     itemStyle={{ color: '#eee' }}
                  />
                  <Bar dataKey="views" fill="#ff6f00" name="Visitas" barSize={20} radius={[4, 4, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {analyticsData.clicksPerLink.length > 0 && (
             <div className="table-container link-table"> 
               <h3>Rendimiento de Enlaces</h3>
               <div className="table-wrapper">
                   <table className="analytics-table">
                     <thead>
                       <tr>
                         <th>Título del Enlace</th>
                         <th>URL</th>
                         <th className="numeric">Clics</th>
                       </tr>
                     </thead>
                     <tbody>
                       {analyticsData.clicksPerLink.map((linkData, index) => (
                         <tr key={linkData.url + index}> 
                           <td>{linkData.title}</td>
                           <td><span className="text-truncate" title={linkData.url}>{linkData.url}</span></td>
                           <td className="numeric">{linkData.clicks}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
             </div>
          )}

           {analyticsData.viewsPerDay.length === 0 && analyticsData.clicksPerLink.length === 0 && (
               <div className="analytics-no-data no-chart-data"> No hay datos de visitas o clics para mostrar en gráficos o tablas para el periodo seleccionado.</div>
           )}

        </div>
      )}
    </div>
  );
};

export default Analytics; 