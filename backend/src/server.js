import { createApp } from "./app.js";
import { startRoomMaintenanceLoop } from "./services/roomService.js";

const app = createApp();
const port = process.env.PORT || 3001;

startRoomMaintenanceLoop();

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
