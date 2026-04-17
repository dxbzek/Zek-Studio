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
          target_location: string | null
          instagram_handle: string | null
          tiktok_handle: string | null
          facebook_handle: string | null
          youtube_handle: string | null
          linkedin_handle: string | null
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
          target_location?: string | null
          instagram_handle?: string | null
          tiktok_handle?: string | null
          facebook_handle?: string | null
          youtube_handle?: string | null
          linkedin_handle?: string | null
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
          target_location?: string | null
          instagram_handle?: string | null
          tiktok_handle?: string | null
          facebook_handle?: string | null
          youtube_handle?: string | null
          linkedin_handle?: string | null
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
          video_url: string | null
          transcript: string | null
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
          video_url?: string | null
          transcript?: string | null
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
          video_url?: string | null
          transcript?: string | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          campaign_id: string | null
          pillar_id: string | null
          approval_status: string | null
          approval_note: string | null
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
          campaign_id?: string | null
          pillar_id?: string | null
          approval_status?: string | null
          approval_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          platform?: string
          content_type?: string
          title?: string
          body?: string | null
          scheduled_date?: string
          status?: string
          generated_content_id?: string | null
          campaign_id?: string | null
          pillar_id?: string | null
          approval_status?: string | null
          approval_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          brand_id: string
          user_id: string | null
          email: string
          role: string
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          user_id?: string | null
          email: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          user_id?: string | null
          role?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          brand_id: string
          title: string
          description: string | null
          type: string
          status: string
          priority: string
          assignee_id: string | null
          assignee_email: string | null
          calendar_entry_id: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          title: string
          description?: string | null
          type?: string
          status?: string
          priority?: string
          assignee_id?: string | null
          assignee_email?: string | null
          calendar_entry_id?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          title?: string
          description?: string | null
          type?: string
          status?: string
          priority?: string
          assignee_id?: string | null
          assignee_email?: string | null
          calendar_entry_id?: string | null
          due_date?: string | null
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      post_metrics: {
        Row: {
          id: string
          brand_id: string
          calendar_entry_id: string | null
          platform: string
          post_url: string | null
          posted_at: string | null
          posted_time: string | null
          views: number | null
          likes: number | null
          comments: number | null
          shares: number | null
          saves: number | null
          reach: number | null
          impressions: number | null
          notes: string | null
          logged_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          calendar_entry_id?: string | null
          platform: string
          post_url?: string | null
          posted_at?: string | null
          posted_time?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          reach?: number | null
          impressions?: number | null
          notes?: string | null
          logged_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          calendar_entry_id?: string | null
          platform?: string
          post_url?: string | null
          posted_at?: string | null
          posted_time?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          shares?: number | null
          saves?: number | null
          reach?: number | null
          impressions?: number | null
          notes?: string | null
          logged_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          state: string
          brand_id: string
          platform: string
          created_at: string
        }
        Insert: {
          state?: string
          brand_id: string
          platform: string
          created_at?: string
        }
        Update: {
          brand_id?: string
          platform?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          id: string
          brand_id: string
          platform: string
          access_token: string
          refresh_token: string | null
          token_expires_at: string | null
          platform_account_id: string | null
          platform_account_name: string | null
          scopes: string[] | null
          connected_at: string
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          platform: string
          access_token: string
          refresh_token?: string | null
          token_expires_at?: string | null
          platform_account_id?: string | null
          platform_account_name?: string | null
          scopes?: string[] | null
          connected_at?: string
          last_synced_at?: string | null
        }
        Update: {
          access_token?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          platform_account_id?: string | null
          platform_account_name?: string | null
          scopes?: string[] | null
          last_synced_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          brand_id: string
          name: string
          description: string | null
          color: string
          start_date: string | null
          end_date: string | null
          goal: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          description?: string | null
          color?: string
          start_date?: string | null
          end_date?: string | null
          goal?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          name?: string
          description?: string | null
          color?: string
          start_date?: string | null
          end_date?: string | null
          goal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          id: string
          brand_id: string
          label: string
          target_pct: number
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          label: string
          target_pct?: number
          color?: string
          created_at?: string
        }
        Update: {
          label?: string
          target_pct?: number
          color?: string
        }
        Relationships: []
      }
      reply_templates: {
        Row: {
          id: string
          brand_id: string
          label: string
          text: string
          platform: string | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          label: string
          text: string
          platform?: string | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          label?: string
          text?: string
          platform?: string | null
          tags?: string[]
        }
        Relationships: []
      }
      share_tokens: {
        Row: {
          id: string
          brand_id: string
          type: string
          token: string
          settings: unknown
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          type: string
          token?: string
          settings?: unknown
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          type?: string
          settings?: unknown
          expires_at?: string | null
        }
        Relationships: []
      }
      brand_kpis: {
        Row: {
          id: string
          brand_id: string
          platform: string
          metric: string
          target_value: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          platform?: string
          metric: string
          target_value: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          platform?: string
          metric?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
