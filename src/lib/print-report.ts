/**
 * print-report.ts
 *
 * Utilitário de impressão isolada para relatórios A4.
 *
 * Estratégia: em vez de chamar window.print() diretamente (que imprime toda a
 * DOM, incluindo overlay do Dialog e o layout do app, gerando páginas em branco),
 * clonamos o HTML do elemento alvo e o abrimos numa janela popup limpa, onde
 * apenas o relatório existe. Isso garante que:
 *  - Não há páginas em branco antes/depois do relatório
 *  - O cabeçalho (logo, nome da loja) é sempre exibido
 *  - O layout é fiel ao que é visto na tela
 */

export type PrintOrientation = "portrait" | "landscape";

/**
 * Imprime apenas o elemento identificado por `elementId` numa janela isolada.
 *
 * @param elementId   ID do elemento DOM a ser impresso (ex: "printable-transactions-report")
 * @param orientation Orientação da folha A4 (portrait | landscape). Padrão: "landscape"
 */
export function printReport(
  elementId: string,
  orientation: PrintOrientation = "landscape"
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`[printReport] Elemento #${elementId} não encontrado.`);
    return;
  }

  // Clonar o HTML do relatório para não modificar a DOM original
  const reportHtml = element.outerHTML;

  // Coletar todos os <link rel="stylesheet"> e <style> da página para herdar os estilos
  const styleSheets = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        if (sheet.href) {
          return `<link rel="stylesheet" href="${sheet.href}" />`;
        }
        const rules = Array.from(sheet.cssRules || [])
          .map((r) => r.cssText)
          .join("\n");
        return rules ? `<style>${rules}</style>` : "";
      } catch {
        // Cross-origin stylesheets podem lançar SecurityError
        if (sheet.href) {
          return `<link rel="stylesheet" href="${sheet.href}" />`;
        }
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  const popupHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório — Amstore Gestão</title>
  ${styleSheets}
  <style>
    /* Reset de impressão limpo */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    @page {
      size: A4 ${orientation};
      margin: 8mm 6mm 8mm 6mm;
    }

    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Inter', 'Outfit', system-ui, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Container do relatório ocupa 100% da folha */
    .report-container,
    #${elementId} {
      width: 100% !important;
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      background: #ffffff !important;
    }

    /* Ocultar a barra de ações (botões de imprimir/exportar) dentro do popup */
    .print\\:hidden {
      display: none !important;
    }

    /* Cabeçalho e resumo nunca quebram no meio */
    .report-header,
    .report-summary {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* Tabela ocupa toda a largura disponível */
    table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      table-layout: auto !important;
      border-collapse: collapse !important;
    }

    thead {
      display: table-header-group !important;
    }

    tfoot {
      display: table-footer-group !important;
    }

    tbody tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    th,
    td {
      padding: 3px 5px !important;
      font-size: 8.5pt !important;
      word-break: normal !important;
    }

    /* Última coluna (valor) sempre alinhada à direita sem quebra */
    th:last-child,
    td:last-child {
      white-space: nowrap !important;
      text-align: right !important;
      min-width: 80px !important;
      padding-right: 4px !important;
    }

    /* Garantir que cores de badge e status apareçam na impressão */
    .bg-green-100 { background-color: #dcfce7 !important; }
    .text-green-700 { color: #15803d !important; }
    .bg-orange-100 { background-color: #ffedd5 !important; }
    .text-orange-700 { color: #c2410c !important; }
    .text-green-600 { color: #16a34a !important; }
    .text-red-600 { color: #dc2626 !important; }
    .bg-slate-100 { background-color: #f1f5f9 !important; }
    .bg-slate-50 { background-color: #f8fafc !important; }

    /* Indicador de rolagem mobile — esconder na impressão */
    .sm\\:hidden {
      display: none !important;
    }

    /* overflow-x: hidden na impressão para não criar cortes */
    .overflow-x-auto {
      overflow: visible !important;
    }
  </style>
</head>
<body>
  ${reportHtml}
  <script>
    // Aguarda imagens e fontes carregarem antes de imprimir
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
        // Fecha a janela após a caixa de impressão ser fechada
        window.addEventListener('afterprint', function () {
          window.close();
        });
      }, 350);
    });
  </script>
</body>
</html>`;

  const popup = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!popup) {
    // Se o popup foi bloqueado, fallback para window.print() com aviso
    console.warn("[printReport] Popup bloqueado pelo browser. Usando window.print() como fallback.");
    window.print();
    return;
  }

  popup.document.open();
  popup.document.write(popupHtml);
  popup.document.close();
}
