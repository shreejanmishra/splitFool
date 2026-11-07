import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { User, AuthIdentity, Session } from '../src/models/index.js'

const app = createApp()

// Helper: dev-login and return the cookie header for subsequent requests
async function devLogin(email = 'test@example.com', name = 'Test User') {
  const res = await request(app)
    .post('/api/auth/dev/login')
    .set('Origin', 'http://localhost:5173')
    .set('x-sf-request', '1')
    .send({ email, name })
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)

  const cookies = res.headers['set-cookie'] as unknown as string[]
  expect(cookies).toBeDefined()
  return { cookies, userId: res.body.userId as string }
}

// Helper: dev-login for android (returns tokens)
async function devLoginAndroid(email = 'android@example.com', name = 'Android User') {
  const res = await request(app)
    .post('/api/auth/dev/login')
    .set('Origin', 'http://localhost:5173')
    .set('x-sf-request', '1')
    .send({ email, name, platform: 'android' })
  expect(res.status).toBe(200)
  expect(res.body.accessToken).toBeDefined()
  expect(res.body.refreshToken).toBeDefined()
  return res.body as { accessToken: string; refreshToken: string }
}

beforeEach(async () => {
  await User.deleteMany({})
  await AuthIdentity.deleteMany({})
  await Session.deleteMany({})
})

describe('auth - dev login', () => {
  it('creates a user and sets a session cookie', async () => {
    const { cookies, userId } = await devLogin()
    expect(userId).toBeDefined()
    expect(cookies).toBeDefined()

    const user = await User.findById(userId)
    expect(user).not.toBeNull()
    expect(user!.email).toBe('test@example.com')

    const identity = await AuthIdentity.findOne({ userId })
    expect(identity).not.toBeNull()
    expect(identity!.provider).toBe('dev')

    const sessions = await Session.find({ userId })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.kind).toBe('web')
  })

  it('returns android tokens when platform=android', async () => {
    const { accessToken, refreshToken } = await devLoginAndroid()
    expect(accessToken).toBeTruthy()
    expect(refreshToken).toBeTruthy()
  })

  it('reuses an existing user on repeated login', async () => {
    const { userId: id1 } = await devLogin('same@test.com')
    const { userId: id2 } = await devLogin('same@test.com')
    expect(id1).toBe(id2)
  })
})

describe('auth - /me', () => {
  it('returns user data for an authenticated request', async () => {
    const { cookies } = await devLogin()
    const res = await request(app).get('/api/auth/me').set('Cookie', cookies)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('test@example.com')
  })

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('works with android bearer token', async () => {
    const { accessToken } = await devLoginAndroid()
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('android@example.com')
  })
})

describe('auth - sessions', () => {
  it('lists active sessions', async () => {
    const { cookies } = await devLogin()
    const res = await request(app).get('/api/auth/sessions').set('Cookie', cookies)
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(1)
    expect(res.body.sessions[0].current).toBe(true)
    expect(res.body.sessions[0].kind).toBe('web')
  })

  it('can revoke another session', async () => {
    const { cookies: cookies1 } = await devLogin('multi@test.com')
    // Create a second session (same user, new session)
    await devLogin('multi@test.com')

    // List from session 1
    const list = await request(app).get('/api/auth/sessions').set('Cookie', cookies1)
    expect(list.body.sessions).toHaveLength(2)

    const otherSession = list.body.sessions.find((s: { current: boolean }) => !s.current)
    expect(otherSession).toBeDefined()

    // Revoke the other session
    const del = await request(app)
      .delete(`/api/auth/sessions/${otherSession.id}`)
      .set('Cookie', cookies1)
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
    expect(del.status).toBe(200)

    // Verify only one session remains
    const list2 = await request(app).get('/api/auth/sessions').set('Cookie', cookies1)
    expect(list2.body.sessions).toHaveLength(1)
  })
})

describe('auth - logout', () => {
  it('revokes the current session on logout', async () => {
    const { cookies, userId } = await devLogin()

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies)
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
    expect(res.status).toBe(200)

    // Session should be gone
    const sessions = await Session.find({ userId })
    expect(sessions).toHaveLength(0)

    // Cookie should be cleared (me should fail)
    const me = await request(app).get('/api/auth/me').set('Cookie', cookies)
    expect(me.status).toBe(401)
  })

  it('revokes all sessions on logout-all (requires recent auth)', async () => {
    const { cookies: cookies1 } = await devLogin('all@test.com')
    await devLogin('all@test.com') // second session

    const user = await User.findOne({ email: 'all@test.com' })
    expect(await Session.countDocuments({ userId: user!._id })).toBe(2)

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', cookies1)
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
    expect(res.status).toBe(200)

    expect(await Session.countDocuments({ userId: user!._id })).toBe(0)
  })
})

describe('auth - token refresh (android)', () => {
  it('rotates refresh token and returns new access+refresh', async () => {
    const { refreshToken } = await devLoginAndroid('refresh@test.com')

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .send({ refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
    expect(res.body.refreshToken).not.toBe(refreshToken) // rotated
  })

  it('reuse of old refresh token revokes the family', async () => {
    const { refreshToken: original } = await devLoginAndroid('reuse@test.com')

    // First refresh: succeeds
    const res1 = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .send({ refreshToken: original })
    expect(res1.status).toBe(200)

    // Second use of original token: reuse detected → family revoked
    const res2 = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .send({ refreshToken: original })
    expect(res2.status).toBe(401)

    // The new token from res1 should also be dead (family wiped)
    const res3 = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-sf-request', '1')
      .send({ refreshToken: res1.body.refreshToken })
    expect(res3.status).toBe(401)
  })
})

describe('auth - session version revocation', () => {
  it('invalidates sessions when sessionVersion is bumped', async () => {
    const { cookies, userId } = await devLogin('version@test.com')

    // Verify we're authenticated
    const me1 = await request(app).get('/api/auth/me').set('Cookie', cookies)
    expect(me1.status).toBe(200)

    // Bump version (simulating RISC or logout-all)
    await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } })

    // Session should now be invalid
    const me2 = await request(app).get('/api/auth/me').set('Cookie', cookies)
    expect(me2.status).toBe(401)
  })
})

describe('auth - providers endpoint', () => {
  it('lists available providers (at least dev in test mode)', async () => {
    const res = await request(app).get('/api/auth/providers')
    expect(res.status).toBe(200)
    expect(res.body.providers).toContain('dev')
  })
})
