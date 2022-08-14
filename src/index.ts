import * as request from 'superagent';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mustache from 'mustache';
import * as Writer from './writer'
import * as Canvas from './Canvas'

import commander from 'commander';
import filenamify from "filenamify";
import lodash from 'lodash';
import {Storage} from '@google-cloud/storage';

/* -------------------------------------------------------------------------- */
/*                              Commander options                             */
/* -------------------------------------------------------------------------- */

commander
  .option('-c --course [course]', "Course to download (name or code)", String)
  .option('-a --all [all]', 'Get all courses', Boolean)
  .option('-d --dir <to>', 'Location to download to', String)
  .option('-u --url <url>', 'Canvas API URL', String)
  .option('-t --token <token>', 'Canvas API token', String)
  .option('-k --key <service key>', 'Google Cloud Service Key', String)
  .option('-b --bucket <bucket>', 'Google Cloud Storage Bucket', String)
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

// Mandatory params
for (const key of ['dir', 'url', 'token']) {
  if (!commander[key]) {
    commanderFail(`Must specify ${key}`);
  }
}

// Params for Google Cloud
if (commander.key || commander.bucket)
for (const key of ['key', 'bucket']) {
  if (!commander[key]) {
    commanderFail(`Must specify --key and --bucket together`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Init                                    */
/* -------------------------------------------------------------------------- */

var options: Writer.WriterOptions = {
  baseDir: commander.dir,
  provider: null // Set below
}

// Handles setting the correct options for the Writer Interface
function init() {
  if (commander.dir) {
    if (commander.token && commander.bucket) {
      // Google Cloud Storage Writer
      if (!fs.existsSync(commander.key))
        commanderFail("Key does not exist.")

      const storage = new Storage({keyFilename: commander.key})
      const bucket = storage.bucket(commander.bucket)
      
      options.provider = "gcp";
      options.bucket = bucket;
    } else {
      // Filesystem
      options.provider ="fs";
      options.baseDir = path.resolve(options.baseDir);
    }
  } else {
    commanderFail('Missing parameters.');
  }
}

const newWriter = (destFileName: string, resolve: Function, reject: Function) : Writer.IWriter => {
  switch (options.provider) {
    case "gcp":
      return new Writer.GoogleStorageWriter(destFileName, resolve, reject, options);

    case "fs":
      return new Writer.FSWriter(destFileName, resolve, reject, options);
  
    default:
      console.error("No suitable writer found.")
      break;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

// would be safer to use pagination, but most courses probably dont have more files,pages or announcments than this
const PAGE_SIZE = 999999;

function santizeFilename(s:string){
  return filenamify(s).replace(/\s|\+/g,'_')
}

async function download_upload(url: string, stream: NodeJS.WritableStream) {
  request
    .get(url)
    .set('Authorization', `Bearer ${commander.token}`)
    .pipe(stream);
}

/* -------------------------------------------------------------------------- */
/*                       Need to rewrite function below                       */
/* -------------------------------------------------------------------------- */

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

async function fIfNeeded(destPath: string, mtime: Date, cb:() => Promise<void>) {
  // TODO: Write this function

  await cb();
}

/* -------------------------------------------------------------------------- */
/*                               Main functions                               */
/* -------------------------------------------------------------------------- */

async function downloadFiles(c: Canvas.Course, courseDir: string) {
  console.info('\n[INFO] Downloading files...');

  // files are flat, folders data needed to replicate canvas folder structure
  const folders = await getJson(`${commander.url}/courses/${c.id}/folders`) as Canvas.Folder[];
  if (!folders) return;

  // get list of files from canvas
  const files = await getJson(`${commander.url}/courses/${c.id}/files`) as Canvas.File[];
  if (!files) return;

  // sort by date with most recently modified first
  const sortedFiles = (files).sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime())
  // remove files with duplicate paths, keeping the most recently modified in case of conflict (guaranteed due to sort direction)
  const uniqueFiles = lodash.uniqBy(sortedFiles, f => `${f.folder_id} ${f.filename}`);

  for (const file of uniqueFiles) {

    // Some files are locked and not available for download, which causes the script to silently fail
    if (file.locked_for_user) {
      console.info(`[INFO] File \'${file.filename}\' skipped. Reason: ${file.lock_explanation}`);
      continue;
    }

    const canvasFoldername = folders.find(f => f.id === file.folder_id).full_name;
    const santizedCanvasFoldername = path.join(courseDir, ...canvasFoldername.split('/').map(n => santizeFilename(n)));
    
    const destPath = path.join(santizedCanvasFoldername, santizeFilename(file.filename));

    await fIfNeeded(
      destPath, 
      new Date(file.modified_at), 
      () => new Promise((resolve, reject) => {
        const stream = newWriter(destPath, resolve, reject).stream;
        download_upload(file.url, stream);        
      })
    );
  }
}


async function downloadModules(c: Canvas.Course, courseDir: string) {
  console.info('\n[INFO] Downloading modules...');

  // files are flat, folders data needed to replicate canvas folder structure
  const modules = await getJson(`${commander.url}/courses/${c.id}/modules`) as Canvas.Module[];

  if (modules.length == 0) {
    console.log('[INFO] No modules to download...');
    return;
  }

  for (let module of modules){

    const canvasFoldername = `modules/${module.name}`
    const santizedCanvasFoldername = path.join(courseDir, ...canvasFoldername.split('/').map(n => santizeFilename(n))).replace(/\s/g,'_');

    let external_urls: Canvas.ModuleItem[] = [];
    const items = await getJson(module.items_url) as Canvas.ModuleItem[];
    for (let item of items){
      // this can be any of a number of different interfaces.
      // it might contain a download link for a file which is not available under the /files api

      // Export external links to a text file
      if (item.external_url != undefined)
        external_urls.push(item);

      if (item.url == undefined) continue;

      const thing = await getJson(item.url);

      if (!thing.url || !thing.filename) continue;

      const destPath = path.join(santizedCanvasFoldername, santizeFilename(thing.filename));

      await fIfNeeded(
        destPath, 
        new Date(thing.updated_at), 
        () => new Promise((resolve, reject) => {
          const stream = newWriter(destPath, resolve, reject).stream;
          download_upload(item.url, stream);        
        })
      );
    }

    // Write a markdown file with all the extenal URLs
    // TODO: Use mustache templates
    if (external_urls.length > 0) {
      const template = `
        # ${module.name} 

        {{#.}}
        - [{{{title}}}]({{{external_url}}})
        {{/.}}
      `

      const md = mustache.render(template, external_urls);
      const destPath = path.join(santizedCanvasFoldername, 'External_urls.md');

      await fIfNeeded(
        destPath, 
        new Date(), // FIX THIS -- not sure
        () => new Promise((resolve, reject) => {
          const stream = newWriter(destPath, resolve, reject).stream;

          stream.write(md);
          stream.end();
        })
      );
    }
  }
}


async function downloadPages(c: Canvas.Course, courseDir: string) {
  console.log('\n[INFO] Downloading pages...');

  const pages = await getJson(`${commander.url}/courses/${c.id}/pages`) as Canvas.Page[];
  if (!pages) return;

  const pagesDir = path.join(courseDir, 'pages');

  for (const page of pages) {
    const destPath = path.join(pagesDir, santizeFilename(page.url) + ".html");

    await fIfNeeded(
      destPath, 
      new Date(page.updated_at), 
      () => new Promise((resolve, reject) => {
        request
          .get(`${commander.url}/courses/${c.id}/pages/${page.url}`)
          .query({ per_page: PAGE_SIZE })
          .set("Authorization", `Bearer ${commander.token}`)
          .then((res) => {
            const pageData = res.body;

            const template = fs.readFileSync(path.resolve('build/templates/base.mustache')).toString();
            const content  = fs.readFileSync(path.resolve('build/templates/page.mustache')).toString();

            const result = mustache.render(template, pageData, {content: content});

            const stream = newWriter(destPath, resolve, reject).stream; 
            stream.write(result);
            stream.end();
          });   
      })
    );
  }
}


async function downloadAnnouncements(c: Canvas.Course, courseDir: string) {
  console.log('\n[INFO] Downloading announcements...');

  const announcements = await getJson(
    `${commander.url}/announcements`,
    {
      'context_codes[]': `course_${c.id}`, 
      'start_date'     : '1900-01-01', 
      'end_date'       : new Date().toISOString()
    }
  ) as Canvas.Announcement[];

  if (!announcements) return;
  
  const announcementsDir = path.join(courseDir, 'announcements');
  const template = fs.readFileSync(path.resolve('build/templates/announcement.mustache')).toString();

  for (const a of announcements) {
    const prefix = new Date(a.posted_at).toISOString().replace(/[\-\:]/g, '').split('.')[0];
    const destPath = path.join(announcementsDir, santizeFilename(prefix + '_' + a.title) + '.html');

    await fIfNeeded(
      destPath, 
      new Date(a.posted_at),
      () => new Promise((resolve, reject) => {
        // format date in a nice way
        a.posted_at = new Date(a.posted_at).toLocaleString();

        const res = mustache.render(template, a);
        const stream = newWriter(destPath, resolve, reject).stream;

        stream.write(res);
        stream.end();
      })
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                     Run                                    */
/* -------------------------------------------------------------------------- */

async function run() {
  init();

  const courseName = commander.course;
  const targetFolder = options.baseDir;

  const courses = await getJson(
                    `${commander.url}/courses`,
                    {
                      'per_page'  :PAGE_SIZE, 
                      'include[]' : "syllabus_body"
                    }) as Canvas.Course[];

  if (!courses) return;

  let coursesToProcess = courseName ? courses.filter(a => a.name === courseName || a.course_code === courseName) : courses;

  // Filter courses that are not available
  coursesToProcess = coursesToProcess.filter(a => a.name != undefined);

  
  if (!coursesToProcess) {
    console.info("Found no courses to download");
    return;
  }

  for (const c of coursesToProcess) {

    console.info(`\n> Downloading from ${c.course_code} ${c.name}`);

    const courseDir = path.join(targetFolder, santizeFilename(c.name)+"_"+c.id);

    // Download syllabus 
    // TODO; Download Syllabus https://canvas.instructure.com/doc/api/courses.html
    // Consider special case where syllabus is an attachment (not in files)
    if (c.syllabus_body != undefined && c.syllabus_body != "") {
      const template = fs.readFileSync(path.resolve('build/templates/syllabus.mustache')).toString();
      const res = mustache.render(template, c);
      const filePath = path.join(courseDir, "syllabus.html")

      await fIfNeeded(
        filePath, 
        new Date(), // FIX THIS -- not sure
        () => new Promise((resolve, reject) => {
          const stream = newWriter(filePath, resolve, reject).stream;

          stream.write(res);
          stream.end();
        })
      );

    }

    await downloadFiles(c, courseDir).catch(console.error);
    await downloadModules(c, courseDir).catch(console.error);
    await downloadPages(c, courseDir).catch(console.error);
    await downloadAnnouncements(c, courseDir).catch(console.error);
    
    console.log("[INFO] Course contents finished downloading...");
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
})
