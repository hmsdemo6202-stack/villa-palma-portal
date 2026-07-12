import { SupabaseClient } from '@supabase/supabase-js'

export type RoomTypeImage = {
  id: string
  room_type_id: string
  storage_path: string
  image_url: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

const BUCKET = 'room-images'
export const MIN_RECOMMENDED_PHOTOS = 8

export async function listRoomTypeImages(supabase: SupabaseClient, roomTypeId: string) {
  const { data, error } = await supabase
    .from('room_type_images')
    .select('*')
    .eq('room_type_id', roomTypeId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data as RoomTypeImage[]) ?? []
}

export async function uploadRoomTypeImage(
  supabase: SupabaseClient,
  roomTypeId: string,
  file: File,
  nextSortOrder: number
) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${roomTypeId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (uploadErr) throw uploadErr

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('room_type_images')
    .insert({
      room_type_id: roomTypeId,
      storage_path: path,
      image_url: pub.publicUrl,
      sort_order: nextSortOrder,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as RoomTypeImage
}

export async function deleteRoomTypeImage(supabase: SupabaseClient, image: RoomTypeImage) {
  await supabase.storage.from(BUCKET).remove([image.storage_path])
  const { error } = await supabase.from('room_type_images').delete().eq('id', image.id)
  if (error) throw error
}

export async function reorderRoomTypeImage(supabase: SupabaseClient, id: string, sortOrder: number) {
  const { error } = await supabase.from('room_type_images').update({ sort_order: sortOrder }).eq('id', id)
  if (error) throw error
}

export async function setPrimaryRoomTypeImage(supabase: SupabaseClient, roomTypeId: string, image: RoomTypeImage) {
  await supabase.from('room_type_images').update({ is_primary: false }).eq('room_type_id', roomTypeId)
  const { error } = await supabase.from('room_type_images').update({ is_primary: true }).eq('id', image.id)
  if (error) throw error
  await supabase.from('room_types').update({ image_url: image.image_url }).eq('id', roomTypeId)
}
