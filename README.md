# canvas downloader

This is a script for downloading the contents of course pages of a Canvas LMS instance to your machine.

It downloaded all files, 'Pages' and 'Announcements'.
It could be extended to download more content.

Installation: `git clone https://github.com/Ysgorg/canvas-lms-downloader.git && cd canvas-lms-downloader && npm ci`

Example usage: `node build/index.js --token yourtoken --url 'https://canvas.vu.nl/api/v1/' --course "Software Testing" --dir canvasdata`

You can get a token by going to your account settings in Canvas.

future todos: download more kinds of content. clean up code a bit
