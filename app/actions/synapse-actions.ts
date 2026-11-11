"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Cliente de Supabase adaptado para Server Actions con acceso a cookies
async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}

export async function getSynapseItems() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("synapse_items")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error al obtener sinapsis:", error)
    return []
  }

  return data || []
}

export async function createSynapseItem(
  sourceText: string, 
  targetText: string, 
  category: string = "chunk"
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("Error de autenticación en Server Action:", authError)
    throw new Error("Debes estar autenticado para guardar")
  }

  let cleanCategory = "chunk"
  const catLower = (category || "").toLowerCase().trim()
  if (catLower.includes("movie") || catLower.includes("serie") || catLower.includes("cine")) {
    cleanCategory = "movie"
  } else if (catLower.includes("music") || catLower.includes("música")) {
    cleanCategory = "music"
  }

  const { data, error } = await supabase
    .from("synapse_items")
    .insert([
      {
        user_id: user.id,
        source_text: sourceText.trim(),
        target_text: targetText.trim(),
        category: cleanCategory,
      },
    ])
    .select()

  if (error) {
    console.error("Error directo de Supabase al insertar:", error)
    throw new Error(error.message)
  }

  return data
}

export async function deleteSynapseItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("synapse_items")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error al eliminar sinapsis:", error)
    throw new Error("No se pudo eliminar la sinapsis")
  }
}

export async function getSuggestedChunks(level: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("system_chunks")
    .select("*")
    .eq("level", level)

  if (error) {
    console.error("Error al obtener chunks sugeridos:", error)
    return []
  }

  return data || []
}

export async function updateUserProfileLevel(level: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("profiles")
    .update({ current_mcer_level: level })
    .eq("id", user.id)
    .select()

  if (error) {
    console.error("Error al actualizar nivel en perfil:", error)
    throw new Error("No se pudo actualizar el nivel")
  }

  return data
}