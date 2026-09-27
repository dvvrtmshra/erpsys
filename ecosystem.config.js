module.exports = {
  apps: [
    {
      name: 'erp-backend',
      script: 'backend/src/index.js',
      env: { NODE_ENV: 'production' },
    },
  ],
};
