import fs from 'fs';
import RSS from 'rss';
import { download } from './download.js';
const urls = JSON.parse(fs.readFileSync('youtube_urls.json'));

const feed = new RSS({
  title: 'My Personal YouTube to MP3 Feed',
  description: 'A private feed of YouTube videos converted to audio',
  feed_url: 'https://easilyBaffled.github.io/yt-casting/feed.xml',
  site_url: 'https://easilyBaffled.github.io/yt-casting/'
});

async function main() {
  for (const entry of urls) {
    if (!entry.processed) {
      const id = new URL(entry.url).searchParams.get('v');
      try {
        // Assume download returns { filePath, basic_info, videoId }
        const result = await download(id);
        if (result && result.filePath && result.basic_info) {
          const stats = fs.statSync(result.filePath);
          feed.item({
            title: result.basic_info.title,
            description: result.basic_info.description || result.basic_info.short_description || "No description available.",
            url: `https://easilyBaffled.github.io/yt-casting/static/${result.videoId}.mp3`,
            guid: result.videoId,
            date: result.basic_info.publish_date || result.basic_info.upload_date || new Date(),
            author: result.basic_info.author || result.basic_info.channel_name,
            enclosure: {
              url: `https://easilyBaffled.github.io/yt-casting/static/${result.videoId}.mp3`,
              size: stats.size,
              type: 'audio/mpeg',
            },
            custom_elements: [
              { 'itunes:image': result.basic_info.thumbnail }
            ]
          });
          // mark as processed
          entry.processed = true;
        }
      } catch (err) {
        console.error(`[convert-and-feed.js] Download failed for ${id}:`, err);
      }
    }
  }

  // write updated URLs file
  fs.writeFileSync('youtube_urls.json', JSON.stringify(urls, null, 2));

  // write feed.xml to the repo root
  fs.writeFileSync('feed.xml', feed.xml({ indent: true }));
}

main();