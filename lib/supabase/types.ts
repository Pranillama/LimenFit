type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      exercises: {
        Row: {
          category: string
          created_at: string
          equipment: string | null
          id: string
          is_custom: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          equipment?: string | null
          id?: string
          is_custom?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string
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
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          mutation_type: string
          processed_at?: string
          resource_id?: string | null
          resource_type: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          mutation_type?: string
          processed_at?: string
          resource_id?: string | null
          resource_type?: string
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
          created_at: string
          id: string
          is_public: boolean
          name: string
          share_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          share_slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          share_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          id: string
          logged_at: string
          reps: number
          set_number: number
          weight_unit: Database["public"]["Enums"]["weight_unit"]
          weight_value: number
          workout_exercise_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          reps: number
          set_number: number
          weight_unit: Database["public"]["Enums"]["weight_unit"]
          weight_value: number
          workout_exercise_id: string
        }
        Update: {
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
          id: string
          rest_timer_default_seconds: number
          updated_at: string
          user_id: string
          weight_unit: Database["public"]["Enums"]["weight_unit"]
        }
        Insert: {
          created_at?: string
          id?: string
          rest_timer_default_seconds?: number
          updated_at?: string
          user_id: string
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
        }
        Update: {
          created_at?: string
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
          exercise_id: string
          id: string
          position: number
          workout_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          position: number
          workout_id: string
        }
        Update: {
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
      generate_share_slug: { Args: never; Returns: string }
    }
    Enums: {
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

type Tables<
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

type TablesInsert<
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

type TablesUpdate<
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

type Enums<
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

type CompositeTypes<
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
