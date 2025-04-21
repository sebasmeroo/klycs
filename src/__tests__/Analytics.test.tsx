import { fetchFirestoreAnalyticsData } from '../components/dashboard/Analytics';
import { jest, describe, test, expect } from '@jest/globals';

// Mock de todos los módulos necesarios
jest.mock('../firebase/config', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'testUserId' }
  }
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mocked-collection'),
  query: jest.fn(() => 'mocked-query'),
  where: jest.fn(() => 'mocked-where'),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] }))
}));

describe('fetchFirestoreAnalyticsData', () => {
  // Mock functions
  const mockSetLoading = jest.fn();
  const mockSetData = jest.fn();
  const mockSetError = jest.fn();
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  test('llama a las funciones correctas al procesar datos', async () => {
    // Configurar mock para getDocs
    const mockFirestore = require('firebase/firestore');
    
    // Ejecutar la función con tipos 'any' para evitar errores de typescript
    await fetchFirestoreAnalyticsData(
      {} as any, // db
      { uid: 'testUserId' } as any, // user 
      '7d', 
      'all',
      mockSetLoading,
      mockSetData,
      mockSetError
    );
    
    // Verificar que se llamaron las funciones esperadas
    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(mockSetData).toHaveBeenCalled();
    expect(mockFirestore.collection).toHaveBeenCalled();
    expect(mockFirestore.query).toHaveBeenCalled();
    expect(mockFirestore.where).toHaveBeenCalled();
    expect(mockFirestore.getDocs).toHaveBeenCalled();
  });
  
  test('maneja errores correctamente', async () => {
    // Configurar mock para simular un error
    const mockFirestore = require('firebase/firestore');
    mockFirestore.getDocs.mockRejectedValueOnce(new Error('Test error'));
    
    // Ejecutar la función con tipos 'any'
    await fetchFirestoreAnalyticsData(
      {} as any,
      { uid: 'testUserId' } as any,
      '7d',
      null,
      mockSetLoading,
      mockSetData,
      mockSetError
    );
    
    // Verificar que se manejó el error correctamente
    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(mockSetError).toHaveBeenCalled();
    expect(mockSetData).not.toHaveBeenCalled();
  });
}); 