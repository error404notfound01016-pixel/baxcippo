import React, { useState, useEffect, useMemo, useCallback, useRef, memo, lazy, Suspense } from 'react';
import './App.css';
import PHOTOS from './photos';
import CATEGORIES from './categories';

// Panel oculto (#admin): solo existe en desarrollo, no se incluye en producción
const Admin = import.meta.env.DEV ? lazy(() => import('./Admin')) : null;

const SWIPE_THRESHOLD = 50;
const BATCH_SIZE = 12; // fotos que se agregan cada vez que se llega al final

// Tarjeta con esqueleto de carga y aparición suave de la imagen
const PhotoCard = memo(function PhotoCard({ photo, index, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button className="photo-card" onClick={() => onOpen(index)} aria-label={`Abrir ${photo.title}`}>
      <span className={`thumb-wrap ${loaded ? 'loaded' : ''}`}>
        <img
          src={photo.thumb}
          alt={photo.title}
          className="thumbnail-completa"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </span>
      <span className="photo-title">{photo.title}</span>
    </button>
  );
});

// Índice al azar distinto del actual (para que "otra" nunca repita la misma foto)
// Mezcla una copia del arreglo (Fisher-Yates)
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickRandomIndex = (current) => {
  if (PHOTOS.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * PHOTOS.length); } while (i === current);
  return i;
};

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
  } catch (_) { /* almacenamiento no disponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState('todas');
  const [shuffled, setShuffled] = useState(false); // false = orden original de photos.js
  const [shuffleKey, setShuffleKey] = useState(0); // cambia con cada pulsación de "Mezclar"
  const [modalIndex, setModalIndex] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [showAdmin, setShowAdmin] = useState(() => window.location.hash === '#admin');
  const [darkMode, setDarkMode] = useState(getInitialTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);
  const touchStartX = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    const onHash = () => setShowAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Tema: se aplica en <html>, se guarda y respeta la preferencia del sistema
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('theme', darkMode ? 'dark' : 'light'); } catch (_) {}
  }, [darkMode]);

  // Conteos y fotos filtradas: se calculan una sola vez por cambio
  const counts = useMemo(() => {
    const c = { todas: PHOTOS.length };
    PHOTOS.forEach(p => { c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, []);

  const filteredPhotos = useMemo(
    () => {
      const base = activeCategory === 'todas' ? PHOTOS : PHOTOS.filter(p => p.category === activeCategory);
      return shuffled ? shuffle(base) : base;
    },
    // shuffleKey fuerza un nuevo orden al pulsar "Mezclar"; sin él, el orden se mantiene estable
    // (necesario para que el visor y el scroll infinito no se desordenen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCategory, shuffled, shuffleKey]
  );

  const total = filteredPhotos.length;
  const hasMore = visibleCount < total;
  const visiblePhotos = useMemo(() => filteredPhotos.slice(0, visibleCount), [filteredPhotos, visibleCount]);

  // Al cambiar de categoría se reinicia la carga progresiva
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [activeCategory, shuffled, shuffleKey]);

  // Al acercarse al final de la lista se cargan más fotos
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(c => c + BATCH_SIZE); },
      { rootMargin: '400px 0px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);
  // En modo aleatorio el visor trabaja sobre todas las fotos, sin importar la categoría activa
  const viewerList = randomMode ? PHOTOS : filteredPhotos;
  const selectedPhoto = modalIndex !== null ? viewerList[modalIndex] : null;
  const activeLabel = CATEGORIES.find(c => c.id === activeCategory)?.label;

  const openModal = useCallback((index) => { setRandomMode(false); setModalIndex(index); setIsZoomed(false); }, []);
  const openRandom = useCallback(() => { setRandomMode(true); setModalIndex(pickRandomIndex(null)); setIsZoomed(false); }, []);
  const closeModal = useCallback(() => { setModalIndex(null); setIsZoomed(false); setRandomMode(false); }, []);
  // En modo aleatorio, "siguiente/anterior" (botones, flechas y deslizar) muestran otra foto al azar
  const navigateModal = useCallback((dir) => {
    setIsZoomed(false);
    setModalIndex(prev => {
      if (prev === null) return prev;
      return randomMode ? pickRandomIndex(prev) : (prev + dir + total) % total;
    });
  }, [total, randomMode]);

  const handleCategoryClick = (cat) => {
    if (cat.random) return openRandom();
    setActiveCategory(cat.id);
    setShuffled(false); // al entrar a una categoría siempre arranca en orden normal
    window.scrollTo({ top: 0 });
  };

  const handleShuffle = () => {
    setShuffled(true);
    setShuffleKey(k => k + 1);
    window.scrollTo({ top: 0 });
  };

  // Teclado: el listener solo existe mientras el visor está abierto
  useEffect(() => {
    if (modalIndex === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') navigateModal(-1);
      else if (e.key === 'ArrowRight') navigateModal(1);
      else if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalIndex === null, navigateModal, closeModal]);

  // Bloquea el scroll de fondo y enfoca el botón de cerrar al abrir el visor
  useEffect(() => {
    if (modalIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [modalIndex === null]);

  // Precarga la foto anterior y la siguiente para navegar sin esperas
  useEffect(() => {
    if (modalIndex === null || randomMode || total < 2) return;
    [1, -1].forEach(d => {
      const img = new Image();
      img.src = filteredPhotos[(modalIndex + d + total) % total].url;
    });
  }, [modalIndex, filteredPhotos, total, randomMode]);

  // Gestos táctiles: deslizar para cambiar de foto (solo sin zoom)
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null || isZoomed) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) navigateModal(dx > 0 ? -1 : 1);
  };

  if (Admin && showAdmin) {
    return <Suspense fallback={null}><Admin /></Suspense>;
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Galería</h2>
          <button
            className="collapse-btn"
            onClick={() => setIsSidebarCollapsed(v => !v)}
            aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Plegar menú'}
            aria-expanded={!isSidebarCollapsed}
          >
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
        </div>

        <nav className="sidebar-top" aria-label="Categorías">
          <ul className="category-list">
            {CATEGORIES.map(cat => (
              <li key={cat.id}>
                <button
                  className={`category-btn ${!cat.random && activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat)}
                  aria-current={!cat.random && activeCategory === cat.id ? 'true' : undefined}
                  title={cat.label}
                >
                  <span className="cat-icon" aria-hidden="true">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                  {!cat.random && <span className="category-count">{counts[cat.id] || 0}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <button
          className="theme-toggle-btn"
          onClick={() => setDarkMode(v => !v)}
          aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={darkMode ? 'Modo claro' : 'Modo oscuro'}
        >
          <span aria-hidden="true">{darkMode ? '☀️' : '🌙'}</span>
          <span className="btn-label">{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="header-section">
          <div>
            <h1 className="header-title">
              {activeCategory === 'todas' ? 'Todas las fotos' : activeLabel}
            </h1>
            <p className="header-desc">
              {total} {total === 1 ? 'foto' : 'fotos'} · Toca una miniatura para verla en grande.
            </p>
          </div>
          {total > 1 && (
            <button
              className="order-btn"
              onClick={handleShuffle}
            >
              🔀 Mezclar
            </button>
          )}
        </header>

        <div className="gallery-grid">
          {visiblePhotos.map((photo, index) => (
            <PhotoCard key={photo.id} photo={photo} index={index} onOpen={openModal} />
          ))}
        </div>

        {hasMore && <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />}
      </main>

      {selectedPhoto && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={selectedPhoto.title}
          onClick={closeModal}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button ref={closeBtnRef} className="close-btn" onClick={closeModal} aria-label="Cerrar (Esc)">
            &times;
          </button>

          {(randomMode ? PHOTOS.length : total) > 1 && (
            <>
              <button
                className="nav-btn prev"
                onClick={(e) => { e.stopPropagation(); navigateModal(-1); }}
                aria-label={randomMode ? 'Otra al azar' : 'Anterior'}
              >
                &#10094;
              </button>
              <button
                className="nav-btn next"
                onClick={(e) => { e.stopPropagation(); navigateModal(1); }}
                aria-label={randomMode ? 'Otra al azar' : 'Siguiente'}
              >
                &#10095;
              </button>
            </>
          )}

          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.title}
            decoding="async"
            className={`modal-content ${isZoomed ? 'zoomed' : ''}`}
            onClick={(e) => { e.stopPropagation(); setIsZoomed(v => !v); }}
          />

          <div className="modal-caption" onClick={(e) => e.stopPropagation()}>
            {randomMode ? `🎲 ${selectedPhoto.title}` : `${selectedPhoto.title} · ${modalIndex + 1}/${total}`}
          </div>
        </div>
      )}
    </div>
  );
}
