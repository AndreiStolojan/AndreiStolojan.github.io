// Serves the repo root the way GitHub Pages does: /barb/ serves barb/index.html, /barb redirects to /barb/, and a
// missing path gets 404.html with status 404. dev/ itself is skipped, like a folder that does not exist.
// Run: bun dev/serve.ts [port]   (default 8000)
import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const root = join(import.meta.dir, '..');

/** Starts the server and returns it; port 0 picks a free port. */
export function serve(port: number) {
  return Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      const path = normalize(decodeURIComponent(url.pathname));
      if (path.startsWith('/dev/') || path.startsWith('/.git')) return notFound();
      const file = join(root, path);
      if (!file.startsWith(root) || !existsSync(file)) return notFound();
      if (statSync(file).isDirectory()) {
        if (!path.endsWith('/')) return Response.redirect(`${url.origin}${path}/`, 301);
        return existsSync(join(file, 'index.html')) ? new Response(Bun.file(join(file, 'index.html'))) : notFound();
      }
      return new Response(Bun.file(file));
    },
  });
}

const notFound = () => new Response(Bun.file(join(root, '404.html')), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

if (import.meta.main) {
  const server = serve(Number(process.argv[2] ?? 8000));
  console.log(`http://localhost:${server.port}`);
}
