import fs from 'fs';
import RSS from 'rss';
import { download } from './download.js';

const urls = JSON.parse(fs.readFileSync('youtube_urls.json', 'utf8'));

const feed = new RSS({
  title: 'My Personal YouTube to MP3 Feed',
  description: 'A private feed of YouTube videos converted to audio',
  feed_url: 'https://easilyBaffled.github.io/yt-casting/feed.xml',
  site_url: 'https://easilyBaffled.github.io/yt-casting/'
});

async function main() {
  console.log("[convert-and-feed.js] Starting main process...");
  for (const entry of urls) {
    if (!entry.processed) {
      let id;
      try {
        const parsed = new URL(entry.url);
        id = parsed.searchParams.get('v');
        if (!id) {
          console.warn(`[convert-and-feed.js] No video ID found in URL: ${entry.url}`);
          continue;
        }
        console.log(`[convert-and-feed.js] Processing video ID: ${id}`);
      } catch (err) {
        console.error(`[convert-and-feed.js] Invalid URL: ${entry.url}`, err);
        continue;
      }

      try {
        const result = await download(id);
        if (result && result.filePath && result.basic_info) {
          console.log(`[convert-and-feed.js] SUCCESS: Downloaded and adding to RSS: ${result.basic_info.title}`);
          const stats = fs.statSync(result.filePath);
          feed.item({
            title: result.basic_info.title,
            description: result.basic_info.description || result.basic_info.short_description || "No description available.",
            url: `https://easilyBaffled.github.io/yt-casting/static/${sanitizeFileName(result.basic_info.title)}.mp3`,
            guid: id,
            date: result.basic_info.publish_date || result.basic_info.upload_date || new Date(),
            author: result.basic_info.author || result.basic_info.channel_name,
            enclosure: {
              url: `https://easilyBaffled.github.io/yt-casting/static/${sanitizeFileName(result.basic_info.title)}.mp3`,
              size: stats.size,
              type: 'audio/mpeg',
            },
            custom_elements: [
              { 'itunes:image': result.basic_info.thumbnail }
            ]
          });
          entry.processed = true;
          console.log(`[convert-and-feed.js] Marked as processed: ${id}`);
        } else {
          console.error(`[convert-and-feed.js] FAILURE: Download returned no result for ${id}`);
        }
      } catch (err) {
        // SABR detection
        if (
          err &&
          typeof err.message === "string" &&
          err.message.includes("SABR streaming detected")
        ) {
          console.warn(`[convert-and-feed.js] SABR streaming detected for ${id}. Marking as SABR.`);
          entry.SABR = true;
          entry.processed = false;
        } else {
          console.error(`[convert-and-feed.js] FAILURE: Download failed for ${id}:`, err);
        }
      }
    }
  }

  fs.writeFileSync('youtube_urls.json', JSON.stringify(urls, null, 2));
  console.log("[convert-and-feed.js] Updated youtube_urls.json");

  fs.writeFileSync('feed.xml', feed.xml({ indent: true }));
  console.log("[convert-and-feed.js] RSS feed written to feed.xml");
}

// Helper for filename sanitization in RSS
function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

main();