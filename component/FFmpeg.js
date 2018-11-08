"use strict";

const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const { ffmpeg, ffprobe, TEMP_PATH } = require("../config/system");
const { getFileName } = require("../lib/MyFile");
const { promisify } = require('util');
const execSync = child_process.execSync

/**
 * 获取音频相关信息
 * 
 * @param {string} input_file 需要获取信息的音频
 * @param {string} [entries=duration,bit_rate] 需要打印的项，为空时打印所有。
 * 
 * @returns {object} 音频信息
 * 
 * @throws 文件不存在或者项不合法时报错
 */
function getSoundInfo(input_file, entries="duration,bit_rate") {
    if (!fs.existsSync(input_file)) throw new Error(`File ${input_file} not exists`);
    let show_entries = entries ? `-show_entries format=${entries}` : "-show_format";
    let cmd = `${ffprobe} -v quiet -print_format json ${show_entries} -i ${input_file}`;
    let stdout = execSync(cmd);
    let info = JSON.parse(stdout).format;
    return info;
}

/**
 * 将输入的音频文件转为指定比特率的 mp3
 * 
 * @param {string} input_file 需要转码的音频
 * @param {int} rate 指定的比特率
 * 
 * @returns {string} 输出文件路径
 * 
 * @throws 文件不存在或者比特率不合法时报错
 */
async function toMP3(input_file, rate) {
    if (!fs.existsSync(input_file)) throw new Error(`File ${input_file} not exists`);
    let file_name = getFileName(input_file, false);
    let output_file = `${file_name}_${rate}.mp3`;
    output_file = path.join(TEMP_PATH, output_file);
    let cmd = `${ffmpeg} -i ${input_file} -y -vn -v quiet -b:a ${rate}k -ar 44100 -f mp3 ${output_file}`;
    // child_process.exec(cmd)
    let aa = promisify(child_process.exec)
    aa(cmd)
    // execSync(cmd);

    return output_file;
}

exports.getSoundInfo = getSoundInfo;
exports.toMP3 = toMP3;