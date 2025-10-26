import { drive } from "./drive";
import * as fs from "fs-extra";
import { text, arrayBuffer } from "stream/consumers";
import * as unzip from "yauzl-promise";
import { parse } from "node-html-parser";
import * as path from "path";

type Image = {
  src: string;
  alt: string;
  image: ArrayBuffer;
};

const extractImages = async (fileId: string): Promise<Image[]> => {
  const file = await drive.files.export(
    {
      fileId,
      mimeType: "application/zip",
    },
    {
      responseType: "arraybuffer",
    },
  );
  const buf = Buffer.from(file.data as ArrayBuffer);
  const zip = await unzip.fromBuffer(buf);

  let htmlFile: unzip.Entry | undefined = undefined;
  const images: unzip.Entry[] = [];

  for await (const entry of zip) {
    if (entry.filename.endsWith(".html")) {
      htmlFile = entry;
    } else if (entry.filename.startsWith("images/")) {
      images.push(entry);
    }
  }

  console.log(
    "discovered HTML file at",
    htmlFile.filename,
    "and images at",
    images.map((i) => i.filename),
  );

  if (!htmlFile) {
    throw Error("HTML file not found");
  }

  const html = await text(await htmlFile.openReadStream());
  const soup = parse(html);

  const docImages = soup.querySelectorAll("img");
  const imageList: Image[] = [];

  for (const imgTag of docImages) {
    const alt = imgTag.getAttribute("alt");
    const src = imgTag.getAttribute("src");
    const img = images.find((im) => im.filename.endsWith(src));

    imageList.push({
      src: src.split("/")[1],
      alt,
      image: await arrayBuffer(await img.openReadStream()),
    });
  }

  return imageList;
};

const downloadFile = async (fileId: string) => {
  const images = await extractImages(fileId);
  const file = await drive.files.export({
    fileId,
    mimeType: "text/markdown",
  });

  const fileDescription = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id, name, mimeType, modifiedTime",
  });

  let markdown = file.data as string;
  markdown = markdown.replaceAll(/\[[\w\s]+\]:\s+<.*>/g, "");

  markdown = markdown.replaceAll(
    /!\[([^\]]*)\]\[([^\]]*)\]/g,
    (_, alt: string, ref: string) => {
      const image = images.find((im) => im.src.startsWith(ref));
      return `![${alt}](./${fileId}/${image.src})`;
    },
  );

  const filePath = path.join("docs");
  const fileName = path.join("docs", `${fileDescription.data.name}.md`);
  const assetPath = path.join("docs", fileId);

  fs.mkdirSync(assetPath, {
    recursive: true,
  });
  for (const image of images) {
    fs.writeFileSync(
      path.join(assetPath, image.src),
      new DataView(image.image),
    );
  }

  // special case: root doc should live at root slug
  const slug =
    fileId === "1aXYn5V-7basBfG-e5mbrCcjI4fAVCzUXx-KGl9mMw5o" ? "" : fileId;

  const lastEditDate = new Date(fileDescription.data.modifiedTime);
  console.log(fileDescription.data);

  // Construct Docusaurus front matter
  const frontMatter = `---
slug: /${slug}
drive_id: ${fileId}
last_update:
  date: ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles" }).format(lastEditDate)}
---

`;
  fs.writeFileSync(fileName, frontMatter + markdown);
};

(async function () {
  await downloadFile("1wW-6WolrfQdf8mvJdm-k-XbCvG-72I-U9P83BG0_AjM");
})().then();
