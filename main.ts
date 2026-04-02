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
console.error(`\n🔑 API前缀: ${apiKey}`);
console.error(`   完整路径示例: https://xxxxx-dn-phg-musi-xx.deno.dev/${apiKey}/api/music/url\n`);

new APIRoutes(app, handler, storage, engine, apiKey);

const port = Deno.env.get("PORT") || "8080";

console.error(`服务器运行在 http://localhost:${port}`);

const scripts = await storage.getAllScripts();
console.error(`找到 ${scripts.length} 个脚本，开始异步加载...`);

for (const script of scripts) {
  console.error(`[Debug] 脚本 ${script.name} rawScript 长度: ${script.rawScript?.length || 0}`);
}

let hasInitFailed = false;

const loadScriptPromises = scripts.map(async (script) => {
    try {
        await engine.loadScript(script);
        console.error(`✓ 脚本加载成功: ${script.name}`);
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

console.error('所有脚本加载完成');

const flushLogs = () => {
  console.error('\n[日志刷新] ========');
};

globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  console.error("\n========== [Unhandled Promise Rejection] ==========");
  console.error("原因:", event.reason);
  console.error("==================================================\n");
  flushLogs();
});

globalThis.addEventListener("error", (event: ErrorEvent) => {
  console.error("\n========== [Unhandled Error] ==========");
  console.error("消息:", event.message);
  console.error("========================================\n");
  flushLogs();
});

try {
    await app.listen({ port: Number(port) });
} catch (error) {
    console.error(`服务器启动失败:`, error);
}
