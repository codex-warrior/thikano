// App Hosting only: its Next.js adapter expects the build at <root>/.next with the standalone
// server at .next/standalone/server.js. In this npm-workspaces monorepo the app builds into
// apps/<app>/.next and the standalone server lands in .next/standalone/apps/<app>. Move both
// into the layout the adapter reads. No-op outside the adapter (it sets NEXT_PRIVATE_STANDALONE).
import { cpSync, existsSync, lstatSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';

// rename, falling back to copy + delete where the OS refuses (e.g. Windows file locks).
function move(from, to) {
  try {
    renameSync(from, to);
  } catch {
    cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    rmSync(from, { recursive: true, force: true });
  }
}

const app = process.env.THIKANO_APP;
if (process.env.NEXT_PRIVATE_STANDALONE !== 'true' || !app) process.exit(0);

const root = process.cwd();
const built = join(root, 'apps', app, '.next');
const target = join(root, '.next');
if (!existsSync(join(built, 'standalone'))) {
  console.error(`hoist-next-build: ${built}/standalone not found`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
move(built, target);

const standalone = join(target, 'standalone');
const nested = join(standalone, 'apps', app);
// Turbopack aliases server externals (e.g. firebase-admin-<hash>) as symlinks in .next/node_modules
// pointing into standalone/node_modules; they break when moved, so remember the package each names.
const externals = join(nested, '.next', 'node_modules');
const links = existsSync(externals)
  ? readdirSync(externals)
      .filter((name) => lstatSync(join(externals, name)).isSymbolicLink())
      .map((name) => ({ name, pkg: readlinkSync(join(externals, name)).replace(/\\/g, '/').split('node_modules/').pop() }))
  : [];
for (const entry of readdirSync(nested)) move(join(nested, entry), join(standalone, entry));
rmSync(join(standalone, 'apps'), { recursive: true, force: true });

const movedExternals = join(standalone, '.next', 'node_modules');
for (const { name, pkg } of links) {
  const link = join(movedExternals, name);
  const dest = join(standalone, 'node_modules', pkg);
  try {
    unlinkSync(link);
  } catch {
    rmSync(link, { recursive: true, force: true });
  }
  if (process.platform === 'win32') symlinkSync(dest, link, 'junction');
  else symlinkSync(relative(movedExternals, dest), link);
}
console.log(`hoist-next-build: moved apps/${app}/.next to .next and flattened the standalone server`);
