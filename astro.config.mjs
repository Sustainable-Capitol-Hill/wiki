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
      title: "Sustainable Capitol Hill Wiki",
      logo: {
        light: "./src/assets/blackbird.png",
        dark: "./src/assets/whitebird.png",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/withastro/starlight",
        },
      ],
      sidebar: generateSidebar(),
      components: {
        Footer: './src/components/Footer.astro',
      },
    }),
  ],
});
