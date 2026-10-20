// A random id for this browser, used for the "new device" email check.
const KEY = 'atom-device-id'

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'no-storage-' + Math.random().toString(36).slice(2).padEnd(40, '0')
  }
}
