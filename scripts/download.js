import { existsSync, mkdirSync, readFileSync } from "fs";
import { Innertube, ClientType, Utils } from 'youtubei.js';
import { exec } from "child_process";

// Validate cookie header string format
function isValidCookieHeader(cookie) {
  // Must be a non-empty string
  if (typeof cookie !== 'string' || cookie.trim() === '') return false;
  // Should not contain newlines or tabs
  if (/\r|\n|\t/.test(cookie)) return false;
  // Should contain at least one '=' and one ';' (for multiple cookies)
  if (!cookie.includes('=') || (!cookie.includes(';') && cookie.split(';').length < 2)) return false;
  // Should not start or end with ';'
  if (cookie.trim().startsWith(';') || cookie.trim().endsWith(';')) return false;
  // Should not contain invalid header characters
  if (/[^\x20-\x7E]/.test(cookie)) return false;
  // Should look like: key=value; key2=value2
  return true;
}

export async function download(videoId) {
  // Read cookies.txt and include in Innertube.create
  const cookie = process.env.YT_COOKIES_RAW || '';

  if (!isValidCookieHeader(cookie)) {
    console.warn('[download.js] Cookie header is invalid or missing.');
  } else {
    console.log('[download.js] Using provided cookies.');
  }
  await Innertube.create({
    retrieve_player: true,
    enable_session_cache: false,
    generate_session_locally: false,
    client_type: ClientType.IOS,
    cookie,
    // cache: new UniversalCache( false ),
    // generate_session_locally: true
  }).then(yt => yt.getBasicInfo(videoId, 'iOS')).then(console.log);

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
      
      const cmd = `yt-dlp -x --cookies cookies.txt --audio-format mp3 -o "${output}" "${url}"`;
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