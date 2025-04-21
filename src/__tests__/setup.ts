// Este archivo se ejecutará antes de cada prueba
// Aquí se pueden configurar mocks globales o extender las expectativas de Jest
import { jest } from '@jest/globals';

// Añadir un polyfill para fetch si es necesario
global.fetch = jest.fn(() => 
  Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    ok: true
  } as Response)
);

// Extender el objeto de ventana para las pruebas
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Definir mocks para elementos DOM que pueden no estar disponibles
if (typeof window.URL.createObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', { value: jest.fn() });
}

// Suprimir errores de consola durante las pruebas
global.console = {
  ...console,
  // error: jest.fn(),
  // warn: jest.fn(),
  // log: jest.fn(),
}; 