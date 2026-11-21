/** One rule of a `_headers` file: a path pattern and the header lines that go with it. */
export interface HeaderRule {
  pattern: string
  headers: [string, string][]
}

/** Reads a `_headers` file: a path on its own line, then indented `Name: value` lines. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  let current: HeaderRule | null = null
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] }
      rules.push(current)
    } else if (current !== null) {
      const at = line.indexOf(':')
      if (at > 0) current.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()])
    }
  }
  return rules
}

/** The headers that apply to a path: `/*` matches everything, `/folder/*` a folder, anything else the exact path. */
export function headersFor(rules: HeaderRule[], path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rules) {
    const hit = r.pattern === path || r.pattern === '/*' || (r.pattern.endsWith('/*') && path.startsWith(r.pattern.slice(0, -1)))
    if (!hit) continue
    for (const [k, v] of r.headers) out[k] = out[k] === undefined ? v : `${out[k]}, ${v}`
  }
  return out
}
