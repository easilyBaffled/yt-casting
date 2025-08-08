import {
  existsSync,
  mkdirSync,
  createWriteStream,
} from "fs";
import { Innertube, ClientType, Utils } from "youtubei.js";

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

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
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

  try {
    const yt = await Innertube.create({
      retrieve_player: true,
      enable_session_cache: false,
      generate_session_locally: false,
      client_type: ClientType.WEB,
      cookie,
      // cache: new UniversalCache( false ),
      // generate_session_locally: true
    });
    console.log("stream created");
    const { basic_info } = await yt.getBasicInfo(videoId, "WEB");
    const videoName = basic_info.title;
    console.log(videoName);

    const stream = await yt.download(videoId, {
      type: "audio", // audio, video or video+audio
      quality: "best", // best, bestefficiency, 144p, 240p, 480p, 720p and so on.
      format: "mp4", // media container format,
      client: ClientType.IOS,
    });

    // console.info(`Downloading ${song.title} (${song.id})`);
    console.info(`Downloading ${videoName}`);

    // const dir = `./${album.header?.title.toString()}`;
    const dir = `./static`;

    if (!existsSync(dir)) {
      mkdirSync(dir);
    }

    const safeVideoName = sanitizeFileName(videoName);
    const filePath = `${dir}/${safeVideoName}.mp3`;

    const file = createWriteStream(filePath);

    const fileWritePromise = new Promise((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
      stream.on("error", reject);
    });

    try {
      let i = 0;
      for await (const chunk of Utils.streamToIterable(stream)) {
        i += 1;
        file.write(chunk);
      }
    } finally {
      file.end();
    }

    await fileWritePromise;

    console.info(`Done!`, "\n");

    return { filePath, file, basic_info };
  } catch (error) {
    console.error("Error during download:", error);
    throw error;
  }
}
