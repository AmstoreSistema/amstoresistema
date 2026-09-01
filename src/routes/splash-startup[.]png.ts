import { createFileRoute } from "@tanstack/react-router";
import { getAppearance, buildSplashSvg, svgResponse } from "@/lib/appearance.server";

export const Route = createFileRoute("/splash-startup.png")({
  server: {
    handlers: {
      GET: async () => {
        const a = await getAppearance();
        return svgResponse(await buildSplashSvg(a));
      },
    },
  },
});
