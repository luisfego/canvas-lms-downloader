# Canvas LMS Course Data Downloader

This is a script for downloading the contents of course pages of a Canvas LMS instance to your machine.

It downloaded all files, 'Pages' and 'Announcements'.
It could be extended to download more content.

## Installation

```
# clone this repository
git clone https://github.com/Ysgorg/canvas-lms-downloader.git

# install dependencies and build
cd canvas-lms-downloader && npm ci && npm run build
```

## Usage

You'll need an access token to the target Canvas LMS instance.
You can get generate one in your account settings in Canvas.

```
npm start -- --token yourtoken --url 'https://canvas.vu.nl/api/v1/' --course "Software Testing" --dir canvasdata`
```
