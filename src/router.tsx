import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Dados considerados frescos por 20 segundos: evita refetches desnecessários em cliques rápidos
        staleTime: 20_000,
        // Mantém em cache por 10 minutos para navegação instantânea da memória
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
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
