const FIXED_ADMINS = ["amstorebagshoes@gmail.com", "matosmonica000@gmail.com"];

/**
 * Verificação de administrador confiável:
 * - usa a service role (ignora RLS) para ler o cargo
 * - aceita e-mails fixos de administrador (a partir do token, sem depender de tabelas)
 * - garante o registro de cargo quando o e-mail é de um administrador fixo
 */
export async function assertAdmin(userId: string, claims: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email: string | undefined =
    (claims?.email as string | undefined) ?? (claims?.user_metadata?.email as string | undefined);

  const emailIsFixedAdmin = !!email && FIXED_ADMINS.includes(email.toLowerCase());

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  let isAdmin = (roles || []).some((r: any) => r.role === "admin");

  if (!isAdmin && !emailIsFixedAdmin) {
    // fallback: perfil salvo com e-mail de administrador fixo
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const profileEmail = profile?.email?.toLowerCase();
    if (profileEmail && FIXED_ADMINS.includes(profileEmail)) {
      isAdmin = true;
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }
  }

  if (!isAdmin && emailIsFixedAdmin) {
    isAdmin = true;
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  }

  if (!isAdmin) {
    throw new Error("Apenas administradores podem executar esta ação.");
  }

  return true;
}
