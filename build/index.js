"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var request = require("superagent");
var fs = require("fs-extra");
var path = require("path");
var commander = require("commander");
var santizeFilename = require("sanitize-filename");
var lodash = require("lodash");
commander
    .option('-c --course [course]', "Course to download (name or code)", String)
    .option('-a --all [all]', 'Get all courses', Boolean)
    .option('-d --dir <to>', 'Location to download to', String)
    .option('-u --url <url>', 'Canvas API URL', String)
    .option('-t --token <token>', 'Canvas API token', String)
    .parse(process.argv);
function commanderFail(message) {
    console.error(message);
    commander.help();
}
if (commander.course && commander.all) {
    commanderFail("Specify either --course or --all, not both");
}
if (!commander.course && !commander.all) {
    commanderFail("Must specify either --course or --all");
}
for (var _i = 0, _a = ['dir', 'url', 'token']; _i < _a.length; _i++) {
    var key = _a[_i];
    if (!commander[key]) {
        commanderFail("Must specify " + key);
    }
}
function getJson(path, query) {
    if (query === void 0) { query = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request
                        .get("" + commander.url + path)
                        // .query(args)
                        .set('Authorization', "Bearer " + commander.token)
                        .set("Accept", 'application/json')
                        .query(query)["catch"](function (e) {
                        throw new Error(e.response.header.status + " (path:" + path + (false ? ', query:' + JSON.stringify({}) : '') + ")");
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.body];
            }
        });
    });
}
function getFile(url, destPath, mtime) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        var stream = fs.createWriteStream(destPath);
                        stream.on('finish', function () {
                            resolve();
                        });
                        stream.on('error', function (e) {
                            reject(e);
                        });
                        return request.get(url)
                            .set('Authorization', "Bearer " + commander.token)
                            .pipe(stream);
                    })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fs.utimes(destPath, new Date(), mtime)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function downloadFiles(c, courseDir) {
    return __awaiter(this, void 0, void 0, function () {
        var folders, files, sortedFiles, uniqueFiles, _loop_1, _i, uniqueFiles_1, file;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getJson("courses/" + c.id + "/folders", { per_page: 999 })];
                case 1:
                    folders = _a.sent();
                    return [4 /*yield*/, getJson("courses/" + c.id + "/files", { per_page: 999 })];
                case 2:
                    files = _a.sent();
                    sortedFiles = (files).sort(function (a, b) { return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime(); });
                    uniqueFiles = lodash.uniqBy(sortedFiles, function (f) { return f.folder_id + " " + f.filename; });
                    _loop_1 = function (file) {
                        var canvasFoldername, santizedCanvasFoldername, folder, destPath, canvasMtime, _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    canvasFoldername = folders.find(function (f) { return f.id === file.folder_id; }).full_name;
                                    santizedCanvasFoldername = path.resolve.apply(path, [courseDir].concat(canvasFoldername.split('/').map(function (n) { return santizeFilename(n); })));
                                    folder = path.resolve(courseDir, santizedCanvasFoldername);
                                    return [4 /*yield*/, fs.mkdirs(folder)];
                                case 1:
                                    _c.sent();
                                    destPath = path.resolve(folder, file.filename);
                                    canvasMtime = new Date(file.modified_at);
                                    return [4 /*yield*/, fs.pathExists(destPath)];
                                case 2:
                                    _a = (_c.sent());
                                    if (!_a) return [3 /*break*/, 4];
                                    _b = canvasMtime.getTime();
                                    return [4 /*yield*/, fs.stat(destPath)];
                                case 3:
                                    _a = _b === (_c.sent()).mtime.getTime();
                                    _c.label = 4;
                                case 4:
                                    if (!_a) return [3 /*break*/, 5];
                                    console.info("[SKIP] " + c.name + "/" + canvasFoldername + "/" + file.filename);
                                    return [3 /*break*/, 7];
                                case 5:
                                    console.info("[ DL ] " + c.name + "/" + canvasFoldername + "/" + file.filename);
                                    return [4 /*yield*/, getFile(file.url, destPath, new Date(file.modified_at))];
                                case 6:
                                    _c.sent();
                                    _c.label = 7;
                                case 7: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, uniqueFiles_1 = uniqueFiles;
                    _a.label = 3;
                case 3:
                    if (!(_i < uniqueFiles_1.length)) return [3 /*break*/, 6];
                    file = uniqueFiles_1[_i];
                    return [5 /*yield**/, _loop_1(file)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function downloadPages(c, courseDir) {
    return __awaiter(this, void 0, void 0, function () {
        var pages, pagesDir, _i, pages_1, page, filePath, canvasMtime, _a, r, pageData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getJson("courses/" + c.id + "/pages")];
                case 1:
                    pages = _b.sent();
                    pagesDir = path.resolve(courseDir, 'pages');
                    return [4 /*yield*/, fs.mkdirp(pagesDir)];
                case 2:
                    _b.sent();
                    _i = 0, pages_1 = pages;
                    _b.label = 3;
                case 3:
                    if (!(_i < pages_1.length)) return [3 /*break*/, 11];
                    page = pages_1[_i];
                    filePath = path.resolve(pagesDir, santizeFilename(page.url) + ".html");
                    canvasMtime = new Date(page.updated_at);
                    return [4 /*yield*/, fs.pathExists(filePath)];
                case 4:
                    _a = (_b.sent());
                    if (!_a) return [3 /*break*/, 6];
                    return [4 /*yield*/, fs.stat(filePath)];
                case 5:
                    _a = (_b.sent()).mtime.getTime() === canvasMtime.getTime();
                    _b.label = 6;
                case 6:
                    if (_a) {
                        console.info("[SKIP] " + filePath);
                        return [3 /*break*/, 10];
                    }
                    return [4 /*yield*/, request.get(commander.url + "/courses/" + c.id + "/pages/" + page.url).query({ per_page: 999 }).set("Authorization", "Bearer " + commander.token)];
                case 7:
                    r = _b.sent();
                    pageData = r.body;
                    return [4 /*yield*/, fs.writeFile(filePath, pageData.body)];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, fs.utimes(filePath, new Date(), canvasMtime)];
                case 9:
                    _b.sent();
                    console.info("[ DL ] " + filePath);
                    _b.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 3];
                case 11: return [2 /*return*/];
            }
        });
    });
}
function downloadAnnouncements(c, courseDir) {
    return __awaiter(this, void 0, void 0, function () {
        var announcements, announcementsDir, _i, announcements_1, a;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getJson("/announcements", { 'context_codes[]': "course_" + c.id, per_page: 999 })];
                case 1:
                    announcements = _a.sent();
                    if (!announcements) return [3 /*break*/, 6];
                    announcementsDir = path.resolve(courseDir, 'announcements');
                    return [4 /*yield*/, fs.mkdirp(announcementsDir)];
                case 2:
                    _a.sent();
                    _i = 0, announcements_1 = announcements;
                    _a.label = 3;
                case 3:
                    if (!(_i < announcements_1.length)) return [3 /*break*/, 6];
                    a = announcements_1[_i];
                    return [4 /*yield*/, fs.writeFile(path.resolve(announcementsDir, santizeFilename(a.title + '_' + a.id) + '.html'), a.message)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var courseName, targetFolder, courses, coursesToProcess, _i, coursesToProcess_1, c, courseDir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    courseName = commander.course;
                    targetFolder = commander.dir;
                    if (!targetFolder)
                        throw new Error('pls specify target ');
                    return [4 /*yield*/, getJson('courses')];
                case 1:
                    courses = _a.sent();
                    coursesToProcess = courseName ? courses.filter(function (a) { return a.name === courseName || a.course_code === courseName; }) : courses;
                    if (!coursesToProcess) {
                        throw new Error("Found no courses to download");
                    }
                    return [4 /*yield*/, fs.mkdirp(targetFolder)];
                case 2:
                    _a.sent();
                    _i = 0, coursesToProcess_1 = coursesToProcess;
                    _a.label = 3;
                case 3:
                    if (!(_i < coursesToProcess_1.length)) return [3 /*break*/, 9];
                    c = coursesToProcess_1[_i];
                    courseDir = path.resolve(targetFolder, santizeFilename(c.name));
                    return [4 /*yield*/, fs.mkdirp(courseDir)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, downloadFiles(c, courseDir)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, downloadPages(c, courseDir)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, downloadAnnouncements(c, courseDir)];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9: return [2 /*return*/];
            }
        });
    });
}
run()["catch"](function (error) {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map