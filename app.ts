import { Router } from "./router.ts";

export class Application {
  private router: Router;
  private middlewares: Array<(ctx: any, next: () => Promise<void>) => void> = [];

  constructor() {
    this.router = new Router();
  }

  use(middleware: (ctx: any, next: () => Promise<void>) => void) {
    this.middlewares.push(middleware);
  }

  getRouter(): Router {
    return this.router;
  }

  async listen(options: { port: number; hostname?: string }) {
    const server = Deno.listen(options);

    console.log(`✅ 服务器已启动，监听 ${options.hostname || "0.0.0.0"}:${options.port}`);

    for await (const conn of server) {
      this.handleConnection(conn);
    }
  }

  private async handleConnection(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);

    try {
      for await (const event of httpConn) {
        await this.handleRequest(event);
      }
    } catch (error) {
      console.error("连接处理错误:", error);
    }
  }

  private async handleRequest(event: Deno.RequestEvent) {
    const ctx = {
      req: event.request,
      res: null as Response | null,
      params: {},
      query: {},
      body: null,
    };

    try {
      let url;
      try {
        url = new URL(event.request.url);
      } catch (urlError) {
        console.error("URL解析错误:", urlError, "Request URL:", event.request.url);
        ctx.res = new Response("Invalid URL", { status: 400 });
        await event.respondWith(ctx.res);
        return;
      }
      
      ctx.query = Object.fromEntries(url.searchParams);

      const match = this.router.match(event.request.method, url.pathname);

      if (!match) {
        ctx.res = new Response("Not Found", { status: 404 });
        await event.respondWith(ctx.res);
        return;
      }

      ctx.params = match.params;

      let index = 0;
      const dispatch = async (i: number): Promise<void> => {
        if (i > this.middlewares.length) {
          ctx.res = await this.router.handle(ctx);
          await event.respondWith(ctx.res);
          return;
        }

        if (i < this.middlewares.length) {
          await this.middlewares[i](ctx, () => dispatch(i + 1));
        } else {
          ctx.res = await this.router.handle(ctx);
          await event.respondWith(ctx.res);
        }
      };

      await dispatch(0);
    } catch (error) {
      console.error("请求处理错误:", error);
      ctx.res = new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
      await event.respondWith(ctx.res);
    }
  }
}
