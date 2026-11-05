/** Ship paint jobs for the hangar (title screen). */
export interface Paint {
  id: string;
  name: string;
  hull: number;
  accent: number;
  glass: number;
  flame: number;
}

export const PAINTS: Paint[] = [
  { id: 'arctic', name: 'Arctic', hull: 0xe6edf5, accent: 0x2f7dff, glass: 0x4fd8ff, flame: 0x6fe0ff },
  { id: 'crimson', name: 'Crimson', hull: 0xd8343f, accent: 0xffc83a, glass: 0xffd27a, flame: 0xffa040 },
  { id: 'jungle', name: 'Jungle', hull: 0x3fae5a, accent: 0xff8a3d, glass: 0xc8ff7a, flame: 0x9aff6a },
  { id: 'midnight', name: 'Midnight', hull: 0x34386a, accent: 0x5ff6ff, glass: 0xc08bff, flame: 0xb36bff },
  { id: 'golden', name: 'Golden', hull: 0xe8b23a, accent: 0x2a3340, glass: 0xfff1a0, flame: 0xffe07a },
  { id: 'candy', name: 'Candy', hull: 0xff8fd0, accent: 0xffffff, glass: 0x8ff6ff, flame: 0xff9af0 },
];

export const PAINT_BY_ID: Record<string, Paint> = Object.fromEntries(PAINTS.map((p) => [p.id, p]));
