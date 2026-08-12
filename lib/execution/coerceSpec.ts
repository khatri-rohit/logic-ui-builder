import { Prisma } from "@/app/generated/prisma/client";

import { webAppSpecSchema } from "@/lib/schemas/studio";
import { GenerationPlatform, WebAppSpec } from "@/lib/types";

/** Coerce stored JSON / partial LLM output into a usable WebAppSpec. */
export function coerceWebAppSpec(
  rawSpec: Prisma.JsonValue | Partial<WebAppSpec> | null | undefined,
  platform: GenerationPlatform,
  screenName?: string,
): WebAppSpec {
  const parsedSpec = webAppSpecSchema.safeParse(rawSpec);
  if (parsedSpec.success) {
    if (!screenName || parsedSpec.data.screens.includes(screenName)) {
      return parsedSpec.data;
    }

    return {
      ...parsedSpec.data,
      screens: [...parsedSpec.data.screens, screenName],
    };
  }

  const screens =
    screenName != null
      ? [screenName]
      : Array.isArray((rawSpec as { screens?: unknown })?.screens)
        ? ((rawSpec as { screens: string[] }).screens as string[])
        : ["Home"];

  return {
    screens: screens.length > 0 ? screens : ["Home"],
    navPattern: "none",
    platform,
    colorMode: "light",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
    stylingLib: "tailwind",
    layoutDensity: "comfortable",
    components: [],
  };
}
