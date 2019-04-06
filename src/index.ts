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
  console.error(message);
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

async function getJson(path: string, query = {}) {
  const response = await request
    .get(`${commander.url}${path}`)
    // .query(args)
    .set('Authorization', `Bearer ${commander.token}`)
    .set("Accept", 'application/json')
    .query(query)
    .catch(e => {
      throw new Error(`${e.response.header.status} (path:${path}${false ? ', query:' + JSON.stringify({}) : ''})`);
    });
  return response.body;
}

async function getFile(url: string, destPath: string, mtime: Date) {
  await new Promise((resolve, reject) => {
    var stream = fs.createWriteStream(destPath);
    stream.on('finish', function() {
      resolve()
    });
    stream.on('error', function(e) {
      reject(e)
    })
    return request.get(url)
      .set('Authorization', `Bearer ${commander.token}`)
      .pipe(stream);
  })
  await fs.utimes(destPath, new Date(), mtime)
}

async function downloadFiles(c: Course, courseDir: string) {
  // files are flat, folders data needed to replicate canvas folder structure
  const folders = await getJson(`courses/${c.id}/folders`, { per_page: 999 }) as {
    id: number, //  folder_id of File
    full_name: string // folder path relative to course/<id>/files
  }[];

  // get list of files from canvas
  const files = await getJson(`courses/${c.id}/files`, { per_page: 999 }) as File[];
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
    const canvasMtime = new Date(file.modified_at);
    if ((await fs.pathExists(destPath)) && canvasMtime.getTime() === (await fs.stat(destPath)).mtime.getTime()) {
      console.info(`[SKIP] ${c.name}/${canvasFoldername}/${file.filename}`);
    } else {
      console.info(`[ DL ] ${c.name}/${canvasFoldername}/${file.filename}`);
      await getFile(file.url, destPath, new Date(file.modified_at));
    }
  }
}

async function downloadPages(c: Course, courseDir: string) {
  const pages = await getJson(`courses/${c.id}/pages`);
  const pagesDir = path.resolve(courseDir, 'pages');
  await fs.mkdirp(pagesDir);
  for (const page of pages) {
    const filePath = path.resolve(pagesDir, santizeFilename(page.url) + ".html")
    const canvasMtime = new Date(page.updated_at);
    if (await fs.pathExists(filePath) && (await fs.stat(filePath)).mtime.getTime() === canvasMtime.getTime()) {
      console.info(`[SKIP] ${filePath}`)
      continue;
    }
    const r = await request.get(`${commander.url}/courses/${c.id}/pages/${page.url}`).query({ per_page: 999 }).set("Authorization", `Bearer ${commander.token}`);
    const pageData = r.body;
    await fs.writeFile(filePath, pageData.body);
    await fs.utimes(filePath, new Date(), canvasMtime);
    console.info(`[ DL ] ${filePath}`)
  }
}

async function downloadAnnouncements(c: Course, courseDir: string) {
  const announcements = await getJson(`/announcements`, { 'context_codes[]': `course_${c.id}`, per_page: 999 });

  if (announcements) {
    const announcementsDir = path.resolve(courseDir, 'announcements');
    await fs.mkdirp(announcementsDir)
    for (const a of announcements) {
      await fs.writeFile(path.resolve(announcementsDir, santizeFilename(a.title + '_' + a.id) + '.html'), a.message);
    }
  }
}

async function run() {

  const courseName = commander.course;
  const targetFolder = commander.dir;
  if (!targetFolder) throw new Error('pls specify target ');

  const courses = await getJson('courses') as Course[];
  const coursesToProcess = courseName ? courses.filter(a => a.name === courseName || a.course_code === courseName) : courses;
  if (!coursesToProcess) {
    throw new Error("Found no courses to download");
  }

  await fs.mkdirp(targetFolder);

  for (const c of coursesToProcess) {
    const courseDir = path.resolve(targetFolder, santizeFilename(c.name));
    await fs.mkdirp(courseDir);


    await downloadFiles(c, courseDir);
    await downloadPages(c, courseDir);
    await downloadAnnouncements(c, courseDir);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
})
