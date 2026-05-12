module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
    ],
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './shared',
            from: './web',
            message: 'shared/ cannot import from web/'
          },
          {
            target: './shared',
            from: './worker',
            message: 'shared/ cannot import from worker/'
          }
        ]
      }
    ]
  }
};
