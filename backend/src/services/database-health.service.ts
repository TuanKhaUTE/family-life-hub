import { createSupabaseServerClient } from '../config/supabase.js'

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.getOpenApiSpec()

    return error === null
  } catch {
    return false
  }
}
