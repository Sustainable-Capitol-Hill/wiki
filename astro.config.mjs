// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { generateSidebar } from "./sidebar-generator.ts";
import { generateRedirects } from "./redirect-generator.ts";

// https://astro.build/config
export default defineConfig({
  redirects: generateRedirects(),
  integrations: [
    starlight({
      favicon: "favicon.png",
      title: "Sustainable Capitol Hill Wiki",
      titleDelimiter: "|",
      logo: {
        light: "./src/assets/blackbird.png",
        dark: "./src/assets/whitebird.png",
      },
      social: [],
      sidebar: generateSidebar(),
      components: {
        Footer: "./src/components/Footer.astro",
        Head: "./src/components/Head.astro",
      },
    }),
  ],
});
