import { createFileRoute } from "@tanstack/react-router";
import { getAppearance, buildIconSvg, svgResponse } from "@/lib/appearance.server";

export const Route = createFileRoute("/icon-512-maskable.png")({
  server: {
    handlers: {
      GET: async () => {
        const a = await getAppearance();
        return svgResponse(
          await buildIconSvg(a, a.app_icon_url || a.site_logo_url || a.splash_logo_url, { maskable: true }),
        );
      },
    },
  },
});
