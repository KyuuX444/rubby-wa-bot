module.exports = {
  apps: [
    {
      name: 'whatsapp-bot-manager',
      script: './dist/server/index.js',
      cwd: '/root/jadibot',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/root/jadibot/logs/pm2-error.log',
      out_file: '/root/jadibot/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
