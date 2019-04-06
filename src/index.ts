import * as request from 'superagent';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as commander from 'commander';
import * as santizeFilename from 'sanitize-filename';
import * as lodash from 'lodash';

commander
  .option('-c --course [course]', "Course to download (name or code)", String)
  .option('-a --all [all]', 'Get all courses', Boolean)
  .option('-d --dir <to>', 'Location to download to', String)
  .option('-u --url <url>', 'Canvas API URL', String)
  .option('-t --token <token>', 'Canvas API token', String)
  .parse(process.argv);

function commanderFail(message: string) {
  if (message) console.error(message);
  commander.help()
}

if (commander.course && commander.all) {
  commanderFail("Specify either --course or --all, not both");
}
if (!commander.course && !commander.all) {
  commanderFail("Must specify either --course or --all");
}
for (const key of ['dir', 'url', 'token']) {
  if (!commander[key]) {
    commanderFail(`Must specify ${key}`);
  }
}

// would be safer to use pagination, but most courses probably dont have more files,pages or announcments than this
const PAGE_SIZE = 999999;

interface Course {
  id: number,
  name: string,
  course_code:string
}

interface File {
  folder_id: number,
  filename: string,
  url: string, // link to download actual bytes of files
  modified_at: string, // timestamp
}

interface Folder {
  id: number,
  full_name: string // folder path relative to course/<id>/files
}

interface Page {
  url: string;
  updated_at: string;
}

interface Announcement {
  id:string;
  title:string;
  created_at: string;
  message:string;
}

async function fIfNeeded(f:()=>void, destPath:string, mtime:Date){
  // check if a file already exists at destPath and has a certain last modified time.
  // if not, then execute the passed function. which should cause a file to be created at destPath.
  // then the modification time applied to the newly created file.
  if ((await fs.pathExists(destPath)) && mtime.getTime() === (await fs.stat(destPath)).mtime.getTime()) {
    console.info(`[SKIP] ${destPath}`);
    return;
  }
  else await f();
  console.info(`[WRITE] ${destPath}`);
  await fs.utimes(destPath, new Date(), mtime);
}

async function getJson(url: string, query = {}) {
  query = {per_page:PAGE_SIZE, ...query};
  const response = await request
    .get(url)
    .set('Authorization', `Bearer ${commander.token}`)
    .set("Accept", 'application/json')
    .query(query)
    .catch(e => {
      console.error(`[${e.response.header.status}] ${url} query:${JSON.stringify(query)}`);
    });
  if (response) return response.body;
}

async function downloadFiles(c: Course, courseDir: string) {
  // files are flat, folders data needed to replicate canvas folder structure
  const folders = await getJson(`${commander.url}/courses/${c.id}/folders`) as Folder[];
  if (!folders) return;

  // get list of files from canvas
  const files = await getJson(`${commander.url}/courses/${c.id}/files`) as File[];
  if (!files) return;

  // sort by date with most recently modified first
  const sortedFiles = (files).sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime())
  // remove files with duplicate paths, keeping the most recently modified in case of conflict (guaranteed due to sort direction)
  const uniqueFiles = lodash.uniqBy(sortedFiles, f => `${f.folder_id} ${f.filename}`);

  for (const file of uniqueFiles) {
    const canvasFoldername = folders.find(f => f.id === file.folder_id).full_name;
    const santizedCanvasFoldername = path.resolve(courseDir, ...canvasFoldername.split('/').map(n => santizeFilename(n)));
    const folder = path.resolve(courseDir, santizedCanvasFoldername);
    await fs.mkdirs(folder)
    const destPath = path.resolve(folder, file.filename);

    await fIfNeeded(
      ()=>new Promise((resolve, reject) => {
        var stream = fs.createWriteStream(destPath);
        stream.on('finish', function() {
          resolve()
        });
        stream.on('error', function(e) {
          reject(e)
        })
        return request.get(file.url)
          .set('Authorization', `Bearer ${commander.token}`)
          .pipe(stream);
      }),
      destPath,
      new Date(file.modified_at)
    )
  }
}


async function downloadPages(c: Course, courseDir: string) {
  const pages = await getJson(`${commander.url}/courses/${c.id}/pages`) as Page[];
  if (!pages) return;
  const pagesDir = path.resolve(courseDir, 'pages');
  await fs.mkdirp(pagesDir);
  for (const page of pages) {
    const destPath = path.resolve(pagesDir, santizeFilename(page.url) + ".html");
    await fIfNeeded(async ()=>{
      const r = await request.get(`${commander.url}/courses/${c.id}/pages/${page.url}`).query({ per_page: PAGE_SIZE }).set("Authorization", `Bearer ${commander.token}`);
      const pageData = r.body;
      await fs.writeFile(destPath, pageData.body)},
      destPath,
      new Date(page.updated_at)
    )
  }
}
async function downloadAnnouncements(c: Course, courseDir: string) {
  const announcements = await getJson(`${commander.url}/announcements`, { 'context_codes[]': `course_${c.id}` }) as Announcement[];
  if (!announcements) return;
  const announcementsDir = path.resolve(courseDir, 'announcements');
  await fs.mkdirp(announcementsDir)
  for (const a of announcements) {
    const canvasMtime = new Date(a.created_at);
    const destPath = path.resolve(announcementsDir, santizeFilename(a.title + '_' + a.id) + '.html');
    await fIfNeeded(()=>{fs.writeFile(destPath, a.message)},destPath,canvasMtime)
  }
}

async function run() {

  const courseName = commander.course;
  const targetFolder = commander.dir;

  const courses = await getJson(`${commander.url}/courses`, {per_page:PAGE_SIZE}) as Course[];
  if (!courses) return;
  const coursesToProcess = courseName ? courses.filter(a => a.name === courseName || a.course_code === courseName) : courses;
  if (!coursesToProcess) {
    console.info("Found no courses to download");
    return;
  }

  await fs.mkdirp(targetFolder);

  for (const c of coursesToProcess) {

    console.info(`\n> Downloading from ${c.course_code} ${c.name}`);

    const courseDir = path.resolve(targetFolder, santizeFilename(c.name));
    await fs.mkdirp(courseDir);

    await downloadFiles(c, courseDir).catch(console.error);
    await downloadPages(c, courseDir).catch(console.error);
    await downloadAnnouncements(c, courseDir).catch(console.error);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
})
