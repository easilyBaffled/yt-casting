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
  // Netscape HTTP Cookie File header
  let lines = [
    "# Netscape HTTP Cookie File",
    "# This file was generated from a cookie header string"
  ];
  if (!cookieHeader || typeof cookieHeader !== "string") return lines.join("\n");
  lines = lines.concat(
    cookieHeader
      .split(";")
      .map(pair => pair.trim())
      .filter(Boolean)
      .map(pair => {
        const [name, value] = pair.split("=");
        // domain, flag, path, secure, expiration, name, value
        // Use reasonable defaults for flag (TRUE), path (/), secure (FALSE), expiration (0)
        if (!name || !value) return null;
        return `${domain}\tTRUE\t/\tFALSE\t0\t${name}\t${value}`;
      })
      .filter(Boolean)
  );
  return lines.join("\n");
}

export async function download(videoId) {
  const dir = "./static";
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const cookie = process.env.YT_COOKIES_RAW || "";

  // Write cookie to a temp file if present
  let cookieFile = "";
  if (cookie) {
    cookieFile = "./cookies.txt";
    const netscapeCookie = cookieHeaderToNetscape(cookie);
    writeFileSync(cookieFile, netscapeCookie);
  }

  // Use yt-dlp to get metadata and download audio
  // First, get metadata to determine the video title
  const infoCmd = `yt-dlp --dump-json ${cookie ? `--cookies ${cookieFile}` : ""} "${url}"`;
  let info;
  try {
    const { stdout: infoStdout, stderr: infoStderr } = await execAsync(infoCmd);
    if (infoStderr) console.error(infoStderr);
    info = JSON.parse(infoStdout.split('\n').find(line => line.trim().startsWith('{')));
  } catch (error) {
    console.error("[download.js] yt-dlp metadata error:", error);
    throw error;
  }

  // Sanitize the video title for filename
  const safeTitle = sanitizeFileName(info.title);
  const output = `${dir}/${safeTitle}.mp3`;

  // Download the audio file using the sanitized title
  const dlCmd = `yt-dlp -x --audio-format mp3 -o "${output}" ${cookie ? `--cookies ${cookieFile}` : ""} "${url}"`;
  try {
    const { stdout, stderr } = await execAsync(dlCmd);
    if (stderr) console.error(stderr);

    // Check if file was created
    if (!existsSync(output)) {
      throw new Error(`[download.js] yt-dlp did not produce output file: ${output}`);
    }
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