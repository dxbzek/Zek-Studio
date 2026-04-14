// Auto-generated types will go here after running: npx supabase gen types typescript
// For now, using a generic placeholder so the client compiles

export type Database = {
  public: {
    Tables: {
      brand_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          niche: string
          website_url: string | null
          platforms: string[]
          avatar_url: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          niche: string
          website_url?: string | null
          platforms?: string[]
          avatar_url?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          niche?: string
          website_url?: string | null
          platforms?: string[]
          avatar_url?: string | null
          color?: string | null
          updated_at?: string
        }
      }
      competitors: {
        Row: {
          id: string
          brand_id: string
          handle: string
          platform: string
          last_scraped_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          handle: string
          platform: string
          last_scraped_at?: string | null
          created_at?: string
        }
        Update: {
          handle?: string
          platform?: string
          last_scraped_at?: string | null
        }
      }
      competitor_posts: {
        Row: {
          id: string
          competitor_id: string
          brand_id: string
          platform: string
          url: string | null
          caption: string | null
          views: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          hook: string | null
          thumbnail_url: string | null
          posted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          competitor_id: string
          brand_id: string
          platform: string
          url?: string | null
          caption?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          hook?: string | null
          thumbnail_url?: string | null
          posted_at?: string | null
          created_at?: string
        }
        Update: {
          url?: string | null
          caption?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          hook?: string | null
          thumbnail_url?: string | null
          posted_at?: string | null
        }
      }
      saved_hooks: {
        Row: {
          id: string
          brand_id: string
          text: string
          source_post_id: string | null
          platform: string | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          text: string
          source_post_id?: string | null
          platform?: string | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          text?: string
          platform?: string | null
          tags?: string[]
        }
      }
      niche_research_cache: {
        Row: {
          id: string
          brand_id: string
          query: string
          results: unknown
          fetched_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          query: string
          results: unknown
          fetched_at?: string
        }
        Update: {
          results?: unknown
          fetched_at?: string
        }
      }
      generated_content: {
        Row: {
          id: string
          brand_id: string
          type: string
          platform: string
          brief: string
          output: string[]
          tone: string
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          type: string
          platform: string
          brief: string
          output: string[]
          tone: string
          created_at?: string
        }
        Update: {
          output?: string[]
        }
      }
      calendar_entries: {
        Row: {
          id: string
          brand_id: string
          platform: string
          content_type: string
          title: string
          body: string | null
          scheduled_date: string
          status: string
          generated_content_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          platform: string
          content_type: string
          title: string
          body?: string | null
          scheduled_date: string
          status?: string
          generated_content_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          platform?: string
          content_type?: string
          title?: string
          body?: string | null
          scheduled_date?: string
          status?: string
          generated_content_id?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
