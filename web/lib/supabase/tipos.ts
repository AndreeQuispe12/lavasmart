export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      asistencia: {
        Row: {
          autorizado_por: string | null
          descuento_monto: number
          descuento_motivo: string | null
          estado: Database["public"]["Enums"]["estado_asistencia"]
          fecha: string
          hora_ingreso: string | null
          hora_referencia: string
          id: number
          porcentaje_destajo: number | null
          registrado_en: string
          tolerancia_minutos: number
          trabajador_id: number
        }
        Insert: {
          autorizado_por?: string | null
          descuento_monto?: number
          descuento_motivo?: string | null
          estado: Database["public"]["Enums"]["estado_asistencia"]
          fecha?: string
          hora_ingreso?: string | null
          hora_referencia: string
          id?: never
          porcentaje_destajo?: number | null
          registrado_en?: string
          tolerancia_minutos: number
          trabajador_id: number
        }
        Update: {
          autorizado_por?: string | null
          descuento_monto?: number
          descuento_motivo?: string | null
          estado?: Database["public"]["Enums"]["estado_asistencia"]
          fecha?: string
          hora_ingreso?: string | null
          hora_referencia?: string
          id?: never
          porcentaje_destajo?: number | null
          registrado_en?: string
          tolerancia_minutos?: number
          trabajador_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_autorizado_por_fk"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente: {
        Row: {
          creado_en: string
          id: number
          nombre: string | null
          placa: string
          telefono: string | null
          tipo_vehiculo_id: number
        }
        Insert: {
          creado_en?: string
          id?: never
          nombre?: string | null
          placa: string
          telefono?: string | null
          tipo_vehiculo_id: number
        }
        Update: {
          creado_en?: string
          id?: never
          nombre?: string | null
          placa?: string
          telefono?: string | null
          tipo_vehiculo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_tipo_vehiculo_fk"
            columns: ["tipo_vehiculo_id"]
            isOneToOne: false
            referencedRelation: "tipo_vehiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_segmento: {
        Row: {
          calculado_en: string
          cliente_id: number
          frecuencia: number
          id: number
          modelo_version: string
          monetario: number
          recencia_dias: number
          segmento: string
        }
        Insert: {
          calculado_en?: string
          cliente_id: number
          frecuencia: number
          id?: never
          modelo_version: string
          monetario: number
          recencia_dias: number
          segmento: string
        }
        Update: {
          calculado_en?: string
          cliente_id?: number
          frecuencia?: number
          id?: never
          modelo_version?: string
          monetario?: number
          recencia_dias?: number
          segmento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_segmento_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          actualizado_en: string
          clave: string
          descripcion: string | null
          valor: string
        }
        Insert: {
          actualizado_en?: string
          clave: string
          descripcion?: string | null
          valor: string
        }
        Update: {
          actualizado_en?: string
          clave?: string
          descripcion?: string | null
          valor?: string
        }
        Relationships: []
      }
      detalle_lavado: {
        Row: {
          id: number
          lavado_id: number
          precio_cobrado: number
          tipo_lavado_id: number
        }
        Insert: {
          id?: never
          lavado_id: number
          precio_cobrado: number
          tipo_lavado_id: number
        }
        Update: {
          id?: never
          lavado_id?: number
          precio_cobrado?: number
          tipo_lavado_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_lavado_fk"
            columns: ["lavado_id"]
            isOneToOne: false
            referencedRelation: "lavado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_lavado_fk"
            columns: ["lavado_id"]
            isOneToOne: false
            referencedRelation: "v_lavado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_tipo_lavado_fk"
            columns: ["tipo_lavado_id"]
            isOneToOne: false
            referencedRelation: "tipo_lavado"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencia: {
        Row: {
          cliente_id: number
          descripcion: string
          estado: Database["public"]["Enums"]["estado_incidencia"]
          fecha_reporte: string
          fecha_resolucion: string | null
          id: number
          lavado_id: number | null
          registrado_por: string | null
          resolucion: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
        }
        Insert: {
          cliente_id: number
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          fecha_reporte?: string
          fecha_resolucion?: string | null
          id?: never
          lavado_id?: number | null
          registrado_por?: string | null
          resolucion?: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
        }
        Update: {
          cliente_id?: number
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          fecha_reporte?: string
          fecha_resolucion?: string | null
          id?: never
          lavado_id?: number | null
          registrado_por?: string | null
          resolucion?: string | null
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
        }
        Relationships: [
          {
            foreignKeyName: "incidencia_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencia_lavado_fk"
            columns: ["lavado_id"]
            isOneToOne: false
            referencedRelation: "lavado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencia_lavado_fk"
            columns: ["lavado_id"]
            isOneToOne: false
            referencedRelation: "v_lavado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencia_registrado_por_fk"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      lavado: {
        Row: {
          cliente_id: number
          estado: Database["public"]["Enums"]["estado_lavado"]
          fecha_hora_entrega: string | null
          fecha_hora_ingreso: string
          id: number
          metodo_pago: Database["public"]["Enums"]["metodo_pago"] | null
          monto_cobrado: number
          observacion: string | null
          porcentaje_destajo: number | null
          registrado_por: string | null
          trabajador_id: number
        }
        Insert: {
          cliente_id: number
          estado?: Database["public"]["Enums"]["estado_lavado"]
          fecha_hora_entrega?: string | null
          fecha_hora_ingreso?: string
          id?: never
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"] | null
          monto_cobrado?: number
          observacion?: string | null
          porcentaje_destajo?: number | null
          registrado_por?: string | null
          trabajador_id: number
        }
        Update: {
          cliente_id?: number
          estado?: Database["public"]["Enums"]["estado_lavado"]
          fecha_hora_entrega?: string | null
          fecha_hora_ingreso?: string
          id?: never
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"] | null
          monto_cobrado?: number
          observacion?: string | null
          porcentaje_destajo?: number | null
          registrado_por?: string | null
          trabajador_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "lavado_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavado_registrado_por_fk"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavado_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidacion: {
        Row: {
          cerrada: boolean
          entregada: boolean
          fecha: string
          fecha_cierre: string | null
          fecha_entrega: string | null
          id: number
          monto_cobrado_base: number
          monto_descuento: number
          monto_destajo: number
          monto_sueldo: number
          trabajador_id: number
        }
        Insert: {
          cerrada?: boolean
          entregada?: boolean
          fecha: string
          fecha_cierre?: string | null
          fecha_entrega?: string | null
          id?: never
          monto_cobrado_base?: number
          monto_descuento?: number
          monto_destajo?: number
          monto_sueldo?: number
          trabajador_id: number
        }
        Update: {
          cerrada?: boolean
          entregada?: boolean
          fecha?: string
          fecha_cierre?: string | null
          fecha_entrega?: string | null
          id?: never
          monto_cobrado_base?: number
          monto_descuento?: number
          monto_destajo?: number
          monto_sueldo?: number
          trabajador_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_metrica: {
        Row: {
          entrenado_en: string
          filas_entrenamiento: number
          id: number
          metrica: string
          modelo: Database["public"]["Enums"]["tipo_modelo"]
          valor: number
          version: string
        }
        Insert: {
          entrenado_en?: string
          filas_entrenamiento: number
          id?: never
          metrica: string
          modelo: Database["public"]["Enums"]["tipo_modelo"]
          valor: number
          version: string
        }
        Update: {
          entrenado_en?: string
          filas_entrenamiento?: number
          id?: never
          metrica?: string
          modelo?: Database["public"]["Enums"]["tipo_modelo"]
          valor?: number
          version?: string
        }
        Relationships: []
      }
      perfil: {
        Row: {
          creado_en: string
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          trabajador_id: number | null
        }
        Insert: {
          creado_en?: string
          id: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          trabajador_id?: number | null
        }
        Update: {
          creado_en?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          trabajador_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: true
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      prediccion_demanda: {
        Row: {
          fecha_objetivo: string
          generado_en: string
          id: number
          intervalo_inferior: number | null
          intervalo_superior: number | null
          modelo_version: string
          vehiculos_estimados: number
        }
        Insert: {
          fecha_objetivo: string
          generado_en?: string
          id?: never
          intervalo_inferior?: number | null
          intervalo_superior?: number | null
          modelo_version: string
          vehiculos_estimados: number
        }
        Update: {
          fecha_objetivo?: string
          generado_en?: string
          id?: never
          intervalo_inferior?: number | null
          intervalo_superior?: number | null
          modelo_version?: string
          vehiculos_estimados?: number
        }
        Relationships: []
      }
      tarifa: {
        Row: {
          activo: boolean
          actualizado_en: string
          id: number
          precio: number
          tipo_lavado_id: number
          tipo_vehiculo_id: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          id?: never
          precio: number
          tipo_lavado_id: number
          tipo_vehiculo_id: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          id?: never
          precio?: number
          tipo_lavado_id?: number
          tipo_vehiculo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_tipo_lavado_fk"
            columns: ["tipo_lavado_id"]
            isOneToOne: false
            referencedRelation: "tipo_lavado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifa_tipo_vehiculo_fk"
            columns: ["tipo_vehiculo_id"]
            isOneToOne: false
            referencedRelation: "tipo_vehiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_lavado: {
        Row: {
          activo: boolean
          creado_en: string
          descripcion: string | null
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      tipo_vehiculo: {
        Row: {
          activo: boolean
          creado_en: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      trabajador: {
        Row: {
          activo: boolean
          apellidos: string
          creado_en: string
          documento: string
          fecha_ingreso: string
          frecuencia: Database["public"]["Enums"]["frecuencia_pago"]
          id: number
          modalidad: Database["public"]["Enums"]["modalidad_pago"]
          nombres: string
          sueldo_dia: number | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          creado_en?: string
          documento: string
          fecha_ingreso?: string
          frecuencia: Database["public"]["Enums"]["frecuencia_pago"]
          id?: never
          modalidad: Database["public"]["Enums"]["modalidad_pago"]
          nombres: string
          sueldo_dia?: number | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          creado_en?: string
          documento?: string
          fecha_ingreso?: string
          frecuencia?: Database["public"]["Enums"]["frecuencia_pago"]
          id?: never
          modalidad?: Database["public"]["Enums"]["modalidad_pago"]
          nombres?: string
          sueldo_dia?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_caja_dia: {
        Row: {
          autos_entregados: number | null
          cobrado_efectivo: number | null
          cobrado_total: number | null
          cobrado_yape: number | null
          fecha: string | null
        }
        Relationships: []
      }
      v_lavado: {
        Row: {
          cliente_id: number | null
          estado: Database["public"]["Enums"]["estado_lavado"] | null
          estado_pago: string | null
          fecha_hora_entrega: string | null
          fecha_hora_ingreso: string | null
          id: number | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago"] | null
          monto_cobrado: number | null
          monto_total: number | null
          observacion: string | null
          placa: string | null
          porcentaje_destajo: number | null
          registrado_por: string | null
          saldo: number | null
          tipo_vehiculo_id: number | null
          trabajador_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_tipo_vehiculo_fk"
            columns: ["tipo_vehiculo_id"]
            isOneToOne: false
            referencedRelation: "tipo_vehiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavado_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavado_registrado_por_fk"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lavado_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      v_liquidacion: {
        Row: {
          cerrada: boolean | null
          entregada: boolean | null
          fecha: string | null
          fecha_cierre: string | null
          fecha_entrega: string | null
          id: number | null
          monto_a_pagar: number | null
          monto_cobrado_base: number | null
          monto_descuento: number | null
          monto_destajo: number | null
          monto_sueldo: number | null
          trabajador_id: number | null
        }
        Insert: {
          cerrada?: boolean | null
          entregada?: boolean | null
          fecha?: string | null
          fecha_cierre?: string | null
          fecha_entrega?: string | null
          id?: number | null
          monto_a_pagar?: never
          monto_cobrado_base?: number | null
          monto_descuento?: number | null
          monto_destajo?: number | null
          monto_sueldo?: number | null
          trabajador_id?: number | null
        }
        Update: {
          cerrada?: boolean | null
          entregada?: boolean | null
          fecha?: string | null
          fecha_cierre?: string | null
          fecha_entrega?: string | null
          id?: number | null
          monto_a_pagar?: never
          monto_cobrado_base?: number | null
          monto_descuento?: number | null
          monto_destajo?: number | null
          monto_sueldo?: number | null
          trabajador_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
      v_por_pagar: {
        Row: {
          desde: string | null
          dias: number | null
          hasta: string | null
          monto: number | null
          trabajador_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_trabajador_fk"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajador"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_calcular_liquidacion: {
        Args: { p_fecha: string }
        Returns: {
          autos_en_piso: number
          modalidad: Database["public"]["Enums"]["modalidad_pago"]
          monto_cobrado_base: number
          monto_descuento: number
          monto_destajo: number
          monto_sueldo: number
          trabajador_id: number
        }[]
      }
      fn_cerrar_dia: {
        Args: { p_fecha: string }
        Returns: {
          resultado: string
          trabajador_id: number
        }[]
      }
      fn_entregar_pago: {
        Args: { p_hasta: string; p_trabajador_id: number }
        Returns: {
          dias: number
          monto: number
        }[]
      }
      fn_es_dueno: { Args: never; Returns: boolean }
      fn_es_personal: { Args: never; Returns: boolean }
      fn_registrar_entrega: {
        Args: {
          p_lavado_id: number
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_monto: number
        }
        Returns: undefined
      }
      fn_registrar_ingreso: {
        Args: {
          p_observacion?: string
          p_placa: string
          p_servicios: number[]
          p_tipo_vehiculo_id: number
          p_trabajador_id: number
        }
        Returns: number
      }
    }
    Enums: {
      estado_asistencia: "puntual" | "tardanza" | "no_laboro" | "falta"
      estado_incidencia: "abierta" | "en_proceso" | "resuelta"
      estado_lavado: "en_proceso" | "entregado" | "anulado"
      frecuencia_pago: "diario" | "semanal"
      metodo_pago: "efectivo" | "yape"
      modalidad_pago: "destajo" | "fijo"
      rol_usuario: "dueno" | "operador"
      tipo_incidencia:
        | "dano"
        | "servicio_incompleto"
        | "objeto_faltante"
        | "otro"
      tipo_modelo: "regresion" | "kmeans"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_asistencia: ["puntual", "tardanza", "no_laboro", "falta"],
      estado_incidencia: ["abierta", "en_proceso", "resuelta"],
      estado_lavado: ["en_proceso", "entregado", "anulado"],
      frecuencia_pago: ["diario", "semanal"],
      metodo_pago: ["efectivo", "yape"],
      modalidad_pago: ["destajo", "fijo"],
      rol_usuario: ["dueno", "operador"],
      tipo_incidencia: [
        "dano",
        "servicio_incompleto",
        "objeto_faltante",
        "otro",
      ],
      tipo_modelo: ["regresion", "kmeans"],
    },
  },
} as const
