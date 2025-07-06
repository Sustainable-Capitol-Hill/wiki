import { themes as prismThemes } from "prism-react-renderer";
import * as fs from "fs";
import * as path from "path";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import matter from "gray-matter";

import { Options as ClientRedirectOptions } from "@docusaurus/plugin-client-redirects";
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
          showLastUpdateTime: true,
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
          editUrl: ({ versionDocsDirPath, docPath }) => {
            const file = fs.readFileSync(`${versionDocsDirPath}/${docPath}`);
            const data = matter(file);
            const driveId = data.data.drive_id;
            if (driveId !== undefined) {
              return `https://docs.google.com/document/d/${driveId}/edit`;
            } else {
              return undefined;
            }
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
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          {
            to: "/Volunteering/First-Time Volunteers",
            from: "/books/how-to-be-a-volunteer/page/first-time-volunteering",
          },
          {
            to: "/Volunteering/Routine Shift Volunteering",
            from: "/books/how-to-be-a-volunteer/page/routine-shift-volunteering",
          },
          {
            to: "/Volunteering/Farmers Market Tabling",
            from: "/books/farmers-market/page/tabling-at-the-farmers-market",
          },
        ],
      } satisfies ClientRedirectOptions,
    ],
  ],

  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      {
        // ... Your options.
        // `hashed` is recommended as long-term-cache of index file is possible.
        indexBlog: false,
        docsRouteBasePath: "/",
        hashed: true,

        // For Docs using Chinese, it is recomended to set:
        // language: ["en", "zh"],

        // If you're using `noIndex: true`, set `forceIgnoreNoIndex` to enable local index:
        // forceIgnoreNoIndex: true,
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
