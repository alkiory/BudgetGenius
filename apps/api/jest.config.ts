import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

export default {
  rootDir: './',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s', // Collect coverage from all TS/JS files
    '!src/main.ts', // Exclude entry point
    '!src/**/*.module.ts', // Exclude NestJS modules
    '!src/**/*.dto.ts', // Exclude DTOs
    '!src/**/*.entity.ts', // Exclude database entities
    '!src/config/**', // Exclude configuration files
    '!src/**/index.ts', // Exclude index files
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};
