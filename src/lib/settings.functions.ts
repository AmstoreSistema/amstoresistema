import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAppSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) throw error;
    return data || [];
  });

export const updateAppSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key: z.string(), value: z.any() }).parse(data))
  .handler(async ({ data, context }) => {
    // Check if user is admin via RPC or direct check
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error("Apenas administradores podem alterar as configurações.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ 
        key: data.key, 
        value: typeof data.value === 'string' ? data.value : JSON.stringify(data.value), 
        updated_at: new Date().toISOString() 
      });
    if (error) throw error;
    return { success: true };
  });

export const updateAppSettingsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.array(z.object({ key: z.string(), value: z.any() })).parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleData } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error("Apenas administradores podem alterar as configurações.");
    }

    const upserts = data.map(item => ({
      key: item.key,
      value: typeof item.value === 'string' ? item.value : JSON.stringify(item.value),
      updated_at: new Date().toISOString()
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(upserts);

    if (error) throw error;
    return { success: true };
  });

export const getUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_profiles").select("*, user_roles(role)");
    if (error) throw error;
    return data || [];
  });

export const updateUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string(), role: z.enum(["admin", "moderator", "user"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw error;
    return { success: true };
  });
