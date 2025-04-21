import { AnalyticsService } from '../services/AnalyticsService';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock de las funciones de Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() }))
  },
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn()
}));

// Mock del navigator.userAgent
Object.defineProperty(window.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  configurable: true
});

describe('AnalyticsService', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
  });

  describe('recordProfileView', () => {
    test('debe registrar una vista de perfil correctamente', async () => {
      // Mock de la respuesta de getDoc
      const mockProfileDoc = {
        exists: jest.fn().mockReturnValue(true)
      };

      // Configurar respuestas de los mocks
      (getDoc as jest.Mock).mockResolvedValue(mockProfileDoc);
      (addDoc as jest.Mock).mockResolvedValue({ id: 'mockViewId' });
      (increment as jest.Mock).mockReturnValue('increment_value');
      
      // Valores de prueba
      const profileId = 'profile123';
      const cardId = 'card456';
      const referer = 'https://google.com';
      
      // Ejecutar la función
      await AnalyticsService.recordProfileView(profileId, cardId, referer);
      
      // Verificaciones
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(collection).toHaveBeenCalledWith(db, 'profileViews');
      
      // Verificar que se extrajo correctamente la información del dispositivo
      const addDocCall = (addDoc as jest.Mock).mock.calls[0][1];
      expect(addDocCall.profileId).toBe(profileId);
      expect(addDocCall.cardId).toBe(cardId);
      expect(addDocCall.referer).toBe(referer);
      expect(addDocCall.device).toBe('desktop');
      expect(addDocCall.browser).toBe('chrome');
      expect(addDocCall.os).toBe('windows');
      
      // Verificar actualización del contador de vistas
      expect(doc).toHaveBeenCalledWith(db, 'users', profileId);
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        totalViews: 'increment_value'
      });
    });
    
    test('debe manejar errores correctamente', async () => {
      // Espía en console.error
      const consoleSpy = jest.spyOn(console, 'error');
      consoleSpy.mockImplementation(() => {});
      
      // Forzar un error
      (addDoc as jest.Mock).mockRejectedValue(new Error('Error de prueba'));
      
      // Ejecutar la función
      await AnalyticsService.recordProfileView('profile123');
      
      // Verificar que se registró el error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error al registrar vista de perfil:',
        expect.any(Error)
      );
      
      // Restaurar console.error
      consoleSpy.mockRestore();
    });
  });
  
  describe('recordLinkClick', () => {
    test('debe registrar un clic en enlace correctamente', async () => {
      // Configurar mocks
      (addDoc as jest.Mock).mockResolvedValue({ id: 'mockClickId' });
      
      // Valores de prueba
      const profileId = 'profile123';
      const cardId = 'card456';
      const linkId = 'link789';
      const linkUrl = 'https://example.com';
      
      // Ejecutar la función
      await AnalyticsService.recordLinkClick(profileId, cardId, linkId, linkUrl);
      
      // Verificaciones
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(collection).toHaveBeenCalledWith(db, 'linkClicks');
      
      // Verificar datos del clic
      const addDocCall = (addDoc as jest.Mock).mock.calls[0][1];
      expect(addDocCall.profileId).toBe(profileId);
      expect(addDocCall.cardId).toBe(cardId);
      expect(addDocCall.linkId).toBe(linkId);
      expect(addDocCall.linkUrl).toBe(linkUrl);
    });
    
    test('debe manejar errores correctamente', async () => {
      // Espía en console.error
      const consoleSpy = jest.spyOn(console, 'error');
      consoleSpy.mockImplementation(() => {});
      
      // Forzar un error
      (addDoc as jest.Mock).mockRejectedValue(new Error('Error de prueba'));
      
      // Ejecutar la función
      await AnalyticsService.recordLinkClick('profile123', 'card456', 'link789', 'https://example.com');
      
      // Verificar que se registró el error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error al registrar clic de enlace:',
        expect.any(Error)
      );
      
      // Restaurar console.error
      consoleSpy.mockRestore();
    });
  });
  
  describe('extractDeviceInfo', () => {
    test('debe detectar un dispositivo móvil correctamente', () => {
      const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
      const result = AnalyticsService.extractDeviceInfo(mobileUA);
      
      expect(result.device).toBe('mobile');
      expect(result.browser).toBe('safari');
      expect(result.os).toBe('ios');
    });
    
    test('debe detectar un dispositivo de escritorio correctamente', () => {
      const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const result = AnalyticsService.extractDeviceInfo(desktopUA);
      
      expect(result.device).toBe('desktop');
      expect(result.browser).toBe('chrome');
      expect(result.os).toBe('windows');
    });
    
    test('debe detectar una tablet correctamente', () => {
      const tabletUA = 'Mozilla/5.0 (iPad; CPU OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
      const result = AnalyticsService.extractDeviceInfo(tabletUA);
      
      expect(result.device).toBe('tablet');
      expect(result.browser).toBe('safari');
      expect(result.os).toBe('ios');
    });
  });
}); 