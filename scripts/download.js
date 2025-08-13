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

function cookieHeaderToNetscape(cookieHeader, domain = ".youtube.com") {
  let lines = [
    "# Netscape HTTP Cookie File",
    "# This file was generated from a cookie header string",
  ];
  if (!cookieHeader || typeof cookieHeader !== "string")
    return lines.join("\n");
  lines = lines.concat(
    cookieHeader
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [name, value] = pair.split("=");
        if (!name || !value) return null;
        return `${domain}\tTRUE\t/\tFALSE\t0\t${name}\t${value}`;
      })
      .filter(Boolean),
  );
  return lines.join("\n");
}

export async function download(videoId) {
  console.log(`[download.js] Starting download for videoId: ${videoId}`);
  const dir = "./static";
  if (!existsSync(dir)) {
    console.log(`[download.js] Directory '${dir}' does not exist. Creating...`);
    mkdirSync(dir);
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const cookie = process.env.YT_COOKIES_RAW || "";
  let cookieFile = "";
  if (cookie) {
    cookieFile = "./cookies.txt";
    const netscapeCookie = cookieHeaderToNetscape(cookie);
    writeFileSync(cookieFile, netscapeCookie);
  }

  // Fetch metadata first
  const infoCmd = `yt-dlp --dump-json ${cookie ? `--cookies ${cookieFile}` : ""} "${url}"`;
  let info;
  try {
    console.log(`[download.js] Fetching video metadata with command: ${infoCmd}`);
    const { stdout: infoStdout, stderr: infoStderr } = await execAsync(infoCmd);
    if (infoStderr)
      console.error(`[download.js] yt-dlp metadata stderr:`, infoStderr);
    info = JSON.parse(infoStdout.split("\n").find((line) => line.trim().startsWith("{")));
    console.log(`[download.js] Video metadata retrieved: title="${info.title}"`);
  } catch (error) {
    console.error(`[download.js] ERROR: Failed to fetch metadata for videoId: ${videoId}`);
    console.error(`[download.js] Command: ${infoCmd}`);
    if (error && error.stderr) console.error(`[download.js] yt-dlp metadata stderr:`, error.stderr);
    if (error && error.stdout) console.error(`[download.js] yt-dlp metadata stdout:`, error.stdout);
    if (error && error.stack) console.error(`[download.js] Error stack:`, error.stack);
    else console.error(`[download.js] Error:`, error);
    throw error;
  }

  const safeTitle = sanitizeFileName(info.title);
  const output = `${dir}/${safeTitle}.mp3`;
  const dlCmd = `yt-dlp -x --audio-format mp3 -o "${output}" ${cookie ? `--cookies ${cookieFile}` : ""} "${url}"`;
  console.log(`[download.js] Downloading audio with command: ${dlCmd}`);
  try {
    const { stdout, stderr } = await execAsync(dlCmd);
    if (stderr)
      console.error(`[download.js] yt-dlp download stderr:`, stderr);

    if (stderr && stderr.includes("YouTube is forcing SABR streaming")) {
      console.error(`[download.js] SABR streaming detected for videoId: ${videoId}. Download not possible.`);
      throw new Error("SABR streaming detected. yt-dlp cannot download this video.");
    }

    if (!existsSync(output)) {
      console.error(`[download.js] ERROR: yt-dlp did not produce output file: ${output}`);
      console.error(`[download.js] Command: ${dlCmd}`);
      console.error(`[download.js] yt-dlp stdout:`, stdout);
      console.error(`[download.js] yt-dlp stderr:`, stderr);
      throw new Error(`[download.js] yt-dlp did not produce output file: ${output}`);
    }
    const stats = statSync(output);
    console.log(`[download.js] Download complete: ${output} (${stats.size} bytes)`);

    return {
      filePath: output,
      basic_info: {
        title: info.title,
        description:
          `${info.description || info.fulltitle || "No description available."}\n${url}`,
        publish_date: new Date(),
        author: info.uploader || info.channel,
        thumbnail: info.thumbnail || "",
      },
      videoId,
      size: stats.size,
    };
  } catch (error) {
    console.error(`[download.js] ERROR: Failed to download audio for videoId: ${videoId}`);
    console.error(`[download.js] Command: ${dlCmd}`);
    if (error && error.stderr) console.error(`[download.js] yt-dlp download stderr:`, error.stderr);
    if (error && error.stdout) console.error(`[download.js] yt-dlp download stdout:`, error.stdout);
    if (error && error.stack) console.error(`[download.js] Error stack:`, error.stack);
    else console.error(`[download.js] Error:`, error);
    throw error;
  }
}