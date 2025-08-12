# About

This is repository hosts the UI and content of an RSS feed reader.

## Links and references


Source URL: https://easilyBaffled.github.io/yt-casting/<file>.mp3
# yt-casting

A self-hosted YouTube-to-podcast automation tool. This project downloads YouTube videos as MP3s, generates an RSS feed, and lets you subscribe to your favorite channels as a podcast.

## Features
- Converts YouTube videos to MP3 audio files
- Generates a podcast-compatible RSS feed
- Handles YouTube restrictions (login required, SABR streaming detection)
- Marks failed downloads and SABR-protected videos in the queue
- Designed for GitHub Actions automation and local use

## How It Works
1. Add YouTube video URLs to `youtube_urls.json`.
2. Run the workflow or `node scripts/convert-and-feed.js`.
3. The script downloads new videos as MP3s to the `static/` directory.
4. An RSS feed is generated at `feed.xml` for podcast apps.
5. Videos that cannot be downloaded (e.g., SABR-protected) are marked in `youtube_urls.json`.

## Usage
### Add Videos
Edit `youtube_urls.json` and add objects like:
```json
[
	{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "processed": false }
]
```

### Run Locally
Install dependencies:
```bash
npm install
pip install yt-dlp
sudo apt-get update && sudo apt-get install -y ffmpeg
```

Run the main script:
```bash
node scripts/convert-and-feed.js
```

### GitHub Actions
The workflow automates the process on every push to the `gh-pages` branch. It installs dependencies, writes cookies from secrets, downloads new videos, updates the RSS feed, and commits changes.

## Authentication
For age-restricted/private videos, export your YouTube cookies as a header string and set it as the `YT_COOKIES_RAW` secret in your repository. The script will use this for authenticated downloads.

## SABR Streaming
If a video is SABR-protected, yt-dlp cannot download it. The script will mark such videos with `SABR: true` in `youtube_urls.json` and leave `processed: false`.

## Output
- MP3 files: `static/`
- RSS feed: `feed.xml`
- Download logs: Console output (see GitHub Actions logs or local terminal)

## Troubleshooting
- Check logs for errors and SABR warnings
- Make sure your cookies are valid and up-to-date
- Only public, non-SABR videos can be downloaded reliably

## License
MIT

## Credits
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [youtubei.js](https://github.com/LuanRT/YouTube.js)
- [rss](https://www.npmjs.com/package/rss)