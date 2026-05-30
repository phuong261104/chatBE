module.exports = {
  apps: [
    {
      name: "chatbe",
      script: "dist/index.js",
      instances: "1",
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
      },
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true,
      exp_backoff_restart_delay: 100,
    },
  ],
};
