import { Application } from "./app.ts";
import { ScriptEngine } from "./engine/script_engine.ts";
import { ScriptStorage } from "./storage/storage.ts";
import { APIRoutes } from "./routes/api.ts";
import { RequestHandler } from "./handler/request_handler.ts";

const app = new Application();
const storage = new ScriptStorage();
const engine = new ScriptEngine(storage);
const handler = new RequestHandler(engine, storage);

await storage.ready();

const apiKey = await storage.getApiKey();
console.log(`\n🔑 API前缀: /${apiKey}`);
console.log(`   完整路径示例: /${apiKey}/api/music/url\n`);

new APIRoutes(app, handler, storage, engine, apiKey);

const port = Deno.env.get("PORT") || "8080";

console.log(`服务器运行在 http://localhost:${port}`);

const scripts = await storage.getAllScripts();
console.log(`找到 ${scripts.length} 个脚本，开始异步加载...`);

let hasInitFailed = false;

const loadScriptPromises = scripts.map(async (script) => {
    try {
        await engine.loadScript(script);
        console.log(`✓ 脚本加载成功: ${script.name}`);
    } catch (error: any) {
        console.error(`✗ 脚本加载失败: ${script.name}`, error?.message || error);
        hasInitFailed = true;
    }
});

await Promise.all(loadScriptPromises);

if (hasInitFailed) {
    console.error('❌ 脚本初始化失败，服务器无法启动');
    Deno.exit(1);
}

console.log('所有脚本加载完成');

globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  console.error("\n========== [Unhandled Promise Rejection] ==========");
  console.error("原因:", event.reason);
  console.error("==================================================\n");
});

globalThis.addEventListener("error", (event: ErrorEvent) => {
  console.error("\n========== [Unhandled Error] ==========");
  console.error("消息:", event.message);
  console.error("========================================\n");
});

try {
    await app.listen({ port: Number(port) });
} catch (error) {
    console.error(`服务器启动失败:`, error);
}
