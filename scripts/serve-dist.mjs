// Serves the built app (dist/) with the headers of public/_headers, so the app can be tried with the same security
// headers as the live site before it is published. Usage: npm run build && npm run serve:dist [port]
// (Node strips the types of the imported .ts file itself.)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { headersFor, parseHeaders } from '../vite-plugins/headers.ts'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.argv[2] ?? 4175)
const rules = parseHeaders(await readFile(new URL('../public/_headers', import.meta.url), 'utf8'))

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.csv': 'text/csv; charset=utf-8',
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = normalize(join(root, path === '/' ? 'index.html' : path))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headersFor(rules, path) }).end(body)
  } catch {
    res.writeHead(404, headersFor(rules, path)).end('Not found')
  }
}).listen(port, () => console.log(`dist/ with public/_headers on http://localhost:${port}`))
