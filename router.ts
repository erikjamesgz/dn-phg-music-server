type RouteHandler = (ctx: any) => Promise<Response> | Response;
type RouteMatch = {
  handler: RouteHandler;
  params: Record<string, string>;
};

interface Route {
  method: string;
  originalPath: string;
  regexPath: string;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  constructor() {
    this.initRoutes();
  }

  private initRoutes() {}

  get(path: string, handler: RouteHandler) {
    this.addRoute("GET", path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.addRoute("POST", path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.addRoute("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    this.addRoute("DELETE", path, handler);
  }

  private addRoute(method: string, path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const regexPath = path.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });

    this.routes.push({
      method,
      originalPath: path,
      regexPath,
      paramNames,
      handler: async (ctx: any) => {
        ctx.params = {};
        return await handler(ctx);
      },
    });
  }

  match(method: string, pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = this.matchPath(route, pathname);
      if (match) {
        return { handler: route.handler, params: match.params };
      }
    }
    return null;
  }

  private matchPath(route: Route, pathname: string): { params: Record<string, string> } | null {
    const regex = new RegExp(`^${route.regexPath}$`);
    const match = pathname.match(regex);

    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1]);
      });
      return { params };
    }
    return null;
  }

  async handle(ctx: any): Promise<Response> {
    const url = new URL(ctx.req.url);
    const method = ctx.req.method;
    const pathname = url.pathname;

    const match = this.match(method, pathname);
    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    try {
      ctx.params = match.params;
      const response = await match.handler(ctx);

      if (response instanceof Response) {
        return response;
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("路由处理错误:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
