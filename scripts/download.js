import { existsSync, mkdirSync, readFileSync } from "fs";
import { Innertube, ClientType, Utils } from "youtubei.js";
import { exec } from "child_process";

// Validate cookie header string format and explain issues
function validateCookieHeader(cookie) {
  if (typeof cookie !== "string" || cookie.trim() === "") {
    return {
      isValid: false,
      error: "Cookie header is empty or not a string.",
      fix: 'Provide a non-empty cookie header string (e.g. "SID=...; HSID=...; ...").',
    };
  }
  if (/\r|\n|\t/.test(cookie)) {
    return {
      isValid: false,
      error: "Cookie header contains newlines or tabs.",
      fix: "Remove all newlines and tabs. The cookie header must be a single line.",
    };
  }
  if (!cookie.includes("=")) {
    return {
      isValid: false,
      error: "Cookie header does not contain any key=value pairs.",
      fix: "Format should be: key1=value1; key2=value2; ...",
    };
  }
  if (!cookie.includes(";") && cookie.split(";").length < 2) {
    return {
      isValid: false,
      error:
        "Cookie header contains only one key=value pair or missing semicolons.",
      fix: 'Separate multiple cookies with "; ". Example: key1=value1; key2=value2',
    };
  }
  if (cookie.trim().startsWith(";") || cookie.trim().endsWith(";")) {
    return {
      isValid: false,
      error: "Cookie header starts or ends with a semicolon.",
      fix: "Remove leading or trailing semicolons.",
    };
  }
  if (/[^\x20-\x7E]/.test(cookie)) {
    return {
      isValid: false,
      error: "Cookie header contains non-ASCII or invalid header characters.",
      fix: "Only use visible ASCII characters (space to ~).",
    };
  }
  return { isValid: true };
}

export async function download(videoId) {
  // Read cookies.txt and include in Innertube.create
  const cookie = process.env.YT_COOKIES_RAW || "";
  const cookieCheck = validateCookieHeader(cookie);
  if (!cookieCheck.isValid) {
    console.warn(
      `[download.js] Cookie header is invalid: ${cookieCheck.error}`,
    );
    if (cookieCheck.fix) {
      console.warn(`[download.js] How to fix: ${cookieCheck.fix}`);
    }
  } else {
    console.log("[download.js] Using provided cookies.");
  }
  await Innertube.create({
    retrieve_player: true,
    enable_session_cache: false,
    generate_session_locally: false,
    client_type: ClientType.WEB,
    cookie,
    // cache: new UniversalCache( false ),
    // generate_session_locally: true
  })
    .then((yt) => yt.getBasicInfo(videoId, "WEB"))
    .then( res => {
      console.log(res)
      console.log(res.storyboards.boards[0])
      console.log(res.thumbnail[0])
    });

  return new Promise((resolve, reject) => {
    try {
      const dir = `static`;
      if (!existsSync(dir)) {
        console.log(
          `[download.js] Directory '${dir}' does not exist. Creating at ${process.cwd()}/${dir}`,
        );
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
