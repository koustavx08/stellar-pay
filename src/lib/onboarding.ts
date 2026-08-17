/**
 * Tracks which wallets have finished onboarding.
 *
 * Keyed per address, so connecting a different wallet shows the introduction
 * once for that wallet rather than never again for the whole browser.
 */
const STORAGE_KEY = 'stellar-pay:onboarded'

function readAll(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // Corrupt or unavailable storage just means onboarding runs again.
    return []
  }
}

export function hasCompletedOnboarding(address: string): boolean {
  return readAll().includes(address)
}

export function markOnboardingComplete(address: string): void {
  try {
    const all = readAll()
    if (all.includes(address)) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, address]))
  } catch {
    // Private mode: onboarding will simply show again next visit.
  }
}

export function resetOnboarding(address: string): void {
  try {
    const remaining = readAll().filter((entry) => entry !== address)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
