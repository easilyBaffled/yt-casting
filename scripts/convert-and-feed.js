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
      // Use your conversion function here.
      // The following uses youtube‑dl‑exec to download and convert to mp3.
      const id = new URL(entry.url).searchParams.get('v');
      
      await download(id)

      // mark as processed
      entry.processed = true;
    }
  }
  
  // write updated URLs file
  fs.writeFileSync('youtube_urls.json', JSON.stringify(urls, null, 2));
  
  // generate RSS items from all MP3 files in static/
  const files = fs.readdirSync('static').filter(f => f.endsWith('.mp3'));
  files.forEach(file => {
    const stats = fs.statSync(`static/${file}`);
    feed.item({
      title: file.replace('.mp3', ''),
      description: `Audio from YouTube video ${file.replace('.mp3','')}`,
      url: `https://easilyBaffled.github.io/yt-casting/${file}`,
      guid: file,
      date: new Date(),
      enclosure: {
        url: `https://easilyBaffled.github.io/yt-casting/${file}`,
        size: stats.size,
        type: 'audio/mpeg',
      },
    });
  });
  
  // write feed.xml to the repo root
  fs.writeFileSync('feed.xml', feed.xml({ indent: true }));
}

main();
