import http from "http";
import { app } from "./app";
import { tripActivationWorker } from "./services/trip-activation-worker";
import { tripOverdueWorker } from "./services/trip-overdue-worker";

const server = http.createServer(app);

// create server
server.listen(process.env.PORT, () => {
  console.log(`Server is connected with port ${process.env.PORT}`);
  
  // Start trip activation background worker
  tripActivationWorker.start();
  
  // Start trip overdue worker to mark failed trips
  tripOverdueWorker.start();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  tripActivationWorker.stop();
  tripOverdueWorker.stop();
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  tripActivationWorker.stop();
  tripOverdueWorker.stop();
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
