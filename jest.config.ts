import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Proporciona la ruta a tu aplicación Next.js para cargar next.config.js y los archivos .env en el entorno de pruebas
  dir: './',
})

// Configuración personalizada de Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jest-environment-jsdom',
  // Configuración de inicialización para extender jest-dom antes de cada prueba
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Mapeo de alias para TypeScript
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

// Se exporta createJestConfig de esta forma para asegurar que next/jest cargue la configuración de Next.js
export default createJestConfig(config)
