/**
 * Geometry for hand-authored architecture diagrams. A diagram is two layouts —
 * `wide` for desktop and `narrow` for phones — each a list of boxes and the
 * edges between them, in viewBox units. Edges are routed orthogonally between
 * box sides; `via` overrides the route when the default would cross a box.
 *
 * Labels use the mono font, so their width is predictable: `prepare` throws at
 * build time when a label would overflow its box instead of letting it clip.
 */
export type Point = [number, number];
export type Side = 'l' | 'r' | 't' | 'b';
/** service: a running process · store: data at rest · actor: a person or their browser · ai: a model · gate: a human approval point. */
export type Kind = 'service' | 'store' | 'actor' | 'ai' | 'gate';

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string[];
  kind?: Kind;
  /** Drawn dashed: present but opt-in. */
  optional?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  fromSide?: Side;
  toSide?: Side;
  /** Shift the anchor along its side, from the side's midpoint. */
  fromOff?: number;
  toOff?: number;
  /** Explicit corner points between the two anchors. */
  via?: Point[];
  label?: string;
  labelAt?: Point;
  /** The main data path: lime, and animated unless motion is reduced. */
  flow?: boolean;
  /** Arrowheads at both ends. */
  both?: boolean;
  optional?: boolean;
  /** A fallback path that is not taken: steel, never animated, its own dash. Needs a label; never also `flow`. */
  rollback?: boolean;
}

export interface DiagramGroup {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface Layout {
  w: number;
  h: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
}

export const LABEL_SIZE = 13;
export const SUB_SIZE = 11;
export const EDGE_SIZE = 10.5;
/** JetBrains Mono advance width, in em. */
const CH = 0.6;
const PAD = 8;
const LABEL_LINE = 17;
const SUB_LINE = 14;

function anchor(n: DiagramNode, side: Side, off = 0): Point {
  switch (side) {
    case 'l':
      return [n.x, n.y + n.h / 2 + off];
    case 'r':
      return [n.x + n.w, n.y + n.h / 2 + off];
    case 't':
      return [n.x + n.w / 2 + off, n.y];
    case 'b':
      return [n.x + n.w / 2 + off, n.y + n.h];
  }
}

function defaultSides(a: DiagramNode, b: DiagramNode): [Side, Side] {
  if (b.x >= a.x + a.w) return ['r', 'l'];
  if (b.x + b.w <= a.x) return ['l', 'r'];
  if (b.y >= a.y + a.h) return ['b', 't'];
  return ['t', 'b'];
}

const horizontal = (s: Side) => s === 'l' || s === 'r';

function route(a: Point, sa: Side, b: Point, sb: Side): Point[] {
  if (horizontal(sa) && horizontal(sb)) {
    if (a[1] === b[1]) return [a, b];
    const mx = (a[0] + b[0]) / 2;
    return [a, [mx, a[1]], [mx, b[1]], b];
  }
  if (!horizontal(sa) && !horizontal(sb)) {
    if (a[0] === b[0]) return [a, b];
    const my = (a[1] + b[1]) / 2;
    return [a, [a[0], my], [b[0], my], b];
  }
  return horizontal(sa) ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
}

export interface TextLine {
  x: number;
  y: number;
  text: string;
  sub: boolean;
}

export interface PreparedNode extends DiagramNode {
  lines: TextLine[];
}

export interface PreparedEdge extends DiagramEdge {
  d: string;
  labelX?: number;
  labelY?: number;
  labelAnchor?: 'start' | 'middle';
}

function textWidth(text: string, size: number) {
  return text.length * size * CH;
}

export function prepare(layout: Layout, where: string) {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  const nodes: PreparedNode[] = layout.nodes.map((n) => {
    const sub = n.sub ?? [];
    for (const [text, size] of [[n.label, LABEL_SIZE], ...sub.map((s) => [s, SUB_SIZE])] as [string, number][]) {
      if (textWidth(text, size) > n.w - 2 * PAD) throw new Error(`${where}: "${text}" overflows node ${n.id}`);
    }
    const block = LABEL_LINE + sub.length * SUB_LINE;
    if (block > n.h - PAD) throw new Error(`${where}: node ${n.id} is too short for its text`);
    const top = n.y + n.h / 2 - block / 2;
    const cx = n.x + n.w / 2;
    return {
      ...n,
      lines: [
        { x: cx, y: top + LABEL_LINE / 2, text: n.label, sub: false },
        ...sub.map((text, i) => ({ x: cx, y: top + LABEL_LINE + SUB_LINE * i + SUB_LINE / 2, text, sub: true })),
      ],
    };
  });

  for (const g of layout.groups ?? []) {
    // Group labels are uppercase with 0.12em letter-spacing (see Diagram.astro).
    const width = g.label.length * EDGE_SIZE * (CH + 0.12);
    if (width > g.w - 24) throw new Error(`${where}: group label "${g.label}" overflows its group`);
  }

  const edges: PreparedEdge[] = layout.edges.map((e) => {
    if (e.rollback && e.flow) throw new Error(`${where}: edge ${e.from} -> ${e.to} is both rollback and flow`);
    if (e.rollback && !e.label) throw new Error(`${where}: rollback edge ${e.from} -> ${e.to} needs a label`);
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) throw new Error(`${where}: edge ${e.from} -> ${e.to} names an unknown node`);
    const [ds, dt] = defaultSides(a, b);
    const sa = e.fromSide ?? ds;
    const sb = e.toSide ?? dt;
    const p = anchor(a, sa, e.fromOff);
    const q = anchor(b, sb, e.toOff);
    const pts = e.via ? [p, ...e.via, q] : route(p, sa, q, sb);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

    if (!e.label) return { ...e, d };
    if (e.labelAt) return { ...e, d, labelX: e.labelAt[0], labelY: e.labelAt[1], labelAnchor: 'middle' };
    // Default label spot: the middle of the longest segment.
    let best = 0;
    let len = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
      if (l > len) [best, len] = [i, l];
    }
    const [x1, y1] = pts[best];
    const [x2, y2] = pts[best + 1];
    if (y1 === y2) return { ...e, d, labelX: (x1 + x2) / 2, labelY: y1 - 10, labelAnchor: 'middle' };
    return { ...e, d, labelX: x1 + 7, labelY: (y1 + y2) / 2, labelAnchor: 'start' };
  });

  for (const e of edges) {
    if (!e.label || e.labelX === undefined || e.labelY === undefined) continue;
    const width = textWidth(e.label, EDGE_SIZE);
    const x0 = e.labelAnchor === 'start' ? e.labelX : e.labelX - width / 2;
    const box = { x0, x1: x0 + width, y0: e.labelY - EDGE_SIZE / 2, y1: e.labelY + EDGE_SIZE / 2 };
    if (box.x0 < 0 || box.x1 > layout.w || box.y0 < 0 || box.y1 > layout.h) {
      throw new Error(`${where}: edge label "${e.label}" falls outside the drawing`);
    }
    const hit = layout.nodes.find((n) => box.x0 < n.x + n.w && box.x1 > n.x && box.y0 < n.y + n.h && box.y1 > n.y);
    if (hit) throw new Error(`${where}: edge label "${e.label}" overlaps node ${hit.id}`);
  }

  return { nodes, edges, groups: layout.groups ?? [] };
}
