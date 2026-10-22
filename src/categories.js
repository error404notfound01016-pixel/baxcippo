import PHOTOS from './photos';

// Opcional: icono por categoría. Si no aparece aquí, usa el icono por defecto.
const ICONS = {
  'Chloe C': '🌿',
  'Pia B': '🌸',
  'Agus L': '🌸',
  'Bianca S': '🌸',
  'Ambar C': '🌸',
  'Prueba': '🌸',
};
const DEFAULT_ICON = '📁';

// Las categorías se generan solas a partir de photos.js (en el orden en que aparecen)
const fromPhotos = [...new Set(PHOTOS.map(p => p.category))].map(name => ({
  id: name,
  label: name,
  icon: ICONS[name] || DEFAULT_ICON,
}));

const CATEGORIES = [
  { id: 'todas', label: 'Todas', icon: '🖼️' },
  ...fromPhotos,
  // random: no filtra, abre una foto al azar en pantalla completa
  { id: 'random', label: 'Random', icon: '🎲', random: true },
];

export default CATEGORIES;