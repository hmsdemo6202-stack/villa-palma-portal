'use server'
import { createAdminClient } from '@/lib/supabase/admin'

const STAFF_DOMAIN = '@cabalum.internal'

export async function createStaffUser(data: {
  username: string
  password: string
  fullName: string
  role: string
  phone?: string
  departmentId?: string
}) {
  try {
    const supabase = createAdminClient()
    const email = `${data.username}${STAFF_DOMAIN}`

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role },
    })
    if (authErr) return { error: authErr.message }
    if (!authData?.user?.id) return { error: 'User creation returned no ID.' }

    const uid = authData.user.id

    // Insert the public.users row directly (service role bypasses RLS)
    const { error: insertErr } = await supabase
      .from('users')
      .insert({
        id:            uid,
        username:      data.username,
        full_name:     data.fullName     || null,
        role:          data.role,
        phone:         data.phone        || null,
        department_id: data.departmentId || null,
        is_active:     true,
      })

    if (insertErr) return { error: insertErr.message }
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unexpected server error.' }
  }
}

export async function deleteStaffUser(userId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateStaffUser(userId: string, data: {
  fullName?: string
  phone?: string
  role?: string
  departmentId?: string
  isActive?: boolean
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({
      full_name:     data.fullName     ?? undefined,
      phone:         data.phone        ?? undefined,
      role:          data.role         ?? undefined,
      department_id: data.departmentId ?? undefined,
      is_active:     data.isActive     ?? undefined,
    })
    .eq('id', userId)
  if (error) return { error: error.message }
  return { success: true }
}
