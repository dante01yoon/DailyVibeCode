import { spawn } from 'node:child_process';

function run(cmd, args = [], opts = {}) {
  const p = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env },
    ...opts,
  });
  return p;
}

function withPrefix(stream, prefix, color = '\u001b[36m') {
  let buf = '';
  stream.on('data', (data) => {
    buf += data.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      // eslint-disable-next-line no-console
      console.log(`${color}[${prefix}]\u001b[0m ${line}`);
    }
  });
}

// Default dev port aligns with package.json and code
process.env.PORT = process.env.PORT || '5001';

// Start Mastra dev server
const mastra = run('bash', ['-lc', 'npm run dev']);
withPrefix(mastra.stdout, 'mastra', '\u001b[35m');
withPrefix(mastra.stderr, 'mastra', '\u001b[35m');

// Start Inngest dev server (dev proxy on :3000)
const inngest = run('bash', ['-lc', './scripts/inngest.sh']);
withPrefix(inngest.stdout, 'inngest', '\u001b[36m');
withPrefix(inngest.stderr, 'inngest', '\u001b[36m');

function shutdown(code = 0) {
  try { mastra.kill('SIGINT'); } catch {}
  try { inngest.kill('SIGINT'); } catch {}
  setTimeout(() => process.exit(code), 200);
}

mastra.on('exit', (code) => {
  // eslint-disable-next-line no-console
  console.log(`mastra exited with code ${code}`);
  shutdown(code ?? 0);
});
inngest.on('exit', (code) => {
  // eslint-disable-next-line no-console
  console.log(`inngest exited with code ${code}`);
  shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

