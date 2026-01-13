import { Application } from "./app.ts";
import { ScriptEngine } from "./engine/script_engine.ts";
import { ScriptStorage } from "./storage/storage.ts";
import { APIRoutes } from "./routes/api.ts";
import { RequestHandler } from "./handler/request_handler.ts";

console.log("🚀 洛雪音乐第三方音源后台启动中...");

const originalUnhandledRejection = (globalThis as any).onunhandledrejection;
(globalThis as any).onunhandledrejection = (event: any) => {
    console.error(`🔍 全局未捕获的 Promise 错误:`, event.reason);
    event.preventDefault();
};

const app = new Application();
const storage = new ScriptStorage();
const engine = new ScriptEngine();
const handler = new RequestHandler(engine, storage);

await storage.ready();

const scripts = await storage.getAllScripts();
for (const script of scripts) {
    try {
        await engine.loadScript(script);
    } catch (error) {
        console.error(`❌ 加载脚本失败: ${script.name}`, error);
        console.log(`⚠️ 脚本加载时出现错误，但服务器将继续运行`);
    }
}
console.log(`✅ 已加载 ${scripts.length} 个脚本`);

new APIRoutes(app, handler, storage, engine);

const port = Deno.env.get("PORT") || 8080;

console.log(`🌐 服务器运行在 http://localhost:${port}`);

try {
    await app.listen({ port: Number(port) });
} catch (error) {
    console.error(`❌ 服务器启动失败:`, error);
}
