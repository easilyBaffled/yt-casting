import { existsSync, mkdirSync } from "fs";
import { Innertube, ClientType, Utils } from 'youtubei.js';
import { exec } from "child_process";

export async function download(videoId) {

  // Read cookies.txt and include in Innertube.create
  let cookie = '';
  try {
    cookie = readFileSync('cookies.txt', 'utf8');
    console.log('[download.js] Loaded cookies.txt');
  } catch (e) {
    console.warn('[download.js] Could not read cookies.txt:', e.message);
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