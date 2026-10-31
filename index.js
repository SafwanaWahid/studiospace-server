import { app } from "./app.js";
import { client } from "./db.js";
const server = app.listen(process.env.PORT || 5000, () =>
  console.log(`StudioSpace API running on port ${process.env.PORT || 5000}`),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await client.close();
    process.exit(0);
  }),
);
