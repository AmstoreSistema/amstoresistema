import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";

const FIXED_ADMINS = ["amstorebagshoes@gmail.com", "matosmonica000@gmail.com"];

export const getAppSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("app_settings").select("*");
    if (error) throw error;
    return data || [];
  });

export const updateAppSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ key: z.string(), value: z.any() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

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
  .validator((data) => z.array(z.object({ key: z.string(), value: z.any() })).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

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
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, authList] = await Promise.all([
      supabaseAdmin.from("user_profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    const roleMap = new Map<string, string>();
    (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

    // Garante que todo usuário de autenticação apareça, mesmo sem perfil salvo
    (authList?.data?.users || []).forEach((u: any) => {
      if (!profileMap.has(u.id)) {
        profileMap.set(u.id, {
          id: u.id,
          email: u.email,
          display_name: u.user_metadata?.display_name || null,
          active: true,
        });
      } else if (!profileMap.get(u.id).email) {
        profileMap.get(u.id).email = u.email;
      }
    });

    return Array.from(profileMap.values()).map((p: any) => {
      const role =
        roleMap.get(p.id) ||
        (p.email && FIXED_ADMINS.includes(p.email) ? "admin" : "user");
      return { ...p, role, user_roles: [{ role }] };
    });
  });

export const updateUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ userId: z.string(), role: z.enum(["admin", "moderator", "user"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });

    if (error) throw error;
    return { success: true };
  });

/** Atualiza o nome real da pessoa que usa aquele login. */
export const updateUserName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ userId: z.string(), display_name: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const display_name = data.display_name.trim();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { display_name },
    });
    if (authError) throw authError;

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { id: data.userId, display_name, email: authUser.user.email ?? null, active: true },
        { onConflict: "id" },
      );
    if (error) throw error;

    return { success: true };
  });

export const createNewUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ 
    email: z.string().email(), 
    password: z.string().min(6),
    display_name: z.string(),
    role: z.enum(["admin", "moderator", "user"])
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name }
    });

    if (authError) throw authError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: authUser.user.id, role: data.role }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    await supabaseAdmin.from("user_profiles").upsert(
      {
        id: authUser.user.id,
        email: data.email,
        display_name: data.display_name.trim() || null,
        active: true,
      },
      { onConflict: "id" },
    );

    return { success: true };
  });

/**
 * Garante que administradores fixos (amstorebagshoes e matosmonica000)
 * tenham papel de admin gravado no banco de dados (tabela user_roles)
 * e retorna os dados de exibição do usuário atual sem bloqueio de RLS.
 */
export const syncCurrentAdminProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const userEmail = (context.claims?.email || context.claims?.user_metadata?.email || "").toLowerCase();

    const isFixedAdmin = FIXED_ADMINS.includes(userEmail);

    if (isFixedAdmin) {
      // 1. Garante o papel de admin para o usuário conectado
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

      // 2. Garante o papel de admin para todos os administradores fixos
      try {
        const authList = await supabaseAdmin.auth.admin.listUsers();
        for (const u of authList.data.users) {
          const email = (u.email || "").toLowerCase();
          if (FIXED_ADMINS.includes(email)) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: u.id, role: "admin" }, { onConflict: "user_id,role" });
          }
        }
      } catch (err) {
        console.error("Erro ao sincronizar administradores fixos no banco:", err);
      }
    }

    // 3. Busca o perfil gravado no user_profiles
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name, email, active")
      .eq("id", userId)
      .maybeSingle();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const metaName = authUser?.user?.user_metadata?.display_name;
    const displayName = (profile?.display_name || metaName || "").trim();

    // 4. Se houver nome nos metadados ou no perfil, assegura que ambos estejam preenchidos
    if (displayName && (!profile || !profile.display_name)) {
      await supabaseAdmin
        .from("user_profiles")
        .upsert({ id: userId, email: userEmail, display_name: displayName, active: true }, { onConflict: "id" });
    }

    return {
      displayName,
      email: userEmail,
      isAdmin: isFixedAdmin,
    };
  });
