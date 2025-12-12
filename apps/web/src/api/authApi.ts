import { appServices } from './appServices'

let seedPromise: Promise<unknown> | null = null

async function ensureManagerSeeded() {
  if (!seedPromise) {
    seedPromise = appServices.usersService.createManagerIfMissing()
  }
  return seedPromise
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureManagerSeeded()
    const valid = await appServices.usersService.verifyCredentials(username, password)
    if (valid) {
      return { success: true }
    }
    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }
  } catch (err) {
    console.error('Login failed', err)
    return { success: false, error: 'تعذر تسجيل الدخول حالياً' }
  }
}
