import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const php = process.env.PHP_BINARY || (process.platform === 'win32' && existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
mkdirSync('.runtime/tmp', { recursive: true });
const phpOptions = ['-d', 'display_errors=0', '-d', 'display_startup_errors=0', '-d', `sys_temp_dir=${resolve('.runtime/tmp')}`];
const children = [
  spawn(php, [...phpOptions, '-S', '127.0.0.1:8082', '-t', 'public'], { stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/astro-dev.mjs'], { stdio: 'inherit' }),
];
let closing = false;
function stop(code = 0) { if (closing) return; closing = true; children.forEach((child) => child.kill()); process.exitCode = code; }
children.forEach((child) => { child.on('error', (error) => { console.error(error.message); stop(1); }); child.on('exit', (code) => stop(code ?? 0)); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
