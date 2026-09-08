import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/amstore-symbol.png.asset.json";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso | AMSTORE GESTÃO FINANCEIRA" },
      { name: "description", content: "Entre no sistema AmStore Gestão para administrar vendas, estoque e financeiro." },
      { property: "og:title", content: "Acesso | AMSTORE GESTÃO FINANCEIRA" },
      { property: "og:description", content: "Entre no sistema AmStore Gestão para administrar vendas, estoque e financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "store_logo").maybeSingle();
      if (!active) return;
      let url = logoAsset.url;
      if (data?.value) {
        try {
          url = JSON.parse(data.value) || logoAsset.url;
        } catch {
          url = data.value || logoAsset.url;
        }
      }
      setStoreLogo(url);
    })();
    return () => {
      active = false;
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(`Erro ao acessar: ${error.message}`);
        } else if (data.session) {
          window.location.href = "/dashboard";
        }
        return;
      }


      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(`Erro ao enviar recuperação: ${error.message}`);
      } else {
        toast.success("Enviamos um link de redefinição de senha para o seu e-mail.");
        setMode("signin");
      }
    } catch {
      toast.error("Ocorreu um erro ao processar a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, { title: string; description: string; action: string }> = {
    signin: { title: "AMSTORE GESTÃO FINANCEIRA", description: "Entre no sistema para gerenciar sua produção", action: "Entrar" },

    forgot: { title: "Recuperar senha", description: "Enviaremos um link para você definir uma nova senha", action: "Enviar link" },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/20 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-xl shadow-lg border">
              {storeLogo ? (
                <img src={storeLogo} alt="AmStore Gestão" className="h-14 w-auto object-contain" />
              ) : (
                <div className="h-14 w-14 animate-pulse rounded-md bg-muted" />
              )}
            </div>

          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{titles[mode].title}</CardTitle>
          <CardDescription>{titles[mode].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    minLength={8}
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full font-semibold py-6" disabled={loading}>
              {loading ? "Processando..." : titles[mode].action}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center text-sm">
            {mode !== "signin" && (
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("signin")}>
                Voltar para o login
              </button>
            )}
            {mode === "signin" && (
              <>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>
                  Esqueci minha senha
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
