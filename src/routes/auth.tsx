import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { touchActivity } from "@/lib/session-timeout";
import { saveRefreshTokenCookie } from "@/lib/auth-cookie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/amstore-symbol.png.asset.json";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Amstore Gestão" },
      { name: "description", content: "Acesse o sistema Amstore Gestão." },
      { property: "og:title", content: "Entrar | Amstore Gestão" },
      { property: "og:description", content: "Acesse o sistema Amstore Gestão." },
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
          touchActivity();
          saveRefreshTokenCookie(data.session.refresh_token);
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0c] p-4 text-neutral-100">
      <div className="w-full max-w-[400px]">
        {/* Card Principal */}
        <div className="rounded-2xl border border-neutral-800/80 bg-[#121214] p-8 shadow-2xl">
          {/* Cabeçalho */}
          <div className="flex flex-col items-center text-center mb-6">
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt="Amstore" 
                className="h-12 w-auto object-contain mb-4" 
              />
            ) : (
              <div className="size-10 rounded-xl bg-neutral-800 flex items-center justify-center font-bold text-white mb-4">
                A
              </div>
            )}

            <h1 className="text-xl font-semibold text-white tracking-tight">
              {mode === "signin" ? "Acessar Sistema" : "Recuperar Senha"}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {mode === "signin"
                ? "Entre com suas credenciais corporativas"
                : "Informe seu e-mail para receber as instruções"}
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-neutral-300">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@empresa.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-lg bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-500 text-sm focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-neutral-300">
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    Esqueceu?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    minLength={6}
                    className="h-11 rounded-lg bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-500 text-sm pr-10 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-white hover:bg-neutral-200 text-neutral-950 font-medium text-sm transition-colors mt-2 shadow-xs cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin text-neutral-950" />
                  <span>Entrando...</span>
                </span>
              ) : mode === "signin" ? (
                "Entrar"
              ) : (
                "Enviar Instruções"
              )}
            </Button>
          </form>

          {mode === "forgot" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Voltar para o login
              </button>
            </div>
          )}
        </div>

        {/* Rodapé institucional discreto */}
        <p className="text-center text-[11px] text-neutral-500 mt-6">
          Amstore Gestão • Acesso Restrito
        </p>
      </div>
    </div>
  );
}
