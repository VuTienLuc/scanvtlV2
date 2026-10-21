import { describe, it, expect } from 'vitest';
import {
  distance,
  orderCorners,
  getDefaultCorners,
  getPerspectiveHomography,
  splitBookPages
} from '../src/services/cvService';
import type { Point } from '../src/types/scanner';

describe('cvService - Geometric & Computer Vision Calculations', () => {
  it('calculates Euclidean distance accurately', () => {
    const p1: Point = { x: 0, y: 0 };
    const p2: Point = { x: 3, y: 4 };
    expect(distance(p1, p2)).toBe(5);
  });

  it('orders arbitrary unordered quad corners correctly', () => {
    // Arbitrary order of points forming a rectangle
    const rawPoints: Point[] = [
      { x: 100, y: 200 }, // bottomRight
      { x: 10, y: 20 },   // topLeft
      { x: 100, y: 20 },  // topRight
      { x: 10, y: 200 }   // bottomLeft
    ];

    const ordered = orderCorners(rawPoints);
    expect(ordered.topLeft).toEqual({ x: 10, y: 20 });
    expect(ordered.topRight).toEqual({ x: 100, y: 20 });
    expect(ordered.bottomRight).toEqual({ x: 100, y: 200 });
    expect(ordered.bottomLeft).toEqual({ x: 10, y: 200 });
  });

  it('computes default centered document corners', () => {
    const corners = getDefaultCorners(1000, 1400, 0.1);
    expect(corners.topLeft).toEqual({ x: 100, y: 140 });
    expect(corners.topRight).toEqual({ x: 900, y: 140 });
    expect(corners.bottomRight).toEqual({ x: 900, y: 1260 });
    expect(corners.bottomLeft).toEqual({ x: 100, y: 1260 });
  });

  it('computes perspective homography 3x3 matrix', () => {
    const src = [0, 0, 100, 0, 100, 100, 0, 100];
    const dst = [0, 0, 100, 0, 100, 100, 0, 100]; // Identity
    const H = getPerspectiveHomography(src, dst);
    expect(H).toHaveLength(9);
    // For identity, H[0] ~ 1, H[4] ~ 1, H[8] ~ 1, off-diagonals ~ 0
    expect(Math.abs(H[0] - 1)).toBeLessThan(0.01);
    expect(Math.abs(H[4] - 1)).toBeLessThan(0.01);
    expect(Math.abs(H[8] - 1)).toBeLessThan(0.01);
  });

  it('splits book pages according to spine ratio', () => {
    // Mock HTMLCanvasElement in node/vitest environment
    const fakeCanvas = {
      width: 1000,
      height: 700,
      getContext: () => ({
        drawImage: () => {}
      })
    } as unknown as HTMLCanvasElement;

    // Split at 50%
    const { leftCanvas, rightCanvas } = splitBookPages(fakeCanvas, 0.5);
    expect(leftCanvas.width).toBe(500);
    expect(leftCanvas.height).toBe(700);
    expect(rightCanvas.width).toBe(500);
    expect(rightCanvas.height).toBe(700);

    // Split with offset spine 60%
    const split60 = splitBookPages(fakeCanvas, 0.6);
    expect(split60.leftCanvas.width).toBe(600);
    expect(split60.rightCanvas.width).toBe(400);
  });
});
