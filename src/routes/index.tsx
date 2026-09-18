import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getRefreshTokenCookie, saveRefreshTokenCookie } from "@/lib/auth-cookie";
import { touchActivity } from "@/lib/session-timeout";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const rt = getRefreshTokenCookie();
      if (rt) {
        try {
          const { data } = await supabase.auth.refreshSession({ refresh_token: rt });
          session = data.session;
          if (session?.refresh_token) {
            saveRefreshTokenCookie(session.refresh_token);
          }
        } catch {}
      }
    }

    if (session) {
      touchActivity();
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0c]">
      <div className="size-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
    </div>
  ),
});