import { dateBR, brl, num } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText } from "lucide-react";

interface ProductionDocumentProps {
  order: any;
  product: any;
  composition: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductionDocument({ order, product, composition, open, onOpenChange }: ProductionDocumentProps) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalMaterialCost = composition.reduce((acc, item) => acc + (item.total_cost || 0), 0);
  const laborCost = order.products?.labor_cost || 0;
  const totalProductionCost = totalMaterialCost + laborCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto p-0 gap-0 border-none print:max-w-none print:h-auto print:overflow-visible print:bg-white print:text-black">
        {/* Toolbar - hidden on print */}
        <div className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-card border-b border-border/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-gold" />
            <h2 className="font-bold">DANFE - Documento Auxiliar de Produção</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Download className="size-4" /> Baixar PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Printer className="size-4" /> Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Document Content */}
        <div id="production-document" className="p-10 bg-white text-black font-sans text-xs leading-relaxed print:p-0">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter mb-1">AMSTORE BAGSHOES</h1>
              <p>Rua Mendonça Neto, 17-A - Centro</p>
              <p>Telefone: (73) 98824-9558</p>
              <p>CNPJ: 00.000.000/0001-00 | IE: ISENTO</p>
              <p>E-mail: amstorebagshoes@gmail.com</p>
            </div>
            <div className="text-right">
              <div className="border border-black p-2 text-center min-w-[150px]">
                <p className="font-bold">DANFE</p>
                <p className="text-[10px] text-gray-500">Documento Auxiliar da Nota Fiscal de Produção Interna</p>
              </div>
              <div className="mt-2 text-[10px]">
                <p>Nº OP: <span className="font-bold">{order.codigo_ordem}</span></p>
                <p>SÉRIE: 001</p>
                <p>CHAVE DE ACESSO</p>
                <p className="font-mono text-[8px] break-all">OP{order.codigo_ordem?.replace(/\D/g, '')}00000000000000000000000000</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 border-b border-gray-200 pb-4">
            <div>
              <h3 className="font-bold uppercase mb-1">Natureza da Operação</h3>
              <p>PRODUÇÃO INTERNA PARA ESTOQUE</p>
            </div>
            <div>
              <h3 className="font-bold uppercase mb-1">Status da Ordem</h3>
              <p className="font-bold text-sm">{order.status === 'completed' ? 'CONCLUÍDA' : order.status === 'ongoing' ? 'EM PRODUÇÃO' : 'PENDENTE'}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold border-b border-black mb-2 uppercase">Destinatário / Remetente</h3>
            <div className="grid grid-cols-2 gap-x-10 gap-y-1">
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Nome / Razão Social:</span>
                <span className="font-bold">PRÓPRIO ESTABELECIMENTO (PRODUÇÃO INTERNA)</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">CNPJ / CPF:</span>
                <span className="font-bold">00.000.000/0001-00</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Data da Emissão:</span>
                <span className="font-bold">{dateBR(order.created_at)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Endereço:</span>
                <span className="font-bold text-right">Rua Mendonça Neto, 17-A</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Bairro / Distrito:</span>
                <span className="font-bold">Centro</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Cidade / UF:</span>
                <span className="font-bold">Ipiaú / BA</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">CEP:</span>
                <span className="font-bold">45570-000</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-1">
                <span className="text-gray-500">Telefone / Fax:</span>
                <span className="font-bold">(73) 98824-9558</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold border-b border-black mb-2 uppercase">Dados do Produto Fabricado</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border border-gray-200">DESCRIÇÃO DO PRODUTO</th>
                  <th className="p-2 border border-gray-200 text-center">UNID.</th>
                  <th className="p-2 border border-gray-200 text-center">QTDE.</th>
                  <th className="p-2 border border-gray-200 text-right">VALOR UNIT.</th>
                  <th className="p-2 border border-gray-200 text-right">VALOR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-gray-200 font-bold">{order.produto_nome || product?.name}</td>
                  <td className="p-2 border border-gray-200 text-center">UN</td>
                  <td className="p-2 border border-gray-200 text-center">{order.quantity}</td>
                  <td className="p-2 border border-gray-200 text-right">{brl(totalProductionCost / order.quantity)}</td>
                  <td className="p-2 border border-gray-200 text-right font-bold">{brl(totalProductionCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <h3 className="font-bold border-b border-black mb-2 uppercase italic text-[10px]">Matéria Prima Utilizada na Produção</h3>
            <table className="w-full text-left text-[9px]">
              <thead className="border-b border-black">
                <tr>
                  <th className="py-1">MATERIAL</th>
                  <th className="py-1">CORTE / TAMANHO</th>
                  <th className="py-1 text-center">QUANTIDADE</th>
                  <th className="py-1 text-center">UNID.</th>
                  <th className="py-1 text-right">VALOR UNIT.</th>
                  <th className="py-1 text-right">VALOR TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {composition.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1">{item.material_name} {item.variation_name ? `(${item.variation_name})` : ''}</td>
                    <td className="py-1 text-gray-500">{item.material_type === 'couro' || item.material_type === 'estrutura' || item.material_type === 'forro' ? 'Conforme Molde/Corte' : '—'}</td>
                    <td className="py-1 text-center">{num(item.quantity)}</td>
                    <td className="py-1 text-center lowercase">{item.unit || 'un'}</td>
                    <td className="py-1 text-right">{brl(item.unit_cost)}</td>
                    <td className="py-1 text-right font-medium">{brl(item.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg">
            <h3 className="font-bold uppercase text-[10px] mb-3">Cálculo de Custos</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-gray-500 mb-1">Custo Materiais</p>
                <p className="text-sm font-bold">{brl(totalMaterialCost)}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Custo Mão de Obra</p>
                <p className="text-sm font-bold">{brl(laborCost)}</p>
              </div>
              <div className="border-l border-gray-300 pl-6">
                <p className="text-gray-500 mb-1 italic">Custo Total de Produção</p>
                <p className="text-lg font-black text-gold">{brl(totalProductionCost)}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-[8px] text-gray-400">
              <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="font-bold">*** DOCUMENTO AUXILIAR DE PRODUÇÃO INTERNA ***</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
