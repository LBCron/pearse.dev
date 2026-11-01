import type { Layout } from './layout';

/**
 * The East Coast Blinds diagram in both cutover states (#203). Before the cutover it draws
 * today's live path, Apache serving WordPress, with the Django proxy marked planned; after
 * it, the swapped vhost with WordPress reached only by the rollback edge. The state comes
 * from CUTOVER_DONE in src/lib/east-coast-blinds.ts. Names only what the case study's prose
 * names. Plain data with type-only imports so tests can load it directly.
 */
export interface EastCoastBlindsDiagram {
  title: string;
  desc: string;
  wide: Layout;
  narrow: Layout;
}

const planned = {
  title: 'East Coast Blinds, before the planned cutover',
  desc: "How the site is served today, and the cutover planned for it. A visitor reaches the server through Cloudflare. Today Apache's vhost serves WordPress, which is still the public site and has not been touched. Django and Wagtail run beside it on the same server, with the rebuilt public site and the back office on one database. The planned cutover is one Apache edit: the vhost becomes a reverse proxy in front of Django. Going back would be restoring the WordPress vhost and reloading Apache.",
  apache: ['WordPress vhost'],
  wordpress: ['public site today', 'untouched'],
  toWordpress: { flow: true, label: 'live today' },
  toDjango: { optional: true, label: 'planned proxy' },
};

const done = {
  title: 'East Coast Blinds cutover',
  desc: "How the cutover is set up. A visitor reaches the server through Cloudflare. After the swap, Apache's live vhost is a reverse proxy in front of Django and Wagtail, which serve the public site and the back office from one database. WordPress stays on the same server, on disk and untouched, but no live traffic reaches it. The only path to it is the rollback: putting the WordPress vhost back and reloading Apache.",
  apache: ['live vhost'],
  wordpress: ['on disk, untouched', 'kept warm'],
  toWordpress: { rollback: true, label: 'rollback' },
  toDjango: { flow: true, label: 'reverse proxy' },
};

export function eastCoastBlinds(cutoverDone: boolean): EastCoastBlindsDiagram {
  const s = cutoverDone ? done : planned;
  const wide: Layout = {
    w: 960,
    h: 330,
    groups: [{ x: 430, y: 20, w: 510, h: 290, label: 'Same server' }],
    nodes: [
      { id: 'visitor', x: 20, y: 60, w: 150, h: 58, kind: 'actor', label: 'Visitor', sub: ['browser'] },
      { id: 'cloudflare', x: 220, y: 60, w: 170, h: 58, label: 'Cloudflare' },
      { id: 'apache', x: 460, y: 60, w: 170, h: 58, label: 'Apache', sub: s.apache },
      { id: 'django', x: 740, y: 60, w: 180, h: 58, label: 'Django + Wagtail', sub: ['site + back office'] },
      { id: 'wordpress', x: 460, y: 200, w: 170, h: 58, label: 'WordPress', sub: s.wordpress },
      { id: 'db', x: 740, y: 200, w: 180, h: 58, kind: 'store', label: 'One database', sub: ['quotes to invoices'] },
    ],
    edges: [
      { from: 'visitor', to: 'cloudflare', flow: true },
      { from: 'cloudflare', to: 'apache', flow: true },
      { from: 'apache', to: 'django', ...s.toDjango },
      { from: 'django', to: 'db', both: true },
      { from: 'apache', to: 'wordpress', ...s.toWordpress },
    ],
  };
  const narrow: Layout = {
    w: 360,
    h: 412,
    groups: [{ x: 5, y: 92, w: 350, h: 310, label: 'Same server' }],
    nodes: [
      { id: 'visitor', x: 10, y: 10, w: 160, h: 50, kind: 'actor', label: 'Visitor', sub: ['browser'] },
      { id: 'cloudflare', x: 190, y: 10, w: 160, h: 50, label: 'Cloudflare' },
      { id: 'apache', x: 95, y: 110, w: 150, h: 58, label: 'Apache', sub: s.apache },
      { id: 'wordpress', x: 15, y: 230, w: 155, h: 58, label: 'WordPress', sub: s.wordpress },
      { id: 'django', x: 190, y: 230, w: 160, h: 58, label: 'Django + Wagtail', sub: ['site + back office'] },
      { id: 'db', x: 190, y: 330, w: 160, h: 58, kind: 'store', label: 'One database', sub: ['quotes to invoices'] },
    ],
    edges: [
      { from: 'visitor', to: 'cloudflare', flow: true },
      { from: 'cloudflare', to: 'apache', toOff: -25, flow: true },
      { from: 'apache', to: 'django', fromSide: 'r', toSide: 't', toOff: -15, ...s.toDjango },
      { from: 'django', to: 'db', both: true },
      { from: 'apache', to: 'wordpress', fromSide: 'l', toSide: 't', toOff: -10, ...s.toWordpress },
    ],
  };
  return { title: s.title, desc: s.desc, wide, narrow };
}
