import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../../services/AnalyticsService';
import './LiveViewers.css';

interface LiveViewerData {
  id: string;
  device?: string;
  browser?: string;
  country?: string;
  os?: string;
  lastActive?: any;
  cardId?: string;
  [key: string]: any;
}

interface LiveViewersProps {
  profileId: string;
  cardId?: string | null;
  title?: string;
}

const LiveViewers: React.FC<LiveViewersProps> = ({ profileId, cardId, title = 'Visitantes en tiempo real' }) => {
  const [viewers, setViewers] = useState<LiveViewerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!profileId) return;

    setLoading(true);
    
    // Suscribirse a visitantes activos
    const unsubscribe = AnalyticsService.subscribeToActiveViewers(
      profileId,
      cardId || null,
      (activeViewers) => {
        setViewers(activeViewers);
        setLoading(false);
      }
    );
    
    // Limpiar suscripción al desmontar el componente
    return () => {
      unsubscribe();
    };
  }, [profileId, cardId]);

  // Función para devolver el icono adecuado según el dispositivo
  const getDeviceIcon = (device: string = 'unknown') => {
    const deviceLower = device.toLowerCase();
    
    if (deviceLower === 'mobile') return '📱';
    if (deviceLower === 'tablet') return '📋';
    if (deviceLower === 'desktop') return '💻';
    
    return '🖥️';
  };

  // Función para formatear el tiempo de la última actividad
  const formatLastActive = (timestamp: any): string => {
    if (!timestamp) return 'Desconocido';
    
    try {
      const date = timestamp.toDate();
      return date.toLocaleTimeString();
    } catch (e) {
      return 'Hace un momento';
    }
  };

  if (loading) {
    return (
      <div className="live-viewers-container">
        <h3>{title}</h3>
        <div className="loading-indicator">Cargando visitantes...</div>
      </div>
    );
  }

  return (
    <div className="live-viewers-container">
      <h3>{title} {viewers.length > 0 && <span className="viewer-count">{viewers.length}</span>}</h3>
      
      {viewers.length === 0 ? (
        <div className="no-viewers-message">
          No hay visitantes activos en este momento
        </div>
      ) : (
        <div className="viewers-list">
          {viewers.map(viewer => (
            <div key={viewer.id} className="viewer-item">
              <div className="viewer-icon">
                {getDeviceIcon(viewer.device)}
              </div>
              <div className="viewer-details">
                <div className="viewer-location">
                  {viewer.country || 'Ubicación desconocida'}
                </div>
                <div className="viewer-browser">
                  {viewer.browser || 'Navegador desconocido'} en {viewer.os || 'OS desconocido'}
                </div>
                <div className="viewer-time">
                  Activo desde {formatLastActive(viewer.lastActive)}
                </div>
              </div>
              {viewer.cardId && viewer.cardId !== 'profile' && (
                <div className="viewer-card-badge">
                  Viendo: {viewer.cardId}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveViewers; 