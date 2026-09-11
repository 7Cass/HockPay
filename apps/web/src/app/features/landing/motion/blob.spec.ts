import { BLOB_POINTS, MOODS, blobPath, mixMood } from './blob';

describe('blobPath', () => {
  const ys = (d: string) =>
    (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, index) => index % 2 === 1);

  it('draws one closed curve with a segment per point', () => {
    const d = blobPath(MOODS.pending, 1.2, 100);

    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(BLOB_POINTS);
  });

  it('is the same shape for the same mood and time', () => {
    expect(blobPath(MOODS.failed, 3, 120)).toBe(blobPath(MOODS.failed, 3, 120));
  });

  it('droops: sag pushes the lowest point further down', () => {
    const upright = blobPath(MOODS.idle, 0, 100);
    const drooping = blobPath({ ...MOODS.idle, sag: 0.3 }, 0, 100);

    expect(Math.max(...ys(drooping))).toBeGreaterThan(Math.max(...ys(upright)) + 10);
  });

  it('leans toward a direction', () => {
    const still = blobPath(MOODS.confirmed, 0, 100);
    const down = blobPath(MOODS.confirmed, 0, 100, { angle: Math.PI / 2, amount: 1 });

    expect(Math.max(...ys(down))).toBeGreaterThan(Math.max(...ys(still)));
  });
});

describe('mixMood', () => {
  it('lands on each end', () => {
    expect(mixMood(MOODS.idle, MOODS.failed, 0)).toEqual(MOODS.idle);
    expect(mixMood(MOODS.idle, MOODS.failed, 1)).toEqual(MOODS.failed);
  });
});
