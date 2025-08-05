import { Innertube, ClientType, Utils } from "youtubei.js";
import { existsSync, mkdirSync, createWriteStream } from "fs";

export async function download(videoId) {
  try {
    console.log(`[download.js] Starting download for videoId: ${videoId}`);
    const yt = await Innertube.create({
      retrieve_player: true,
      enable_session_cache: false,
      generate_session_locally: false,
      client_type: ClientType.IOS,
    });
    console.log("[download.js] Innertube stream created");
    console.log(basic_info)
    const { basic_info } = await yt.getBasicInfo(videoId, "iOS");
    const videoName = basic_info.title;
    console.log(`[download.js] Video title: ${videoName}`);

    const stream = await yt.download(videoId, {
      type: "audio",
      quality: "best",
      format: "mp4",
      client: ClientType.IOS,
    });

    console.info(`[download.js] Downloading ${videoName}`);

    const dir = `static`;
    const absDir = `${process.cwd()}/${dir}`;
    if (!existsSync(dir)) {
      console.log(`[download.js] Directory '${dir}' does not exist. Creating at ${absDir}`);
      mkdirSync(dir);
    } else {
      console.log(`[download.js] Directory '${dir}' exists at ${absDir}`);
    }

    // Sanitize filename for filesystem safety
    const safeName = videoName.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const filePath = `${dir}/${safeName}.mp3`;
    const absFilePath = `${process.cwd()}/${filePath}`;
    console.log(`[download.js] Writing to file: ${filePath} (absolute: ${absFilePath})`);

    const file = createWriteStream(filePath);

    let i = 0;
    for await (const chunk of Utils.streamToIterable(stream)) {
      i += 1;
      file.write(chunk);
    }
    file.end();

    console.info(`[download.js] Done writing ${filePath} (${i} chunks)\n`);

    return filePath;
  } catch (e) {
    console.error(`[download.js] ERROR:`, e && e.stack ? e.stack : e);
    throw e;
  }
}