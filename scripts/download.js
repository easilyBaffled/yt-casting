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
    writeFileSync(cookieFile, cookie);
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