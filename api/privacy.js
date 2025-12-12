import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const PRIVACY_MD_PATH = path.join(process.cwd(), "content", "privacy.md");

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const markdown = await readFile(PRIVACY_MD_PATH, "utf8");
    const html = marked.parse(markdown);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Privacy Policy</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap"
            rel="stylesheet"
          />
          <link rel="stylesheet" href="/privacy.css" />
        </head>
        <body class="privacy-page">
          <main class="privacy-content">${html}</main>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Error loading privacy policy:", err);
    return res.status(500).send("Unable to load privacy policy.");
  }
}
