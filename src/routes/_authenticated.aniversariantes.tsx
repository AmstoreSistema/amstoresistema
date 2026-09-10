import { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Cake,
  Download,
  MessageCircle,
  Image as ImageIcon,
  Sliders,
  User,
  Phone,
  RefreshCw,
  Sparkles,
  Calendar,
  Gift,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRows } from "@/lib/data";
import { filterBirthdaysToday } from "@/lib/birthdays";

export const Route = createFileRoute("/_authenticated/aniversariantes")({
  head: () => ({
    meta: [
      { title: "Aniversariantes do Dia — Amstore Gestão" },
      {
        name: "description",
        content: "Gerencie e parabenize os aniversariantes do dia com cartões personalizados e WhatsApp.",
      },
    ],
  }),
  component: AniversariantesPage,
});

const DEFAULT_CARD_BG = "/cartao-aniversario-template.jpg";

function AniversariantesPage() {
  const { data: clients = [], isLoading } = useRows<any>("clients", {
    order: { column: "name", ascending: true },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [customName, setCustomName] = useState("");
  const [bgImageUrl, setBgImageUrl] = useState(DEFAULT_CARD_BG);
  const [posX, setPosX] = useState(50); // Padrão 50%
  const [posY, setPosY] = useState(45); // Padrão 45%

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);

  // Filtra os aniversariantes de hoje
  const birthdaysToday = useMemo(() => {
    return filterBirthdaysToday(clients);
  }, [clients]);

  // Filtra por termo de busca se necessário
  const filteredBirthdays = useMemo(() => {
    if (!searchTerm.trim()) return birthdaysToday;
    const term = searchTerm.toLowerCase();
    return birthdaysToday.filter(
      (c) =>
        (c.name || c.nome || "").toLowerCase().includes(term) ||
        (c.phone || c.telefone || "").includes(term)
    );
  }, [birthdaysToday, searchTerm]);

  // Seleciona o primeiro aniversariante automaticamente quando carregar
  useEffect(() => {
    if (birthdaysToday.length > 0 && !selectedClient) {
      setSelectedClient(birthdaysToday[0]);
      setCustomName(birthdaysToday[0].name || birthdaysToday[0].nome || "");
    }
  }, [birthdaysToday, selectedClient]);

  // Atualiza o nome personalizado quando o cliente selecionado muda
  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setCustomName(client.name || client.nome || "");
  };

  // Garante o carregamento da fonte Sacramento
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.fonts
        .load('80px "Sacramento"')
        .then(() => {
          setFontLoaded(true);
        })
        .catch(() => {
          setFontLoaded(true);
        });
    }
  }, []);

  // Renderiza no <canvas>
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = bgImageUrl;

    img.onload = () => {
      setImageLoaded(true);

      // Define a resolução interna do canvas baseada na imagem original (alta resolução)
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 900;

      // 1. Desenha a imagem base de fundo
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 2. Desenha o nome do cliente por cima
      if (customName.trim()) {
        const x = (posX / 100) * canvas.width;
        const y = (posY / 100) * canvas.height;

        ctx.font = '80px "Sacramento", cursive';
        ctx.fillStyle = "#8B4513"; // Cor marrom conforme especificado
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(customName.trim(), x, y);
      }
    };

    img.onerror = () => {
      // Fallback elegante se a imagem não carregar
      canvas.width = 1200;
      canvas.height = 900;
      ctx.fillStyle = "#fff5f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      if (customName.trim()) {
        const x = (posX / 100) * canvas.width;
        const y = (posY / 100) * canvas.height;
        ctx.font = '80px "Sacramento", cursive';
        ctx.fillStyle = "#8B4513";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(customName.trim(), x, y);
      }
    };
  }, [bgImageUrl, customName, posX, posY, fontLoaded]);

  // Botão Baixar Cartão
  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const safeName = (customName || selectedClient?.name || "cliente")
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "_");

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.download = `cartao-aniversario-${safeName}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success("Cartão de aniversário baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o download. Tente novamente.");
    }
  };

  // Botão Enviar WhatsApp
  const handleSendWhatsApp = () => {
    if (!selectedClient) {
      toast.error("Nenhum cliente selecionado.");
      return;
    }

    const rawPhone = selectedClient.phone || selectedClient.telefone || "";
    const phoneDigits = rawPhone.replace(/\D/g, "");

    if (!phoneDigits) {
      toast.error("O cliente selecionado não possui número de telefone/WhatsApp cadastrado.");
      return;
    }

    const finalPhone =
      phoneDigits.startsWith("55") && phoneDigits.length >= 12
        ? phoneDigits
        : `55${phoneDigits}`;

    const clientName = customName.trim() || selectedClient.name || selectedClient.nome || "amigo(a)";
    const message = `Olá ${clientName}! 🎂🎉 Feliz Aniversário! Que este dia seja repleto de alegrias e realizações! 🎁`;
    const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank");
    toast.success("Abrindo WhatsApp com a mensagem de felicitações!");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Aniversariantes do Dia"
        description="Felicite seus clientes no dia do aniversário com cartões comemorativos personalizados."
        icon={Cake}
        actions={
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link to="/clients">
              <User className="size-4" />
              Base de Clientes
            </Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* ================= COLUNA ESQUERDA: LISTA DE ANIVERSARIANTES ================= */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <Card className="rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>🎂</span>
                  Aniversariantes de Hoje
                </CardTitle>
                <Badge variant="secondary" className="font-bold">
                  {birthdaysToday.length}
                </Badge>
              </div>

              {birthdaysToday.length > 5 && (
                <div className="relative pt-2">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar aniversariante..."
                    className="h-8 pl-8 text-xs rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : filteredBirthdays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <span className="text-4xl mb-2 select-none opacity-40">🎂</span>
                  <p className="text-sm font-semibold">Nenhum aniversariante hoje</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Cadastre a data de nascimento dos clientes para receber os alertas diários.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBirthdays.map((client) => {
                    const isSelected = selectedClient?.id === client.id;
                    const name = client.name || client.nome || "Cliente";
                    const phone = client.phone || client.telefone;

                    return (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-2xl p-3.5 transition-all border ${
                          isSelected
                            ? "border-pink-500 bg-pink-50/80 dark:bg-pink-950/30 shadow-sm ring-2 ring-pink-400/40"
                            : "border-border/50 bg-card hover:border-border hover:bg-muted/30"
                        } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                              isSelected
                                ? "bg-pink-500 text-white shadow-sm"
                                : "bg-muted text-muted-foreground group-hover:text-foreground"
                            }`}
                          >
                            🎂
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`truncate text-sm font-bold ${
                                isSelected ? "text-pink-950 dark:text-pink-100" : "text-foreground"
                              }`}
                            >
                              {name}
                            </p>
                            {phone ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="size-3 text-emerald-500" />
                                {phone}
                              </p>
                            ) : (
                              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 italic mt-0.5">
                                Sem telefone
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-xl select-none" title="Aniversariante">
                          🎁
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================= COLUNA DIREITA: EDITOR DO CARTÃO EM CANVAS ================= */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="size-4 text-pink-500" />
                    Editor de Cartão de Aniversário
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Personalize o nome e posicione no cartão antes de baixar ou enviar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleDownloadCard}
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl font-semibold h-9"
                  >
                    <Download className="size-4 text-pink-600" />
                    Baixar Cartão
                  </Button>

                  <Button
                    onClick={handleSendWhatsApp}
                    size="sm"
                    className="gap-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9"
                  >
                    <MessageCircle className="size-4" />
                    Enviar WhatsApp
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Controles de Personalização */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border/50 bg-muted/20 p-4">
                {/* Nome escrito no cartão */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">
                    Nome escrito no cartão (Fonte cursiva Sacramento)
                  </Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nome do aniversariante..."
                    className="h-10 rounded-xl bg-background font-medium"
                  />
                </div>

                {/* Slider Posição Horizontal */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-muted-foreground" />
                      Posição Horizontal
                    </Label>
                    <span className="text-muted-foreground font-mono">{posX}%</span>
                  </div>
                  <Slider
                    value={[posX]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(val) => setPosX(val[0] ?? 0)}
                    className="cursor-pointer"
                  />
                </div>

                {/* Slider Posição Vertical */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-muted-foreground" />
                      Posição Vertical
                    </Label>
                    <span className="text-muted-foreground font-mono">{posY}%</span>
                  </div>
                  <Slider
                    value={[posY]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(val) => setPosY(val[0] ?? 0)}
                    className="cursor-pointer"
                  />
                </div>

                {/* URL da imagem de fundo configurável */}
                <div className="space-y-1.5 sm:col-span-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-muted-foreground" />
                      URL da Imagem Base (Arte do Cartão)
                    </Label>
                    {bgImageUrl !== DEFAULT_CARD_BG && (
                      <button
                        type="button"
                        onClick={() => setBgImageUrl(DEFAULT_CARD_BG)}
                        className="text-[11px] text-pink-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="size-3" /> Restaurar arte padrão
                      </button>
                    )}
                  </div>
                  <Input
                    value={bgImageUrl}
                    onChange={(e) => setBgImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/arte-cartao.jpg ou /arte.jpg"
                    className="h-9 text-xs rounded-xl bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Você pode alterar a URL da arte do cartão a qualquer momento colando o link de uma imagem externa ou local.
                  </p>
                </div>
              </div>

              {/* Área de Visualização do Canvas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Pré-visualização em alta resolução</span>
                  <span className="font-mono text-[11px]">80px Sacramento • Cor #8B4513</span>
                </div>

                <div className="relative overflow-hidden rounded-2xl border-2 border-border/60 bg-muted/10 shadow-lg p-2 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-h-[520px] w-full max-w-full rounded-xl object-contain shadow-sm bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
