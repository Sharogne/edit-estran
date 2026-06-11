/**
 * PM2 configuration for the OVH VPS (see skill: deploy-ovh).
 * Start:  pm2 start ecosystem.config.cjs && pm2 save
 * Deploy: pm2 reload edit  (zero-downtime reload after a build)
 */
module.exports = {
  apps: [
    {
      name: "edit",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
