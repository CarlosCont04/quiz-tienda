import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const php = process.env.PHP_BINARY || (process.platform === 'win32' && existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const command = process.argv[2];
const commands = {
  setup: ['scripts/setup-db.php'],
  test: ['tests/quiz.php'],
  public: ['-S', '127.0.0.1:8082', '-t', 'public'],
  dist: ['-S', '127.0.0.1:8082', '-t', 'dist', 'scripts/router.php'],
};
if (command && commands[command]) {
  if (command === 'dist' && !existsSync('dist/index.html')) { console.error('Ejecuta npm run build primero.'); process.exit(1); }
  mkdirSync('.runtime/tmp', { recursive: true });
  const child = spawn(php, ['-d', 'display_errors=0', '-d', 'display_startup_errors=0', '-d', `sys_temp_dir=${resolve('.runtime/tmp')}`, ...commands[command]], { stdio: 'inherit' });
  child.on('error', () => { console.error('PHP no está disponible. Configura PHP_BINARY con la ruta a PHP de XAMPP.'); process.exit(1); });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
}
