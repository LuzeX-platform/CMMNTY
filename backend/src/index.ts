import "dotenv/config";
import { bouwApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4100);
const app = await bouwApp();

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`LuzeX Community draait op ${address}`);
});
