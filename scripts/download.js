import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from "fs";
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

const SABR_ERROR_SNIPPET = "YouTube is forcing SABR streaming";

const DOWNLOAD_STRATEGIES = [
  {
    name: "default",
    extractorArgs: "",
  },
  {
    name: "android-client",
    extractorArgs: '--extractor-args "youtube:player_client=android"',
  },
  {
    name: "web-creator-client",
    extractorArgs: '--extractor-args "youtube:player_client=web_creator"',
  },
];

function buildCommand(baseArgs, strategy, cookieFile, url) {
  const parts = [baseArgs];
  if (strategy.extractorArgs)
    parts.push(strategy.extractorArgs);
  if (cookieFile)
    parts.push(`--cookies ${cookieFile}`);
  if (url)
    parts.push(`"${url}"`);
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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
  const infoCmd = buildCommand(
    "yt-dlp --dump-json",
    DOWNLOAD_STRATEGIES[0],
    cookieFile,
    url,
  );
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
  let lastError = null;
  let sabrDetected = false;

  for (const strategy of DOWNLOAD_STRATEGIES) {
    const dlCmd = buildCommand(
      `yt-dlp -x --audio-format mp3 -o "${output}"`,
      strategy,
      cookieFile,
      url,
    );
    console.log(
      `[download.js] Attempting download with strategy '${strategy.name}' using command: ${dlCmd}`,
    );

    try {
      if (existsSync(output)) {
        unlinkSync(output);
      }

      const { stdout, stderr } = await execAsync(dlCmd);
      if (stderr)
        console.error(`[download.js] yt-dlp download stderr (${strategy.name}):`, stderr);

      if (stderr && stderr.includes(SABR_ERROR_SNIPPET)) {
        sabrDetected = true;
        console.error(
          `[download.js] SABR streaming detected with strategy '${strategy.name}' for videoId: ${videoId}. Trying next strategy if available.`,
        );
        continue;
      }

      if (!existsSync(output)) {
        const errorMessage = `[download.js] yt-dlp did not produce output file: ${output}`;
        console.error(errorMessage);
        console.error(`[download.js] Command: ${dlCmd}`);
        console.error(`[download.js] yt-dlp stdout:`, stdout);
        console.error(`[download.js] yt-dlp stderr:`, stderr);
        lastError = new Error(errorMessage);
        continue;
      }

      const stats = statSync(output);
      console.log(
        `[download.js] Download complete using strategy '${strategy.name}': ${output} (${stats.size} bytes)`,
      );

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
      console.error(
        `[download.js] ERROR: Download attempt with strategy '${strategy.name}' failed for videoId: ${videoId}`,
      );
      console.error(`[download.js] Command: ${dlCmd}`);
      if (error && error.stderr)
        console.error(`[download.js] yt-dlp download stderr (${strategy.name}):`, error.stderr);
      if (error && error.stdout)
        console.error(`[download.js] yt-dlp download stdout (${strategy.name}):`, error.stdout);
      if (error && error.stack) console.error(`[download.js] Error stack:`, error.stack);
      else console.error(`[download.js] Error:`, error);

      const message = typeof error?.message === "string" ? error.message : "";
      if (message.includes(SABR_ERROR_SNIPPET)) {
        sabrDetected = true;
        continue;
      }

      lastError = error;
    }
  }

  const baseErrorMessage =
    "SABR streaming detected. yt-dlp cannot download this video after trying fallback strategies.";
  if (sabrDetected) {
    const error = new Error(baseErrorMessage);
    error.code = "SABR_STREAM";
    throw error;
  }

  if (lastError) {
    throw lastError;
  }

  const unknownError = new Error(
    "yt-dlp failed to download the video and no specific error information was captured.",
  );
  throw unknownError;
}
