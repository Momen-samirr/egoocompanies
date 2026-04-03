const express = require("express");
const { applyCors } = require("./config/cors");

function createApp(env) {
  const app = express();
  applyCors(app, env);
  app.use(express.json());
  return app;
}

module.exports = {
  createApp,
};
