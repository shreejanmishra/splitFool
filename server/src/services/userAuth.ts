import { User, AuthIdentity, type Provider, type UserDoc } from '../models/index.js'
import { logger } from '../lib/logger.js'
import { acceptInvitesForVerifiedEmail } from './friends.js'

export type ProviderProfile = {
  provider: Provider
  providerSub: string
  email: string
  emailVerified: boolean
  name: string
  avatar?: string
}

/**
 * Find or create a user from a provider profile.
 *
 * Linking rules (prevent account takeover):
 * 1. If an AuthIdentity with this provider+sub exists → return the linked user.
 * 2. If a User with this email exists and the provider says the email is verified →
 *    link a new AuthIdentity to the existing user.
 * 3. If email is NOT verified by the provider → never auto-link; create a separate user.
 * 4. If no user exists at all → create user + identity.
 *
 * After resolving the user, pending invites for a provider-verified email are accepted.
 */
export async function findOrCreateUser(profile: ProviderProfile): Promise<UserDoc> {
  const user = await resolveUser(profile)
  if (profile.emailVerified && user.email === profile.email.toLowerCase()) {
    await acceptInvitesForVerifiedEmail(user)
  }
  return user
}

async function resolveUser(profile: ProviderProfile): Promise<UserDoc> {
  // 1. Existing identity?
  const existing = await AuthIdentity.findOne({
    provider: profile.provider,
    providerSub: profile.providerSub,
  })
  if (existing) {
    const user = await User.findById(existing.userId)
    if (!user) {
      // Orphaned identity (shouldn't happen)
      logger.warn({ identityId: existing._id }, 'Orphaned auth identity, cleaning up')
      await existing.deleteOne()
    } else {
      // Update avatar/name if provider gives a newer one
      if (profile.avatar && user.avatar !== profile.avatar) user.avatar = profile.avatar
      if (profile.name && user.name !== profile.name) user.name = profile.name
      await user.save()
      return user
    }
  }

  // 2. Try to link by verified email
  if (profile.emailVerified) {
    const existingUser = await User.findOne({ email: profile.email.toLowerCase() })
    if (existingUser) {
      await AuthIdentity.create({
        userId: existingUser._id,
        provider: profile.provider,
        providerSub: profile.providerSub,
        emailVerified: profile.emailVerified,
        displayName: profile.name,
      })
      logger.info(
        { userId: existingUser._id, provider: profile.provider },
        'Linked new provider to existing user',
      )
      if (profile.avatar && !existingUser.avatar) {
        existingUser.avatar = profile.avatar
        await existingUser.save()
      }
      return existingUser
    }
  }

  // 3 & 4. Create new user + identity
  const user = await User.create({
    name: profile.name,
    email: profile.email.toLowerCase(),
    avatar: profile.avatar,
  })
  await AuthIdentity.create({
    userId: user._id,
    provider: profile.provider,
    providerSub: profile.providerSub,
    emailVerified: profile.emailVerified,
    displayName: profile.name,
  })
  logger.info({ userId: user._id, provider: profile.provider }, 'Created new user')
  return user
}
