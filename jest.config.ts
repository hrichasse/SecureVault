import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/unit/**/*.test.ts',
    '<rootDir>/src/__tests__/integration/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/modules/**/*.ts',
    'src/app/api/**/*.ts',
    '!src/**/*.d.ts',
  ],
}

export default createJestConfig(config)
