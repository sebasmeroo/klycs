import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format, subDays, parse, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportOptions {
  userId: string;
  cardId?: string | null;
  startDate?: Date;
  endDate?: Date;
  format: 'csv' | 'json';
  dataType: 'views' | 'clicks' | 'all';
}

interface AnalyticsRecord {
  timestamp: Date;
  profileId: string;
  cardId?: string | null;
  linkId?: string | null;
  linkUrl?: string | null;
  referer: string;
  device: string;
  browser: string;
  os: string;
  country: string;
}

/**
 * Servicio para exportar datos de analíticas en diferentes formatos
 */
export const AnalyticsExportService = {
  /**
   * Exporta datos de analíticas según los filtros especificados
   */
  async exportData(options: ExportOptions): Promise<string | object | null> {
    try {
      const records = await this.fetchAnalyticsData(options);
      
      if (records.length === 0) {
        return null;
      }
      
      return options.format === 'csv' 
        ? this.generateCSV(records) 
        : this.generateJSON(records);
    } catch (error) {
      console.error('Error al exportar datos de analíticas:', error);
      throw new Error('No se pudieron exportar los datos de analíticas');
    }
  },
  
  /**
   * Recupera los datos de analíticas de Firestore según los filtros
   */
  async fetchAnalyticsData(options: ExportOptions): Promise<AnalyticsRecord[]> {
    const allRecords: AnalyticsRecord[] = [];
    
    // Buscar vistas de perfil si se solicitan
    if (options.dataType === 'views' || options.dataType === 'all') {
      const viewsRecords = await this.fetchProfileViews(options);
      allRecords.push(...viewsRecords);
    }
    
    // Buscar clics en enlaces si se solicitan
    if (options.dataType === 'clicks' || options.dataType === 'all') {
      const clicksRecords = await this.fetchLinkClicks(options);
      allRecords.push(...clicksRecords);
    }
    
    // Ordenar los registros por fecha (más reciente primero)
    return allRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },
  
  /**
   * Recupera los datos de vistas de perfil
   */
  async fetchProfileViews(options: ExportOptions): Promise<AnalyticsRecord[]> {
    let viewsQuery;
    
    if (options.cardId && options.cardId !== 'all') {
      viewsQuery = query(
        collection(db, 'profileViews'),
        where('profileId', '==', options.userId),
        where('cardId', '==', options.cardId)
      );
    } else {
      viewsQuery = query(
        collection(db, 'profileViews'),
        where('profileId', '==', options.userId)
      );
    }
    
    const snapshot = await getDocs(viewsQuery);
    
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date();
        
        // Filtrar por rango de fechas si se especifica
        if (options.startDate && options.endDate) {
          if (!isWithinInterval(timestamp, { 
            start: options.startDate,
            end: options.endDate
          })) {
            return null;
          }
        }
        
        return {
          timestamp,
          profileId: data.profileId,
          cardId: data.cardId || null,
          referer: data.referer || 'directo',
          device: data.device || 'desconocido',
          browser: data.browser || 'desconocido',
          os: data.os || 'desconocido',
          country: data.country || 'desconocido'
        };
      })
      .filter(record => record !== null) as AnalyticsRecord[];
  },
  
  /**
   * Recupera los datos de clics en enlaces
   */
  async fetchLinkClicks(options: ExportOptions): Promise<AnalyticsRecord[]> {
    let clicksQuery;
    
    if (options.cardId && options.cardId !== 'all') {
      clicksQuery = query(
        collection(db, 'linkClicks'),
        where('profileId', '==', options.userId),
        where('cardId', '==', options.cardId)
      );
    } else {
      clicksQuery = query(
        collection(db, 'linkClicks'),
        where('profileId', '==', options.userId)
      );
    }
    
    const snapshot = await getDocs(clicksQuery);
    
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date();
        
        // Filtrar por rango de fechas si se especifica
        if (options.startDate && options.endDate) {
          if (!isWithinInterval(timestamp, { 
            start: options.startDate,
            end: options.endDate
          })) {
            return null;
          }
        }
        
        return {
          timestamp,
          profileId: data.profileId,
          cardId: data.cardId || null,
          linkId: data.linkId || null,
          linkUrl: data.linkUrl || null,
          referer: data.referer || 'directo',
          device: data.device || 'desconocido',
          browser: data.browser || 'desconocido',
          os: data.os || 'desconocido',
          country: data.country || 'desconocido'
        };
      })
      .filter(record => record !== null) as AnalyticsRecord[];
  },
  
  /**
   * Genera un archivo CSV con los datos de analíticas
   */
  generateCSV(records: AnalyticsRecord[]): string {
    if (records.length === 0) return '';
    
    // Determinar encabezados según el tipo de registros
    const hasLinkData = records.some(r => r.linkId !== undefined);
    
    // Crear encabezados
    const headers = [
      'Fecha',
      'Hora',
      'Perfil',
      'Tarjeta',
      ...(hasLinkData ? ['Enlace ID', 'URL'] : []),
      'Origen',
      'Dispositivo',
      'Navegador',
      'Sistema Operativo',
      'País'
    ];
    
    // Crear contenido CSV
    const csvContent = records.map(record => {
      const date = format(record.timestamp, 'dd/MM/yyyy', { locale: es });
      const time = format(record.timestamp, 'HH:mm:ss');
      
      const row = [
        date,
        time,
        record.profileId,
        record.cardId || '-',
        ...(hasLinkData ? [record.linkId || '-', record.linkUrl || '-'] : []),
        record.referer,
        record.device,
        record.browser,
        record.os,
        record.country
      ];
      
      // Escapar comas y comillas en los valores
      return row.map(val => {
        const strVal = String(val);
        return strVal.includes(',') || strVal.includes('"') 
          ? `"${strVal.replace(/"/g, '""')}"` 
          : strVal;
      }).join(',');
    });
    
    // Unir encabezados y contenido
    return [headers.join(','), ...csvContent].join('\n');
  },
  
  /**
   * Genera un objeto JSON con los datos de analíticas
   */
  generateJSON(records: AnalyticsRecord[]): object {
    return {
      generatedAt: new Date().toISOString(),
      totalRecords: records.length,
      data: records.map(record => ({
        ...record,
        timestamp: record.timestamp.toISOString(),
      }))
    };
  },
  
  /**
   * Descarga el archivo generado en el navegador
   */
  downloadFile(data: string | object, filename: string, format: 'csv' | 'json'): void {
    const contentType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
    const content = format === 'csv' ? data : JSON.stringify(data, null, 2);
    
    // Crear un blob con los datos
    const blob = new Blob([content as string], { type: contentType });
    
    // Crear URL para el blob
    const url = URL.createObjectURL(blob);
    
    // Crear un elemento de enlace para descargar
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Simular clic para iniciar descarga
    document.body.appendChild(link);
    link.click();
    
    // Limpiar
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
};

export default AnalyticsExportService; 