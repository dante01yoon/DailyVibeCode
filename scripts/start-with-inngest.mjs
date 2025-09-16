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
      console.log(`${color}[${prefix}]\u001b[0m ${line}`);
    }
  });
}

// Respect platform PORT; default for local fallback only
process.env.PORT = process.env.PORT || '5000';

// Force Inngest dev engine if desired (recommended when self-hosting on Railway)
process.env.INNGEST_USE_DEV = process.env.INNGEST_USE_DEV || 'true';

// Start production app (built output)
const app = run('node', ['.mastra/output/index.mjs']);
withPrefix(app.stdout, 'app', '\u001b[35m');
withPrefix(app.stderr, 'app', '\u001b[35m');

// Start Inngest dev server sidecar on :3000
const inngest = run('bash', ['-lc', './scripts/inngest.sh']);
withPrefix(inngest.stdout, 'inngest', '\u001b[36m');
withPrefix(inngest.stderr, 'inngest', '\u001b[36m');

function shutdown(code = 0) {
  try { app.kill('SIGINT'); } catch {}
  try { inngest.kill('SIGINT'); } catch {}
  setTimeout(() => process.exit(code), 200);
}

app.on('exit', (code) => {
  console.log(`app exited with code ${code}`);
  shutdown(code ?? 0);
});
inngest.on('exit', (code) => {
  console.log(`inngest exited with code ${code}`);
  shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

