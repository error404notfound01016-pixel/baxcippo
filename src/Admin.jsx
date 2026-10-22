import React, { useState, useMemo } from 'react';
import PHOTOS, { toUrl } from './photos';
import CATEGORIES from './categories';

const NEW = '__new__';

export default function Admin() {
  const categories = CATEGORIES.filter(c => !c.random && c.id !== 'todas');
  const [links, setLinks] = useState('');
  const [category, setCategory] = useState(categories[0]?.id ?? NEW);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  const list = useMemo(() => [...new Set(links.split(/\s+/).filter(Boolean))], [links]);
  const target = category === NEW ? newCategory.trim() : category;
  const canSubmit = !busy && list.length > 0 && target.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const out = [];
    // Una a una, para no pisar la escritura del archivo
    for (const url of list) {
      try {
        const res = await fetch('/__admin/add-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, category: target }),
        });
        const data = await res.json().catch(() => ({}));
        out.push({
          url,
          ok: res.ok && data.ok,
          msg: data.error || (res.ok ? '' : `Error ${res.status}. ¿Agregaste el plugin en vite.config.js?`),
        });
      } catch {
        out.push({ url, ok: false, msg: 'No hay conexión con el servidor de desarrollo.' });
      }
    }
    setResults(out);
    // Deja en la caja solo las que fallaron, para reintentar
    setLinks(out.filter(r => !r.ok).map(r => r.url).join('\n'));
    if (category === NEW && out.some(r => r.ok)) setNewCategory('');
    setBusy(false);
  };

  return (
    <div className="admin">
      <a className="admin-back" href="#" onClick={() => { window.location.hash = ''; }}>
        ← Volver a la galería
      </a>
      <h1 className="header-title">Agregar fotos</h1>
      <p className="header-desc">Ahora hay {PHOTOS.length} fotos. Los cambios se guardan en photos.js.</p>

      <form className="admin-form" onSubmit={submit}>
        <label className="admin-field">
          <span>Enlaces (uno por línea)</span>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={5}
            placeholder="https://i.ibb.co/xxxx/foto.jpg"
            autoFocus
          />
        </label>

        {list.length > 0 && (
          <div className="admin-previews" aria-label="Vista previa">
            {list.slice(0, 8).map(u => <img key={u} src={toUrl(u)} alt="" loading="lazy" />)}
            {list.length > 8 && <span className="admin-more">+{list.length - 8}</span>}
          </div>
        )}

        <label className="admin-field">
          <span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value={NEW}>＋ Nueva categoría…</option>
          </select>
        </label>

        {category === NEW && (
          <label className="admin-field">
            <span>Nombre de la nueva categoría</span>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ej: Ana M" />
          </label>
        )}

        <button className="admin-submit" type="submit" disabled={!canSubmit}>
          {busy ? 'Agregando…' : `Agregar ${list.length > 1 ? `${list.length} fotos` : 'foto'}`}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="admin-results" aria-live="polite">
          {results.map(r => (
            <li key={r.url} className={r.ok ? 'ok' : 'error'}>
              {r.ok ? '✔ Agregada' : `✖ ${r.msg}`} · <span>{r.url}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
