import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill de TextEncoder y TextDecoder para el entorno JSDOM
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any
}

// Polyfill de fetch, Request, Response y Headers para JSDOM en Node.js
// JSDOM no los expone globalmente de forma automática en el sandbox de Jest
if (typeof global.fetch === 'undefined') {
  // Intentar heredar de los globales nativos de Node.js (Node 18+)
  const nodeGlobal = global as any
  if (nodeGlobal.fetch) {
    global.fetch = nodeGlobal.fetch
    global.Request = nodeGlobal.Request
    global.Response = nodeGlobal.Response
    global.Headers = nodeGlobal.Headers
  }
} else {
  // Asegurar que Request, Response y Headers estén definidos si fetch ya lo está
  const nodeGlobal = global as any
  if (typeof global.Request === 'undefined' && nodeGlobal.Request) {
    global.Request = nodeGlobal.Request
  }
  if (typeof global.Response === 'undefined' && nodeGlobal.Response) {
    global.Response = nodeGlobal.Response
  }
  if (typeof global.Headers === 'undefined' && nodeGlobal.Headers) {
    global.Headers = nodeGlobal.Headers
  }
}

// Mock de matchMedia (no implementado en jsdom de forma nativa)
// Esto evita advertencias y errores en componentes de Radix UI o Tailwind CSS
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // obsoleto
    removeListener: jest.fn(), // obsoleto
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
