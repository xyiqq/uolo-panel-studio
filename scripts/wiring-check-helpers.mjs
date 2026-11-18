import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
export const compact = text => text.normalize('NFKC').replace(/\s+/gu, '');
export function csvRows(csv) {
  const rows = csv.replace(/^\uFEFF/u, '').trimEnd().split(/\r?\n/u)
    .map(line => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/gu)].map(cell => cell[1].replaceAll('""', '"')));
  const header = rows.shift();
  const fields = ['起点', '终点', '起点标签', '终点标签', '导体', '线类', '连接状态', '线号'];
  const indices = fields.map(field => header.indexOf(field));
  assert.ok(indices.every(index => index >= 0), 'Wire CSV is missing endpoint, conductor or connection columns');
  return rows.map(row => {
    const [from, to, fromTag, toTag, conductor, wireClass, state, wireTag] = indices.map(index => row[index]);
    return { from, to, fromTag, toTag, conductor, wireClass, state, wireTag };
  });
}

export function pdfPages(path) {
  const result = spawnSync('pdftotext', ['-raw', '-enc', 'UTF-8', path, '-'], { encoding: 'utf8' });
  if (!result.error) {
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.split('\f').map(compact);
  }
  if (result.error.code !== 'ENOENT') throw result.error;
  const python = process.env.PDF_PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
  const code = 'import sys; from pypdf import PdfReader; sys.stdout.buffer.write("\\f".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages).encode("utf-8"))';
  return execFileSync(python, ['-c', code, path], { encoding: 'utf8' }).split('\f').map(compact);
}
