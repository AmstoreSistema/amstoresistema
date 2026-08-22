import { brl, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface ReportLayoutProps {
  title: string;
  startDate?: string;
  endDate?: string;
  storeInfo?: {
    name?: string;
    cnpj?: string;
    contact?: string;
    logo?: string;
  };
  columns: { key: string; label: string; align?: "right" }[];
  rows: Record<string, any>[];
  id?: string;
}

export function ReportLayout({
  title,
  startDate,
  endDate,
  storeInfo,
  columns,
  rows,
  id,
}: ReportLayoutProps) {
  const periodText = startDate && endDate 
    ? `Período: ${dateBR(startDate)} até ${dateBR(endDate)}`
    : startDate 
      ? `A partir de: ${dateBR(startDate)}`
      : endDate
        ? `Até: ${dateBR(endDate)}`
        : "Período: Geral";

  return (
    <div id={id} className="report-container bg-white p-8 text-slate-900 animate-in fade-in duration-500">
      {/* Top Header Section */}
      <div className="mb-8 flex flex-col items-center text-center sm:items-start sm:text-left">
        {storeInfo?.logo && (
          <div className="mb-4">
            <img 
              src={storeInfo.logo} 
              alt="Logo da Empresa" 
              className="max-h-24 max-w-[200px] object-contain print:max-h-20"
            />
          </div>
        )}
        
        <div className="space-y-1">
          <h2 className="text-xl font-bold uppercase tracking-tight text-slate-800">
            {storeInfo?.name || "Amstore Gestão"}
          </h2>
          {storeInfo?.cnpj && (
            <p className="text-sm font-medium text-slate-500">CNPJ: {storeInfo.cnpj}</p>
          )}
          {storeInfo?.contact && (
            <p className="text-sm font-medium text-slate-500">{storeInfo.contact}</p>
          )}
        </div>

        <div className="mt-8 w-full border-y border-slate-200 py-4">
          <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">
            {title}
          </h1>
          <p className="mt-1 text-sm font-bold text-slate-600">
            {periodText}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm print:border-none print:shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-900 hover:bg-slate-900 print:bg-slate-100">
              {columns.map((col) => (
                <TableHead 
                  key={col.key}
                  className={cn(
                    "h-11 px-4 text-[11px] font-black uppercase tracking-wider text-white print:text-slate-900",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length} 
                  className="h-32 text-center text-sm font-medium text-slate-500"
                >
                  Nenhum dado encontrado para o período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow 
                  key={i} 
                  className="border-b border-slate-100 even:bg-slate-50/50 hover:bg-slate-50 print:even:bg-slate-50"
                >
                  {columns.map((col) => (
                    <TableCell 
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-sm font-semibold text-slate-700",
                        col.align === "right" ? "text-right" : "text-left"
                      )}
                    >
                      {row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Footer / Meta (Optional) */}
      <div className="mt-8 hidden border-t border-slate-100 pt-4 text-[10px] font-bold text-slate-400 print:block">
        Relatório gerado em {new Date().toLocaleString('pt-BR')} via Amstore Gestão
      </div>
    </div>
  );
}
