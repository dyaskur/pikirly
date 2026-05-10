module.exports = {
  apps: [
    {
      name: 'kahoot-backend',
      cwd: './backend',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/server.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0',
      },
      max_memory_restart: '500M',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
