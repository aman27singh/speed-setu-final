Place your hero video files here.

Recommended filenames:
- hero.webm  (WebM, preferred for smaller size)
- hero.mp4   (H.264 MP4 for maximum compatibility)

Usage:
- Add both formats for best browser coverage.
- Example sources in HTML:
  <video autoplay muted loop playsinline preload="auto" poster="/assets/images/hero-poster.svg" class="hero-video">
    <source src="/assets/videos/hero.webm" type="video/webm">
    <source src="/assets/videos/hero.mp4" type="video/mp4">
  </video>

Encoding tips:
- 720p or 1080p, short loop (6-20s)
- H.264 baseline/main profile for mp4
- Use CRF ~20-24 for reasonable quality/size

If you want, I can help encode or upload these to S3/Cloudflare/Netlify.