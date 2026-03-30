module.exports = {
  apps: [{
    name: "threely-discord-bot",
    script: "src/index.js",
    env: {
      NODE_ENV: "production",
    },
    max_restarts: 10,
    restart_delay: 5000,
  }],
};
