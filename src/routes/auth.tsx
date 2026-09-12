import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { touchActivity } from "@/lib/session-timeout";
import { saveRefreshTokenCookie } from "@/lib/auth-cookie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/amstore-symbol.png.asset.json";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowRight, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso Seguro | Amstore Gestão" },
      { name: "description", content: "Portal executivo de login do sistema Amstore Gestão: controle de vendas, estoque e finanças." },
      { property: "og:title", content: "Acesso Seguro | Amstore Gestão" },
      { property: "og:description", content: "Portal executivo de login do sistema Amstore Gestão: controle de vendas, estoque e finanças." },
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
          touchActivity(); // Registra atividade para iniciar o timer de 8h
          saveRefreshTokenCookie(data.session.refresh_token); // Salva cookie persistente
          toast.success("Login realizado com sucesso!");
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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#06080d] p-4 sm:p-6 select-none selection:bg-amber-500/30 selection:text-amber-200">
      {/* 1. Iluminação Ambiente e Gradientes de Fundo */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-b from-amber-500/20 via-amber-600/5 to-transparent blur-[140px]" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -bottom-40 right-1/4 size-[550px] rounded-full bg-slate-800/20 blur-[160px]" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:28px_28px] opacity-75" 
      />

      {/* 2. Container Central / Card Glassmorphic Premium */}
      <div className="relative w-full max-w-[440px] rounded-[2.5rem] border border-white/10 bg-slate-950/80 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Linha de brilho sutil no topo do card */}
        <div className="pointer-events-none absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

        {/* 3. Logomarca com Halo Dourado */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="relative mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-b from-zinc-800/90 via-zinc-900 to-zinc-950 border border-amber-500/30 p-3.5 shadow-2xl shadow-black/80 group">
            <div className="absolute inset-0 rounded-3xl bg-amber-500/15 blur-xl transition-all group-hover:bg-amber-500/30" />
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt="AmStore Gestão" 
                className="relative size-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" 
              />
            ) : (
              <div className="relative size-10 animate-pulse rounded-xl bg-amber-500/20" />
            )}
          </div>

          {/* Selo de Segurança */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-2.5 shadow-xs">
            <ShieldCheck className="size-3.5 text-amber-400" />
            Portal Executivo Amstore
          </div>

          {/* Título com Tipografia de Luxo */}
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
            {mode === "signin" ? (
              <>
                AM<span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">STORE</span>
              </>
            ) : (
              "Recuperar Senha"
            )}
          </h1>
          <p className="text-xs text-zinc-400 font-medium mt-1 max-w-[280px]">
            {mode === "signin"
              ? "Acesse o painel integrado de vendas, produção e controle financeiro."
              : "Insira seu e-mail cadastrado para redefinir sua senha de acesso."}
          </p>
        </div>

        {/* 4. Formulário de Acesso */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Mail className="size-3.5 text-amber-400" /> E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@amstore.com.br"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all text-sm font-medium px-4 shadow-inner"
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-amber-400" /> Senha
                </Label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-[11px] font-bold text-amber-400/90 hover:text-amber-300 hover:underline transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  minLength={6}
                  className="h-12 rounded-xl bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all text-sm font-medium px-4 pr-11 shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg"
                >
                  {showPassword ? <EyeOff className="size-4 text-amber-400" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Botão de Ação com Destaque Dourado */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-amber-500/20 transition-all duration-300 hover:shadow-amber-500/35 hover:scale-[1.01] active:scale-[0.99] gap-2 mt-3 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin text-slate-950" />
                <span>Autenticando...</span>
              </>
            ) : mode === "signin" ? (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="size-4 text-slate-950" />
              </>
            ) : (
              <>
                <span>Enviar Link de Recuperação</span>
                <ArrowRight className="size-4 text-slate-950" />
              </>
            )}
          </Button>
        </form>

        {/* 5. Ações Secundárias */}
        {mode === "forgot" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Voltar para a tela de login
            </button>
          </div>
        )}

        {/* 6. Rodapé do Card com Garantia de Segurança */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center justify-center gap-1.5 text-center">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
            <Sparkles className="size-3 text-amber-400" />
            <span>Ambiente Criptografado & Protegido</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">
            Amstore Gestão • Versão 2.5 • Acesso Restrito
          </p>
        </div>
      </div>
    </div>
  );
}
