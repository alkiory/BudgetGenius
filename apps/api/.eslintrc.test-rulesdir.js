const path = require('path');
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: 'tsconfig.json', tsconfigRootDir: __dirname },
  rulesDir: [path.resolve(__dirname, '../../tools/eslint-rules')],
  rules: {
    'no-req-user-id': 'error',
  },
};
