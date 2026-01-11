import { Application } from "./app.ts";
import { ScriptEngine } from "./engine/script_engine.ts";
import { ScriptStorage } from "./storage/storage.ts";
import { APIRoutes } from "./routes/api.ts";
import { RequestHandler } from "./handler/request_handler.ts";

console.log("🚀 洛雪音乐第三方音源后台启动中...");

const app = new Application();
const storage = new ScriptStorage();
const engine = new ScriptEngine();
const handler = new RequestHandler(engine, storage);

new APIRoutes(app, handler, storage, engine);

const port = Deno.env.get("PORT") || 8080;
console.log(`🌐 服务器运行在 http://localhost:${port}`);

await app.listen({ port: Number(port) });
