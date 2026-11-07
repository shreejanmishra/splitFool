import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { stripMongoOperators } from '../src/middleware/sanitize.js'

const app = createApp()

describe('foundation', () => {
  it('reports health with database status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, db: 'up' })
  })

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
  })

  it('rejects state-changing requests from foreign origins', async () => {
    const res = await request(app).post('/api/anything').set('Origin', 'https://evil.example').set('x-sf-request', '1')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('csrf_origin')
  })

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app).post('/api/anything').set('Origin', 'http://localhost:5173')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('csrf_header')
  })

  it('lets allowed-origin requests with the header through CSRF', async () => {
    const res = await request(app)
      .post('/api/anything')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
    expect(res.status).toBe(404) // passed CSRF, no route
  })

  it('only allows configured origins via CORS', async () => {
    const ok = await request(app).options('/api/health').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST')
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const bad = await request(app).options('/api/health').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST')
    expect(bad.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects malformed and oversized JSON bodies', async () => {
    const malformed = await request(app)
      .post('/api/x')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .set('Content-Type', 'application/json')
      .send('{bad json')
    expect(malformed.status).toBe(400)

    const big = await request(app)
      .post('/api/x')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .send({ blob: 'x'.repeat(200_000) })
    expect(big.status).toBe(413)
  })
})

describe('stripMongoOperators', () => {
  it('removes operator, dotted and prototype keys recursively', () => {
    const input = JSON.parse(
      '{"name":"a","$where":"1","nested":{"$gt":"","a.b":1,"ok":true},"list":[{"$ne":1,"v":2}],"__proto__":{"admin":true}}',
    )
    expect(stripMongoOperators(input)).toEqual({ name: 'a', nested: { ok: true }, list: [{ v: 2 }] })
    expect(({} as Record<string, unknown>).admin).toBeUndefined()
  })
})
