// Plugin de Vite (solo servidor de desarrollo): agrega fotos a src/photos.js
// desde el panel oculto #admin. No se incluye en el build de producción.
import fs from 'node:fs';
import path from 'node:path';

const IBB = 'https://i.ibb.co/';
const SAFE_URL = /^(https?:\/\/[^\s'"\\`<>]+|[\w.\-~%+/]+)$/;
const SAFE_TEXT = /^[^'"\\`\r\n\[\]]+$/;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function insertPhoto(src, { url, category }) {
  url = String(url || '').trim();
  category = String(category || '').trim();
  if (!SAFE_URL.test(url)) throw new Error('El enlace no es válido.');
  if (!category || !SAFE_TEXT.test(category)) throw new Error('El nombre de la categoría no es válido.');
  if (url.startsWith(IBB)) url = url.slice(IBB.length);

  const start = src.indexOf('const GALLERY = {');
  const end = src.search(/^};/m);
  if (start === -1 || end === -1 || end < start) throw new Error('No encontré el bloque GALLERY en photos.js.');
  const gallery = src.slice(start, end);

  if (gallery.includes(`'${url}'`) || gallery.includes(`'${IBB}${url}'`)) {
    throw new Error('Esa foto ya está en la lista.');
  }

  const entry = `'${url}',`;
  const open = new RegExp(`^([ \\t]*)'${escapeRegExp(category)}':\\s*\\[`, 'm').exec(gallery);

  if (open) {
    const rest = gallery.slice(open.index);
    const close = /^[ \t]*\],?[ \t]*$/m.exec(rest);
    if (!close) throw new Error('No pude ubicar el final de la categoría en photos.js.');
    const at = start + open.index + close.index;
    return src.slice(0, at) + `${open[1]}  ${entry}\n` + src.slice(at);
  }

  const block = `\n  '${category}': [\n    ${entry}\n  ],\n`;
  const before = src.slice(0, end);
  return (before.endsWith('\n') ? before : before + '\n') + block + src.slice(end);
}

export default function photosAdmin({ file = 'src/photos.js' } = {}) {
  return {
    name: 'photos-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__admin/add-photo', (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (req.method !== 'POST') return send(405, { ok: false, error: 'Método no permitido.' });
        if (!String(req.headers['content-type'] || '').includes('application/json')) {
          return send(415, { ok: false, error: 'Tipo de contenido no válido.' });
        }
        // Protección: solo acepta peticiones del propio sitio de desarrollo
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) {
          return send(403, { ok: false, error: 'Origen no permitido.' });
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1e4) req.destroy();
        });
        req.on('end', () => {
          try {
            const filePath = path.resolve(server.config.root, file);
            const src = fs.readFileSync(filePath, 'utf8');
            fs.writeFileSync(filePath, insertPhoto(src, JSON.parse(body)));
            send(200, { ok: true });
          } catch (err) {
            send(400, { ok: false, error: err.message });
          }
        });
      });
    },
  };
}
