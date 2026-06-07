export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_chat_logs: {
        Row: {
          created_at: string
          id: string
          latency_ms: number
          prompt_hash: string
          prompt_text: string | null
          status: string
          tokens_in: number
          tokens_out: number
          tool_calls: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms: number
          prompt_hash: string
          prompt_text?: string | null
          status: string
          tokens_in: number
          tokens_out: number
          tool_calls?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number
          prompt_hash?: string
          prompt_text?: string | null
          status?: string
          tokens_in?: number
          tokens_out?: number
          tool_calls?: Json
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          date: string
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          date: string
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          date?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arms_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string
          id: string
          legs_cm: number | null
          recorded_on: string
          updated_at: string
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          id?: string
          legs_cm?: number | null
          recorded_on?: string
          updated_at?: string
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          arms_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          id?: string
          legs_cm?: number | null
          recorded_on?: string
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: []
      }
      bodyweight_entries: {
        Row: {
          created_at: string
          id: string
          recorded_on: string
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_on?: string
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          recorded_on?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          client_mutation_id: string | null
          created_at: string
          equipment: string | null
          id: string
          is_custom: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          category: string
          client_mutation_id?: string | null
          created_at?: string
          equipment?: string | null
          id?: string
          is_custom?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string
          client_mutation_id?: string | null
          created_at?: string
          equipment?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mutation_receipts: {
        Row: {
          client_mutation_id: string
          mutation_type: string
          processed_at: string
          resource_id: string | null
          resource_type: string
          response_metadata: Json | null
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          mutation_type: string
          processed_at?: string
          resource_id?: string | null
          resource_type: string
          response_metadata?: Json | null
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          mutation_type?: string
          processed_at?: string
          resource_id?: string | null
          resource_type?: string
          response_metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      plan_exercises: {
        Row: {
          exercise_id: string
          id: string
          plan_workout_id: string
          position: number
          target_reps: number
          target_sets: number
        }
        Insert: {
          exercise_id: string
          id?: string
          plan_workout_id: string
          position: number
          target_reps: number
          target_sets: number
        }
        Update: {
          exercise_id?: string
          id?: string
          plan_workout_id?: string
          position?: number
          target_reps?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_workout_id_fkey"
            columns: ["plan_workout_id"]
            isOneToOne: false
            referencedRelation: "plan_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_workouts: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id: string
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          client_mutation_id: string | null
          created_at: string
          id: string
          is_public: boolean
          last_patch_mutation_id: string | null
          name: string
          share_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          last_patch_mutation_id?: string | null
          name: string
          share_slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          last_patch_mutation_id?: string | null
          name?: string
          share_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          goal_weight_kg: number | null
          height_cm: number | null
          id: string
          last_name: string | null
          primary_goal: Database["public"]["Enums"]["fitness_goal"] | null
          starting_weight_kg: number | null
          target_daily_calories: number | null
          time_zone: string | null
          training_experience:
            | Database["public"]["Enums"]["training_experience"]
            | null
          updated_at: string
          user_id: string
          username: string | null
          weekly_training_frequency: number | null
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          last_name?: string | null
          primary_goal?: Database["public"]["Enums"]["fitness_goal"] | null
          starting_weight_kg?: number | null
          target_daily_calories?: number | null
          time_zone?: string | null
          training_experience?:
            | Database["public"]["Enums"]["training_experience"]
            | null
          updated_at?: string
          user_id: string
          username?: string | null
          weekly_training_frequency?: number | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          last_name?: string | null
          primary_goal?: Database["public"]["Enums"]["fitness_goal"] | null
          starting_weight_kg?: number | null
          target_daily_calories?: number | null
          time_zone?: string | null
          training_experience?:
            | Database["public"]["Enums"]["training_experience"]
            | null
          updated_at?: string
          user_id?: string
          username?: string | null
          weekly_training_frequency?: number | null
        }
        Relationships: []
      }
      sets: {
        Row: {
          client_mutation_id: string | null
          id: string
          logged_at: string
          reps: number
          set_number: number
          weight_unit: Database["public"]["Enums"]["weight_unit"]
          weight_value: number
          workout_exercise_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          id?: string
          logged_at?: string
          reps: number
          set_number: number
          weight_unit: Database["public"]["Enums"]["weight_unit"]
          weight_value: number
          workout_exercise_id: string
        }
        Update: {
          client_mutation_id?: string | null
          id?: string
          logged_at?: string
          reps?: number
          set_number?: number
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
          weight_value?: number
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          height_unit: Database["public"]["Enums"]["height_unit"]
          id: string
          rest_timer_default_seconds: number
          updated_at: string
          user_id: string
          weight_unit: Database["public"]["Enums"]["weight_unit"]
        }
        Insert: {
          created_at?: string
          height_unit?: Database["public"]["Enums"]["height_unit"]
          id?: string
          rest_timer_default_seconds?: number
          updated_at?: string
          user_id: string
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
        }
        Update: {
          created_at?: string
          height_unit?: Database["public"]["Enums"]["height_unit"]
          id?: string
          rest_timer_default_seconds?: number
          updated_at?: string
          user_id?: string
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          client_mutation_id: string | null
          exercise_id: string
          id: string
          position: number
          workout_id: string
        }
        Insert: {
          client_mutation_id?: string | null
          exercise_id: string
          id?: string
          position: number
          workout_id: string
        }
        Update: {
          client_mutation_id?: string | null
          exercise_id?: string
          id?: string
          position?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed_at: string | null
          created_at: string
          expired_at: string | null
          id: string
          last_activity_at: string
          name: string | null
          plan_workout_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["workout_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          last_activity_at?: string
          name?: string | null
          plan_workout_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workout_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          last_activity_at?: string
          name?: string | null
          plan_workout_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["workout_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_workout_id_fkey"
            columns: ["plan_workout_id"]
            isOneToOne: false
            referencedRelation: "plan_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_plan_with_children: {
        Args: { p_client_mutation_id: string; p_name: string; p_workouts: Json }
        Returns: {
          plan_id: string
          share_slug: string
        }[]
      }
      delete_workout_exercise_in_progress: {
        Args: { p_workout_exercise_id: string }
        Returns: {
          deleted: boolean
          workout_id: string
          workout_status: string
        }[]
      }
      generate_share_slug: { Args: never; Returns: string }
      record_ai_tokens: {
        Args: {
          p_date: string
          p_tokens_in: number
          p_tokens_out: number
          p_user_id: string
        }
        Returns: undefined
      }
      reorder_workout_exercise: {
        Args: { p_position: number; p_workout_exercise_id: string }
        Returns: {
          id: string
          workout_id: string
        }[]
      }
      update_plan_name: {
        Args: {
          p_client_mutation_id: string
          p_name: string
          p_plan_id: string
        }
        Returns: {
          plan_id: string
        }[]
      }
      update_plan_with_children:
        | {
            Args: { p_name: string; p_plan_id: string; p_workouts: Json }
            Returns: {
              plan_id: string
            }[]
          }
        | {
            Args: {
              p_client_mutation_id: string
              p_name: string
              p_plan_id: string
              p_workouts: Json
            }
            Returns: {
              plan_id: string
            }[]
          }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "lightly_active"
        | "moderately_active"
        | "very_active"
      fitness_goal:
        | "fat_loss"
        | "muscle_gain"
        | "strength"
        | "endurance"
        | "general_fitness"
      gender: "male" | "female" | "prefer_not_to_say"
      height_unit: "ft" | "cm"
      training_experience: "beginner" | "intermediate" | "advanced"
      weight_unit: "lbs" | "kg"
      workout_status: "in_progress" | "completed" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level: [
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
      ],
      fitness_goal: [
        "fat_loss",
        "muscle_gain",
        "strength",
        "endurance",
        "general_fitness",
      ],
      gender: ["male", "female", "prefer_not_to_say"],
      height_unit: ["ft", "cm"],
      training_experience: ["beginner", "intermediate", "advanced"],
      weight_unit: ["lbs", "kg"],
      workout_status: ["in_progress", "completed", "expired"],
    },
  },
} as const

