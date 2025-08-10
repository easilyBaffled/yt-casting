import { existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

// Convert a cookie header string to Netscape cookie.txt format
function cookieHeaderToNetscape(cookieHeader, domain = ".youtube.com") {
  // Example cookieHeader: "SID=xxx; HSID=xxx; SSID=xxx; ..."
  if (!cookieHeader || typeof cookieHeader !== "string") return "";
  return cookieHeader
    .split(";")
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const [name, value] = pair.split("=");
      // Netscape format: domain  flag  path  secure  expiration  name  value
      // We'll use: domain, TRUE, /, FALSE, 0, name, value
      return `${domain}\tTRUE\t/\tFALSE\t0\t${name}\t${value}`;
    })
    .join("\n");
}

export async function download(videoId) {
  const dir = "./static";
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const output = `${dir}/${videoId}.mp3`;
  const cookie = process.env.YT_COOKIES_RAW || "";

  // Write cookie to a temp file if present
  let cookieFile = "";
  if (cookie) {
    cookieFile = "./cookies.txt";
    const netscapeCookie = cookieHeaderToNetscape(cookie);
    writeFileSync(cookieFile, netscapeCookie);
  }

  // Use yt-dlp to get metadata and download audio
  const cmd = `yt-dlp --dump-json -x --audio-format mp3 -o "${output}" ${cookie ? `--cookies ${cookieFile}` : ""} "${url}"`;
  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) console.error(stderr);

    // Parse yt-dlp JSON output for metadata
    const info = JSON.parse(stdout.split('\n').find(line => line.trim().startsWith('{')));
    const stats = statSync(output);

    return {
      filePath: output,
      basic_info: {
        title: info.title,
        description: info.description || info.fulltitle || "No description available.",
        publish_date: info.upload_date ? new Date(info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")) : new Date(),
        author: info.uploader || info.channel,
        thumbnail: info.thumbnail || "",
      },
      videoId,
      size: stats.size,
    };
  } catch (error) {
    console.error("[download.js] yt-dlp error:", error);
    throw error;
  }
}