import { create } from 'zustand';
import {
  Vertex,
  Side,
  getVertexLabel,
  validatePolygonSides,
  generatePolygon,
  calculateArea,
  calculateInteriorAngles,
} from '@/utils/geometry';

interface PolygonState {
  sideCount: number;
  sideLengths: Record<string, string>; // e.g. { "AB": "10", "BC": "10", "CA": "10" }
  vertices: Vertex[];
  sides: Side[];
  area: number;
  perimeter: number;
  angles: number[];
  isValid: boolean;
  hasCalculated: boolean;
  error: string | null;

  setSideCount: (count: number) => void;
  updateSideLength: (key: string, value: string) => void;
  generateGeometry: () => void;
  reset: () => void;
}

const getSideKey = (i: number, count: number): string => {
  const startLabel = getVertexLabel(i);
  const endLabel = getVertexLabel((i + 1) % count);
  return `${startLabel}${endLabel}`;
};

const getInitialSideLengths = (count: number): Record<string, string> => {
  const lengths: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const key = getSideKey(i, count);
    lengths[key] = '10'; // default value
  }
  return lengths;
};

export const usePolygonStore = create<PolygonState>((set, get) => ({
  sideCount: 3,
  sideLengths: getInitialSideLengths(3),
  vertices: [],
  sides: [],
  area: 0,
  perimeter: 0,
  angles: [],
  isValid: false,
  hasCalculated: false,
  error: null,

  setSideCount: (count: number) => {
    const clampedCount = Math.max(3, Math.min(20, count));
    const currentLengths = get().sideLengths;
    const nextLengths: Record<string, string> = {};

    for (let i = 0; i < clampedCount; i++) {
      const key = getSideKey(i, clampedCount);
      // Keep existing value if available, otherwise default to "10"
      nextLengths[key] = currentLengths[key] || '10';
    }

    set({
      sideCount: clampedCount,
      sideLengths: nextLengths,
      vertices: [],
      sides: [],
      area: 0,
      perimeter: 0,
      angles: [],
      isValid: false,
      hasCalculated: false,
      error: null,
    });
  },

  updateSideLength: (key: string, value: string) => {
    // Only allow numeric values and decimal points
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    const formattedValue = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanValue;

    set((state) => ({
      sideLengths: {
        ...state.sideLengths,
        [key]: formattedValue,
      },
      hasCalculated: false, // Reset calculation state when inputs change
    }));
  },

  generateGeometry: () => {
    const { sideCount, sideLengths } = get();
    
    // Parse side lengths
    const parsedLengths: number[] = [];
    const sidesList: Side[] = [];

    for (let i = 0; i < sideCount; i++) {
      const key = getSideKey(i, sideCount);
      const valStr = sideLengths[key];
      const val = parseFloat(valStr);

      if (isNaN(val) || val <= 0) {
        set({
          error: `Please enter a valid positive length for side ${key}.`,
          isValid: false,
          hasCalculated: true,
        });
        return;
      }

      parsedLengths.push(val);
      sidesList.push({
        start: getVertexLabel(i),
        end: getVertexLabel((i + 1) % sideCount),
        length: val,
      });
    }

    // Validate geometry constraints
    const isValidConfig = validatePolygonSides(parsedLengths);
    if (!isValidConfig) {
      set({
        error: sideCount === 3
          ? 'Invalid Triangle: The sum of any two sides must be greater than the third side.'
          : 'Invalid Polygon: The length of the longest side must be less than the sum of all other sides.',
        isValid: false,
        hasCalculated: true,
      });
      return;
    }

    try {
      // Calculate geometry
      const points = generatePolygon(parsedLengths);
      const vertices: Vertex[] = points.map((p, idx) => ({
        id: getVertexLabel(idx),
        x: p.x,
        y: p.y,
      }));

      const area = calculateArea(points, parsedLengths);
      const perimeter = parsedLengths.reduce((acc, s) => acc + s, 0);
      const angles = calculateInteriorAngles(points);

      set({
        vertices,
        sides: sidesList,
        area,
        perimeter,
        angles,
        isValid: true,
        hasCalculated: true,
        error: null,
      });
    } catch {
      set({
        error: 'An error occurred during coordinate generation.',
        isValid: false,
        hasCalculated: true,
      });
    }
  },

  reset: () => {
    set({
      sideCount: 3,
      sideLengths: getInitialSideLengths(3),
      vertices: [],
      sides: [],
      area: 0,
      perimeter: 0,
      angles: [],
      isValid: false,
      hasCalculated: false,
      error: null,
    });
  },
}));
