"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
    if (message)
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
// would be safer to use pagination, but most courses probably dont have more files,pages or announcments than this
var PAGE_SIZE = 999999;
function fIfNeeded(f, destPath, mtime) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fs.pathExists(destPath)];
                case 1:
                    _a = (_c.sent());
                    if (!_a) return [3 /*break*/, 3];
                    _b = mtime.getTime();
                    return [4 /*yield*/, fs.stat(destPath)];
                case 2:
                    _a = _b === (_c.sent()).mtime.getTime();
                    _c.label = 3;
                case 3:
                    if (!_a) return [3 /*break*/, 4];
                    console.info("[SKIP] " + destPath);
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, f()];
                case 5:
                    _c.sent();
                    _c.label = 6;
                case 6:
                    console.info("[WRITE] " + destPath);
                    return [4 /*yield*/, fs.utimes(destPath, new Date(), mtime)];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getJson(url, query) {
    if (query === void 0) { query = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = __assign({ per_page: PAGE_SIZE }, query);
                    return [4 /*yield*/, request
                            .get(url)
                            .set('Authorization', "Bearer " + commander.token)
                            .set("Accept", 'application/json')
                            .query(query)["catch"](function (e) {
                            console.error("[" + e.response.header.status + "] " + url + " query:" + JSON.stringify(query));
                        })];
                case 1:
                    response = _a.sent();
                    if (response)
                        return [2 /*return*/, response.body];
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
                case 0: return [4 /*yield*/, getJson(commander.url + "/courses/" + c.id + "/folders")];
                case 1:
                    folders = _a.sent();
                    if (!folders)
                        return [2 /*return*/];
                    return [4 /*yield*/, getJson(commander.url + "/courses/" + c.id + "/files")];
                case 2:
                    files = _a.sent();
                    if (!files)
                        return [2 /*return*/];
                    sortedFiles = (files).sort(function (a, b) { return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime(); });
                    uniqueFiles = lodash.uniqBy(sortedFiles, function (f) { return f.folder_id + " " + f.filename; });
                    _loop_1 = function (file) {
                        var canvasFoldername, santizedCanvasFoldername, folder, destPath;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    canvasFoldername = folders.find(function (f) { return f.id === file.folder_id; }).full_name;
                                    santizedCanvasFoldername = path.resolve.apply(path, [courseDir].concat(canvasFoldername.split('/').map(function (n) { return santizeFilename(n); })));
                                    folder = path.resolve(courseDir, santizedCanvasFoldername);
                                    return [4 /*yield*/, fs.mkdirs(folder)];
                                case 1:
                                    _a.sent();
                                    destPath = path.resolve(folder, file.filename);
                                    return [4 /*yield*/, fIfNeeded(function () { return new Promise(function (resolve, reject) {
                                            var stream = fs.createWriteStream(destPath);
                                            stream.on('finish', function () {
                                                resolve();
                                            });
                                            stream.on('error', function (e) {
                                                reject(e);
                                            });
                                            return request.get(file.url)
                                                .set('Authorization', "Bearer " + commander.token)
                                                .pipe(stream);
                                        }); }, destPath, new Date(file.modified_at))];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
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
        var pages, pagesDir, _loop_2, _i, pages_1, page;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getJson(commander.url + "/courses/" + c.id + "/pages")];
                case 1:
                    pages = _a.sent();
                    if (!pages)
                        return [2 /*return*/];
                    pagesDir = path.resolve(courseDir, 'pages');
                    return [4 /*yield*/, fs.mkdirp(pagesDir)];
                case 2:
                    _a.sent();
                    _loop_2 = function (page) {
                        var destPath;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    destPath = path.resolve(pagesDir, santizeFilename(page.url) + ".html");
                                    return [4 /*yield*/, fIfNeeded(function () { return __awaiter(_this, void 0, void 0, function () {
                                            var r, pageData;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, request.get(commander.url + "/courses/" + c.id + "/pages/" + page.url).query({ per_page: PAGE_SIZE }).set("Authorization", "Bearer " + commander.token)];
                                                    case 1:
                                                        r = _a.sent();
                                                        pageData = r.body;
                                                        return [4 /*yield*/, fs.writeFile(destPath, pageData.body)];
                                                    case 2:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); }, destPath, new Date(page.updated_at))];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, pages_1 = pages;
                    _a.label = 3;
                case 3:
                    if (!(_i < pages_1.length)) return [3 /*break*/, 6];
                    page = pages_1[_i];
                    return [5 /*yield**/, _loop_2(page)];
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
function downloadAnnouncements(c, courseDir) {
    return __awaiter(this, void 0, void 0, function () {
        var announcements, announcementsDir, _loop_3, _i, announcements_1, a;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getJson(commander.url + "/announcements", { 'context_codes[]': "course_" + c.id })];
                case 1:
                    announcements = _a.sent();
                    if (!announcements)
                        return [2 /*return*/];
                    announcementsDir = path.resolve(courseDir, 'announcements');
                    return [4 /*yield*/, fs.mkdirp(announcementsDir)];
                case 2:
                    _a.sent();
                    _loop_3 = function (a) {
                        var canvasMtime, destPath;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    canvasMtime = new Date(a.created_at);
                                    destPath = path.resolve(announcementsDir, santizeFilename(a.title + '_' + a.id) + '.html');
                                    return [4 /*yield*/, fIfNeeded(function () { fs.writeFile(destPath, a.message); }, destPath, canvasMtime)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, announcements_1 = announcements;
                    _a.label = 3;
                case 3:
                    if (!(_i < announcements_1.length)) return [3 /*break*/, 6];
                    a = announcements_1[_i];
                    return [5 /*yield**/, _loop_3(a)];
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
                    return [4 /*yield*/, getJson(commander.url + "/courses", { per_page: PAGE_SIZE })];
                case 1:
                    courses = _a.sent();
                    if (!courses)
                        return [2 /*return*/];
                    coursesToProcess = courseName ? courses.filter(function (a) { return a.name === courseName || a.course_code === courseName; }) : courses;
                    if (!coursesToProcess) {
                        console.info("Found no courses to download");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, fs.mkdirp(targetFolder)];
                case 2:
                    _a.sent();
                    _i = 0, coursesToProcess_1 = coursesToProcess;
                    _a.label = 3;
                case 3:
                    if (!(_i < coursesToProcess_1.length)) return [3 /*break*/, 9];
                    c = coursesToProcess_1[_i];
                    console.info("\n> Downloading from " + c.course_code + " " + c.name);
                    courseDir = path.resolve(targetFolder, santizeFilename(c.name));
                    return [4 /*yield*/, fs.mkdirp(courseDir)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, downloadFiles(c, courseDir)["catch"](console.error)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, downloadPages(c, courseDir)["catch"](console.error)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, downloadAnnouncements(c, courseDir)["catch"](console.error)];
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