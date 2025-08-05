import { existsSync, mkdirSync } from "fs";
import { exec } from "child_process";

export async function download(videoId) {
  return new Promise((resolve, reject) => {
    try {
      const dir = `static`;
      if (!existsSync(dir)) {
        console.log(`[download.js] Directory '${dir}' does not exist. Creating at ${process.cwd()}/${dir}`);
        mkdirSync(dir);
      }

      // Output template: static/<videoId>.mp3
      const output = `${dir}/${videoId}.mp3`;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const cmd = `yt-dlp -x --audio-format --cookies cookies.txt mp3 -o "${output}" "${url}"`;
      console.log(`[download.js] Running: ${cmd}`);

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[download.js] yt-dlp error:`, error);
          console.error(stderr);
          return reject(error);
        }
        console.log(stdout);
        console.log(`[download.js] Downloaded to ${output}`);
        resolve(output);
      });
    } catch (e) {
      console.error(`[download.js] ERROR:`, e && e.stack ? e.stack : e);
      reject(e);
    }
  });
}