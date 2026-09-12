import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Dados frescos por 5 segundos: sincronização instantânea entre múltiplos administradores
        staleTime: 5_000,
        // Mantém em cache para navegação instantânea
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega a rota ao passar o mouse/tocar no link
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
