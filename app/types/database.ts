export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface SynapseItem {
  id: string
  user_id: string
  source_text: string
  target_text: string
  source_language: string
  target_language: string
  audio_url?: string | null
  notes?: string | null
  mastery_level: number
  next_review_at: string
  created_at: string
  updated_at: string
}

export type NewSynapseItem = Omit<SynapseItem, 'id' | 'created_at' | 'updated_at' | 'user_id'>