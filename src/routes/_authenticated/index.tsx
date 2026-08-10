import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua produção e materiais.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total de Materiais" value="90" sub="1 crítico" icon="📦" color="bg-blue-500" />
        <StatsCard title="Ordens Ativas" value="0" sub="De um total de 21" icon="🏭" color="bg-emerald-500" />
        <StatsCard title="Produtos em Estoque" value="105" sub="84 com estoque baixo" icon="📋" color="bg-violet-500" />
        <StatsCard title="Vendas Hoje" value="1" sub="Vendas realizadas hoje" icon="💰" color="bg-orange-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <div className="col-span-4 bg-card rounded-xl border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center">
            <span className="mr-2">📊</span> Materiais por Tipo
          </h3>
          <div className="h-[250px] flex items-end justify-between space-x-2 pt-4">
            <Bar height="60%" label="Almoxarifado" />
            <Bar height="90%" label="Couro" />
            <Bar height="75%" label="Ferragem" />
            <Bar height="15%" label="Outros" />
            <Bar height="5%" label="Forros" />
            <Bar height="2%" label="Cola" />
            <Bar height="30%" label="Linha" />
          </div>
        </div>
        <div className="col-span-3 bg-card rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-muted-foreground mb-6 self-start flex items-center">
            <span className="mr-2">📈</span> Status das Produções
          </h3>
          <div className="relative w-48 h-48 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">
            Concluída 100%
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, sub, icon, color }: { title: string, value: string, sub: string, icon: string, color: string }) {
  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-xl text-white shadow-lg shadow-${color.split('-')[1]}-200`}>
          {icon}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Ver</span>
      </div>
      <div className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Bar({ height, label }: { height: string, label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center group">
      <div className="w-full bg-blue-100 rounded-t-md relative flex items-end h-full">
        <div 
          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-500 ease-in-out group-hover:brightness-110"
          style={{ height }}
        />
      </div>
      <span className="text-[9px] mt-2 text-muted-foreground font-medium truncate w-full text-center">{label}</span>
    </div>
  );
}
