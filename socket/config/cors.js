function applyCors(app, env) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (env.nodeEnv !== "production") {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    } else if (origin && env.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    next();
  });
}

module.exports = {
  applyCors,
};
