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
    try {
      // ...existing code to run yt-dlp...
      // After running yt-dlp, check for SABR warning in stderr
      if (stderr && stderr.includes("YouTube is forcing SABR streaming")) {
        console.error(
          `[download.js] SABR streaming detected for videoId: ${videoId}. Download not possible.`,
        );
        throw new Error(
          "SABR streaming detected. yt-dlp cannot download this video.",
        );
      }

      // ...existing code to check file and return result...
      return {
        filePath: output,
        basic_info: {
          title: info.title,
          description:
            info.description || info.fulltitle || "No description available.",
          publish_date: info.upload_date
            ? new Date(
                info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
              )
            : new Date(),
          author: info.uploader || info.channel,
          thumbnail: info.thumbnail || "",
        },
        videoId,
        size: stats.size,
      };
    } catch (error) {
      // ...existing error handling...
    }
    console.log(
      `[download.js] Fetching video metadata with command: ${infoCmd}`,
    );
    let info;
    try {
      const { stdout: infoStdout, stderr: infoStderr } =
        await execAsync(infoCmd);
      if (infoStderr)
        console.error(`[download.js] yt-dlp metadata stderr:`, infoStderr);
      info = JSON.parse(
        infoStdout.split("\n").find((line) => line.trim().startsWith("{")),
      );
      console.log(
        `[download.js] Video metadata retrieved: title="${info.title}"`,
      );
    } catch (error) {
      console.error("[download.js] yt-dlp metadata error:", error);
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

      if (!existsSync(output)) {
        console.error(
          `[download.js] ERROR: yt-dlp did not produce output file: ${output}`,
        );
        throw new Error(
          `[download.js] yt-dlp did not produce output file: ${output}`,
        );
      }
      const stats = statSync(output);
      console.log(
        `[download.js] Download complete: ${output} (${stats.size} bytes)`,
      );

      return {
        filePath: output,
        basic_info: {
          title: info.title,
          description:
            info.description || info.fulltitle || "No description available.",
          publish_date: info.upload_date
            ? new Date(
                info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
              )
            : new Date(),
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
}
