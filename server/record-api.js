import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const recordFile = process.env.RECORD_FILE || path.join(rootDir, 'data', 'record.json')
const port = Number(process.env.PORT || process.env.RECORD_API_PORT || 8787)

const defaultRecord = {
  difficulty: '—',
  name: 'Aucun joueur',
  score: 0,
  updatedAt: null,
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function sanitizePlayerName(name) {
  return String(name || '').trim().slice(0, 24) || 'Joueur anonyme'
}

function normalizeRecord(record) {
  return {
    difficulty: String(record?.difficulty || '—').slice(0, 24),
    name: sanitizePlayerName(record?.name || defaultRecord.name),
    score: Math.max(0, Math.floor(Number(record?.score || 0))),
    updatedAt: record?.updatedAt || null,
  }
}

async function readRecord() {
  try {
    const content = await fs.readFile(recordFile, 'utf8')
    return normalizeRecord(JSON.parse(content))
  } catch {
    return defaultRecord
  }
}

async function writeRecord(record) {
  const normalizedRecord = normalizeRecord(record)
  await fs.mkdir(path.dirname(recordFile), { recursive: true })
  await fs.writeFile(recordFile, `${JSON.stringify(normalizedRecord, null, 2)}\n`)
  return normalizedRecord
}

async function parseJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

async function handleRecordRequest(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Origin': '*',
    })
    response.end()
    return
  }

  if (request.method === 'GET') {
    sendJson(response, 200, await readRecord())
    return
  }

  if (request.method === 'POST') {
    try {
      const candidateRecord = normalizeRecord(await parseJsonBody(request))
      const currentRecord = await readRecord()
      const winningRecord = candidateRecord.score > currentRecord.score
        ? await writeRecord({ ...candidateRecord, updatedAt: candidateRecord.updatedAt || new Date().toISOString() })
        : currentRecord

      sendJson(response, 200, winningRecord)
    } catch {
      sendJson(response, 400, { error: 'Record invalide' })
    }
    return
  }

  sendJson(response, 405, { error: 'Méthode non supportée' })
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const pathname = decodeURIComponent(url.pathname)
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = path.normalize(path.join(distDir, requestedPath))
  const safeFilePath = filePath.startsWith(distDir) ? filePath : path.join(distDir, 'index.html')

  try {
    const content = await fs.readFile(safeFilePath)
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(safeFilePath)] || 'application/octet-stream' })
    response.end(content)
  } catch {
    try {
      const fallback = await fs.readFile(path.join(distDir, 'index.html'))
      response.writeHead(200, { 'Content-Type': mimeTypes['.html'] })
      response.end(fallback)
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Build introuvable. Lance npm run build avant npm run start.')
    }
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (url.pathname === '/api/record' || url.pathname === '/record') {
    await handleRecordRequest(request, response)
    return
  }

  await serveStatic(request, response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`mon jeu+ server ready on http://0.0.0.0:${port}`)
  console.log(`Record API: http://0.0.0.0:${port}/api/record`)
})
