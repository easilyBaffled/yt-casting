import { Innertube, ClientType, Utils } from "youtubei.js";
import { existsSync, mkdirSync, createWriteStream } from "fs";

export async function download(videoId) {
try {
    const yt = await Innertube.create({
      retrieve_player: true,
      enable_session_cache: false,
      generate_session_locally: false,
      client_type: ClientType.IOS,
      // cache: new UniversalCache( false ),
      // generate_session_locally: true
    });
    console.log("stream created");
    const { basic_info } = await yt.getBasicInfo(videoId, "iOS");
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
    const dir = `static`;

    if (!existsSync(dir)) {
      mkdirSync(dir);
    }

    const filePath = `${dir}/${videoName}.mp3`;

    const file = createWriteStream(filePath);

    let i = 0;
    for await (const chunk of Utils.streamToIterable(stream)) {
      i += 1;
      file.write(chunk);
    }

    console.info(`Done!`, "\n");

    return filePath
  } catch (e) {
    console.error(e);
  }
}