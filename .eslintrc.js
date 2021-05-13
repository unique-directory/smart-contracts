module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  env: {
    commonjs: true,
    jest: true,
    node: true
  },
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    'no-empty': 'off',
    'no-empty-function': 'off',
  },
};
