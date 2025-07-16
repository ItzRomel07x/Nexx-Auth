declare module "vite" {
  interface ServerOptions {
    middlewareMode?: boolean;
    hmr?: { server: any };
    allowedHosts?: boolean;
    host?: boolean;
  }
}
