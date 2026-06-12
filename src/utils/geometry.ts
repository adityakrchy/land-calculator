export interface Point {
  x: number;
  y: number;
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface Side {
  start: string;
  end: string;
  length: number;
}

export interface Polygon {
  vertices: Vertex[];
  sides: Side[];
}

export interface GeometryResult {
  vertices: Vertex[];
  area: number;
  perimeter: number;
  angles: number[];
}

/**
 * Gets alphabetical vertex name (A, B, C, ..., Z) for a given index (0-indexed).
 */
export function getVertexLabel(index: number): string {
  return String.fromCharCode(65 + index); // 65 is 'A'
}

/**
 * Validates whether the side lengths can form a closed polygon.
 * For any polygon, the length of the longest side must be strictly less than the sum of all other sides.
 */
export function validatePolygonSides(sides: number[]): boolean {
  if (sides.length < 3) return false;
  const totalSum = sides.reduce((acc, s) => acc + s, 0);
  for (const s of sides) {
    if (s <= 0 || isNaN(s)) return false;
    // Longest side must be < sum of remaining sides
    if (s >= totalSum - s) {
      return false;
    }
  }
  return true;
}

/**
 * Generates exact triangle vertices using the Law of Cosines.
 * A is placed at (0, 0), B is placed at (c, 0), and C is calculated.
 * Where:
 * AB = c (side 0)
 * BC = a (side 1)
 * CA = b (side 2)
 */
export function generateTriangle(c: number, a: number, b: number): Point[] {
  // Angle A (opposite to side BC = a)
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  const pA: Point = { x: 0, y: 0 };
  const pB: Point = { x: c, y: 0 };
  const pC: Point = { x: b * cosA, y: b * sinA };

  return [pA, pB, pC];
}

/**
 * Generates coordinates for a polygon with N >= 4 sides.
 * Distributes vertices around a centroid and runs a numerical relaxation algorithm
 * to adjust radii so that side lengths approximate user-specified lengths.
 */
export function generatePolygon(sides: number[]): Point[] {
  const N = sides.length;
  if (N === 3) {
    return generateTriangle(sides[0], sides[1], sides[2]);
  }

  // For N=4 with alternating side pairs (e.g. [a, b, a, b]), generate exact rectangle coordinates
  // This avoids numerical drift in the relaxation that produces non-90° angles.
  if (N === 4 && sides[0] === sides[2] && sides[1] === sides[3]) {
    const a = sides[0];
    const b = sides[1];
    // Centered rectangle: vertices at (±a/2, ±b/2)
    const rectPoints: Point[] = [
      { x: -a / 2, y: -b / 2 },
      { x: a / 2, y: -b / 2 },
      { x: a / 2, y: b / 2 },
      { x: -a / 2, y: b / 2 },
    ];
    return rectPoints;
  }

  const thetaStep = (2 * Math.PI) / N;
  const perimeter = sides.reduce((acc, s) => acc + s, 0);

  // Initial estimate for radius based on regular polygon perimeter
  const initialR = perimeter / (2 * N * Math.sin(Math.PI / N));

  // Initialize vertices on a regular polygon
  const points: Point[] = Array.from({ length: N }, (_, i) => ({
    x: initialR * Math.cos(i * thetaStep),
    y: initialR * Math.sin(i * thetaStep),
  }));

  // Coordinate-based edge relaxation (Gauss-Seidel method)
  // Use decreasing learning rate for better convergence
  for (let iter = 0; iter < 2000; iter++) {
    const learningRate = 0.5 * Math.max(0.01, 1 - iter / 1500);
    for (let i = 0; i < N; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % N];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = sides[i];

      const diff = dist - target;

      // Push/pull vertices along the edge vector to satisfy the length constraint
      const offsetX = (diff * dx) / dist * learningRate;
      const offsetY = (diff * dy) / dist * learningRate;

      points[i].x += offsetX;
      points[i].y += offsetY;
      points[(i + 1) % N].x -= offsetX;
      points[(i + 1) % N].y -= offsetY;
    }
  }

  // Rotate the polygon so that the first edge (P0 -> P1) is perfectly horizontal
  const pt0 = points[0];
  const pt1 = points[1];
  const angle = Math.atan2(pt1.y - pt0.y, pt1.x - pt0.x);
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  const rotatedPoints = points.map(p => ({
    x: p.x * cosA - p.y * sinA,
    y: p.x * sinA + p.y * cosA,
  }));

  // Center the coordinates around (0, 0)
  const cx = rotatedPoints.reduce((sum, p) => sum + p.x, 0) / N;
  const cy = rotatedPoints.reduce((sum, p) => sum + p.y, 0) / N;
  
  return rotatedPoints.map(p => ({
    x: p.x - cx,
    y: p.y - cy
  }));
}

/**
 * Calculates area of polygon using Heron's formula for triangle, Shoelace for N >= 4.
 */
export function calculateArea(points: Point[], sides: number[]): number {
  const N = points.length;
  if (N === 3) {
    // Heron's Formula
    const [a, b, c] = sides;
    const s = (a + b + c) / 2;
    const val = s * (s - a) * (s - b) * (s - c);
    return Math.sqrt(Math.max(0, val));
  }

  // Shoelace Formula
  let areaSum = 0;
  for (let i = 0; i < N; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % N];
    areaSum += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(areaSum) / 2;
}

/**
 * Computes interior angles in degrees for each vertex.
 */
export function calculateInteriorAngles(points: Point[]): number[] {
  const N = points.length;
  const angles: number[] = [];

  for (let i = 0; i < N; i++) {
    const pCurrent = points[i];
    const pPrev = points[(i - 1 + N) % N];
    const pNext = points[(i + 1) % N];

    // Vector A: Current -> Prev
    const vAx = pPrev.x - pCurrent.x;
    const vAy = pPrev.y - pCurrent.y;

    // Vector B: Current -> Next
    const vBx = pNext.x - pCurrent.x;
    const vBy = pNext.y - pCurrent.y;

    const lenA = Math.sqrt(vAx * vAx + vAy * vAy) || 1;
    const lenB = Math.sqrt(vBx * vBx + vBy * vBy) || 1;

    // Dot product
    const dot = vAx * vBx + vAy * vBy;
    const cosVal = Math.min(1, Math.max(-1, dot / (lenA * lenB)));
    
    // Interior angle in degrees
    const angleRad = Math.acos(cosVal);
    const angleDeg = angleRad * (180 / Math.PI);
    angles.push(angleDeg);
  }

  return angles;
}
