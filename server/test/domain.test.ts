import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import {
  Activity,
  AuthIdentity,
  Comment,
  Expense,
  Friendship,
  Group,
  Invite,
  RecurringRule,
  Session,
  Settlement,
  User,
} from '../src/models/index.js'
import { runDueRecurring } from '../src/services/recurring.js'
import { setFxFetcher } from '../src/services/fx.js'

const app = createApp()

async function loginUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/auth/dev/login')
    .set('Origin', 'http://localhost:5173')
    .set('x-sf-request', '1')
    .send({ email, name })
  expect(res.status).toBe(200)
  const cookies = res.headers['set-cookie'] as unknown as string[]
  return {
    userId: res.body.userId as string,
    cookies,
    get: (url: string) =>
      request(app)
        .get(url)
        .set('Origin', 'http://localhost:5173')
        .set('x-sf-request', '1')
        .set('Cookie', cookies),
    post: (url: string) =>
      request(app)
        .post(url)
        .set('Origin', 'http://localhost:5173')
        .set('x-sf-request', '1')
        .set('Cookie', cookies),
    patch: (url: string) =>
      request(app)
        .patch(url)
        .set('Origin', 'http://localhost:5173')
        .set('x-sf-request', '1')
        .set('Cookie', cookies),
    delete: (url: string) =>
      request(app)
        .delete(url)
        .set('Origin', 'http://localhost:5173')
        .set('x-sf-request', '1')
        .set('Cookie', cookies),
  }
}

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    AuthIdentity.deleteMany({}),
    Session.deleteMany({}),
    Friendship.deleteMany({}),
    Invite.deleteMany({}),
    Group.deleteMany({}),
    Expense.deleteMany({}),
    Settlement.deleteMany({}),
    Comment.deleteMany({}),
    RecurringRule.deleteMany({}),
    Activity.deleteMany({}),
  ])
})

describe('Domain API - Friends & Invites', () => {
  it('adds an existing user as friend immediately', async () => {
    const userA = await loginUser('alice@test.com', 'Alice')
    const userB = await loginUser('bob@test.com', 'Bob')

    const res = await userA
      .post('/api/friends')
      .send({ email: 'bob@test.com' })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('added')
    expect(res.body.friend._id).toBe(userB.userId)

    const listRes = await userA.get('/api/friends')
    if (listRes.status !== 200) console.log('LIST RES:', listRes.status, listRes.body)
    expect(listRes.status).toBe(200)
    expect(listRes.body.friends).toHaveLength(1)
    expect(listRes.body.friends[0].user._id).toBe(userB.userId)
  })

  it('creates an invite when adding an unregistered email, then accepts with token', async () => {
    const userA = await loginUser('alice@test.com', 'Alice')

    const invRes = await userA
      .post('/api/friends')
      .send({ email: 'newperson@test.com' })
    expect(invRes.status).toBe(202)
    expect(invRes.body.status).toBe('invited')
    expect(invRes.body.devToken).toBeDefined()

    const token = invRes.body.devToken as string

    // New person signs up
    const newPerson = await loginUser('newperson@test.com', 'New Person')

    // Accepts the invite token
    const acceptRes = await newPerson
      .post('/api/invites/accept')
      .send({ token })
    expect(acceptRes.status).toBe(200)
    expect(acceptRes.body.ok).toBe(true)

    // Check that friendship is active
    const friendsRes = await newPerson.get('/api/friends')
    expect(friendsRes.body.friends).toHaveLength(1)
    expect(friendsRes.body.friends[0].user._id).toBe(userA.userId)
  })
})

describe('Domain API - Groups & Members', () => {
  it('creates a group, adds a member, and retrieves detail', async () => {
    const userA = await loginUser('alice@test.com', 'Alice')
    const userB = await loginUser('bob@test.com', 'Bob')

    const createRes = await userA
      .post('/api/groups')
      .send({ name: 'Goa Trip', type: 'trip', defaultCurrency: 'INR', simplifyDebts: true })
    if (createRes.status !== 201) console.log('CREATE GROUP RES:', createRes.status, createRes.body)
    expect(createRes.status).toBe(201)
    const groupId = createRes.body.group._id

    // Alice adds Bob
    const addMemberRes = await userA
      .post(`/api/groups/${groupId}/members`)
      .send({ userId: userB.userId })
    expect(addMemberRes.status).toBe(201)
    expect(addMemberRes.body.status).toBe('added')

    // Bob views group detail
    const detailRes = await userB.get(`/api/groups/${groupId}`)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.group.name).toBe('Goa Trip')
    expect(detailRes.body.group.members).toHaveLength(2)
  })
})

describe('Domain API - Expenses, Balances & Settle Up', () => {
  it('handles full lifecycle: expense -> balances -> comments -> settlement', async () => {
    const alice = await loginUser('alice@test.com', 'Alice')
    const bob = await loginUser('bob@test.com', 'Bob')
    const charlie = await loginUser('charlie@test.com', 'Charlie')

    // Create group with Alice, Bob, Charlie
    const groupRes = await alice
      .post('/api/groups')
      .send({
        name: 'Roommates',
        defaultCurrency: 'USD',
        memberIds: [bob.userId, charlie.userId],
      })
    const groupId = groupRes.body.group._id

    // Alice adds an expense of $300 (equal split: $100 each)
    const expRes = await alice
      .post('/api/expenses')
      .send({
        groupId,
        description: 'Groceries',
        category: 'food',
        currency: 'USD',
        amountMinor: 30000,
        date: new Date().toISOString(),
        payers: [{ userId: alice.userId, amountMinor: 30000 }],
        splits: [
          { userId: alice.userId, amountMinor: 10000 },
          { userId: bob.userId, amountMinor: 10000 },
          { userId: charlie.userId, amountMinor: 10000 },
        ],
        splitMethod: 'equal',
      })
    expect(expRes.status).toBe(201)
    const expenseId = expRes.body.expense._id

    // Bob adds a comment
    const commentRes = await bob
      .post(`/api/expenses/${expenseId}/comments`)
      .send({ body: 'Thanks for buying groceries!' })
    expect(commentRes.status).toBe(201)

    // Check group balances: Bob and Charlie each owe Alice $100
    const balRes = await bob.get(`/api/groups/${groupId}/balances`)
    expect(balRes.status).toBe(200)
    expect(balRes.body.balances).toHaveLength(2)

    // Check Bob's overall balance: owes $100
    const bobBal = await bob.get('/api/balances')
    expect(bobBal.status).toBe(200)
    expect(bobBal.body.totals[0].oweMinor).toBe(10000)

    // Bob settles up with Alice: pays $100
    const settleRes = await bob
      .post('/api/settlements')
      .send({
        groupId,
        from: bob.userId,
        to: alice.userId,
        amountMinor: 10000,
        currency: 'USD',
        date: new Date().toISOString(),
        notes: 'Paid via Venmo',
      })
    expect(settleRes.status).toBe(201)

    // Bob's debt in group should now be 0
    const bobBalAfter = await bob.get('/api/balances')
    const bobOwesAlice = bobBalAfter.body.balances.find((b: any) => b.from === bob.userId && b.to === alice.userId)
    expect(bobOwesAlice).toBeUndefined()

    // Activity feed contains expense, comment, settlement
    const actRes = await alice.get('/api/activity')
    expect(actRes.status).toBe(200)
    expect(actRes.body.activities.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Domain API - Receipts', () => {
  it('uploads, downloads, and deletes receipt images', async () => {
    const alice = await loginUser('alice@test.com', 'Alice')
    const bob = await loginUser('bob@test.com', 'Bob')

    // Create group and expense
    const groupRes = await alice
      .post('/api/groups')
      .send({ name: 'Dinner Group', memberIds: [bob.userId] })
    const groupId = groupRes.body.group._id

    const expRes = await alice
      .post('/api/expenses')
      .send({
        groupId,
        description: 'Dinner',
        currency: 'USD',
        amountMinor: 5000,
        date: new Date().toISOString(),
        payers: [{ userId: alice.userId, amountMinor: 5000 }],
        splits: [
          { userId: alice.userId, amountMinor: 2500 },
          { userId: bob.userId, amountMinor: 2500 },
        ],
        splitMethod: 'equal',
      })
    const expenseId = expRes.body.expense._id

    // Valid 1x1 PNG bytes
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const validPngBuffer = Buffer.from(base64Png, 'base64')

    // Upload receipt
    const uploadRes = await alice
      .post(`/api/expenses/${expenseId}/receipt`)
      .attach('receipt', validPngBuffer, 'receipt.png')
    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.ok).toBe(true)
    expect(uploadRes.body.fileId).toBeDefined()

    // Download receipt
    const downloadRes = await bob.get(`/api/expenses/${expenseId}/receipt`)
    expect(downloadRes.status).toBe(200)
    expect(downloadRes.headers['content-type']).toContain('webp')

    // Delete receipt
    const delRes = await alice.delete(`/api/expenses/${expenseId}/receipt`)
    expect(delRes.status).toBe(200)
    expect(delRes.body.ok).toBe(true)

    // Confirm receipt is gone
    const downloadAfter = await bob.get(`/api/expenses/${expenseId}/receipt`)
    expect(downloadAfter.status).toBe(404)
  })
})

describe('Domain API - Recurring & Cron Runner', () => {
  it('creates recurring rule and runner generates due expense', async () => {
    const alice = await loginUser('alice@test.com', 'Alice')
    const bob = await loginUser('bob@test.com', 'Bob')

    const groupRes = await alice
      .post('/api/groups')
      .send({ name: 'Flat', memberIds: [bob.userId] })
    const groupId = groupRes.body.group._id

    // Start date in the past so it is immediately due
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const ruleRes = await alice
      .post('/api/recurring')
      .send({
        groupId,
        description: 'Internet Bill',
        currency: 'USD',
        amountMinor: 6000,
        payers: [{ userId: alice.userId, amountMinor: 6000 }],
        splits: [
          { userId: alice.userId, amountMinor: 3000 },
          { userId: bob.userId, amountMinor: 3000 },
        ],
        splitMethod: 'equal',
        frequency: 'monthly',
        startDate: pastDate.toISOString(),
      })
    expect(ruleRes.status).toBe(201)

    // Run due recurring
    const runResult = await runDueRecurring()
    expect(runResult.created).toBeGreaterThanOrEqual(1)

    // Check expenses list now includes the recurring expense
    const listRes = await bob.get(`/api/expenses?groupId=${groupId}`)
    expect(listRes.body.expenses).toHaveLength(1)
    expect(listRes.body.expenses[0].description).toBe('Internet Bill')
  })
})

describe('Domain API - Stats & FX', () => {
  it('returns spending stats and supported FX currencies', async () => {
    const alice = await loginUser('alice@test.com', 'Alice')

    // Inject mock FX fetcher for test
    setFxFetcher(async (_base) => ({
      date: '2026-10-22',
      rates: { USD: 1, EUR: 0.92, INR: 83.5 },
    }))

    const statsRes = await alice.get('/api/stats')
    expect(statsRes.status).toBe(200)
    expect(statsRes.body.totals).toBeDefined()
    expect(statsRes.body.byCategory).toBeDefined()
    expect(statsRes.body.byMonth).toBeDefined()

    const fxRes = await alice.get('/api/fx/currencies')
    expect(fxRes.status).toBe(200)
    expect(fxRes.body.currencies.length).toBeGreaterThan(5)

    const ratesRes = await alice.get('/api/fx/rates?base=USD')
    expect(ratesRes.status).toBe(200)
    expect(ratesRes.body.rates.EUR).toBe(0.92)
  })
})
