import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/users-debug')({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: users, error: usersError } = await supabaseAdmin.from("user_profiles").select("*, user_roles(role)");
        const { data: roles, error: rolesError } = await supabaseAdmin.from("user_roles").select("*");
        
        return new Response(JSON.stringify({ 
          profiles: users, 
          roles: roles,
          errors: { usersError, rolesError }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
})
