import { themes as prismThemes } from "prism-react-renderer";
import * as path from "path";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Sustainable Capitol Hill Wiki",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://your-docusaurus-site.example.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "facebook", // Usually your GitHub org/user name.
  projectName: "docusaurus", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            // move the index link first
            const predicate = (item) =>
              item.type === "doc" && item.id === "index";

            const sidebarItems = await defaultSidebarItemsGenerator(args);
            const home = sidebarItems.find(predicate);
            const sidebarWithoutHome = sidebarItems.filter(
              (item) => !predicate(item),
            );

            return [home, ...sidebarWithoutHome];
          },
          editUrl: (params) => {
            return "http://TODO";
          },
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      path.resolve(
        __dirname,
        "plugins",
        "google-drive-docs-plugin",
        "index.ts",
      ),
      {
        sharedDriveId: "0ACo0rf1yKpmjUk9PVA",
        nestedFolderId: "1KGbXzCh5qJcxr-W7xaj_RWu4IC9XUqf1",
        outputDir: "docs",
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Sustainable Capitol Hill Wiki",
      logo: {
        alt: "Bird Logo",
        src: "img/blackbird.png",
        srcDark: "img/whitebird.png",
      },
      items: [],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
