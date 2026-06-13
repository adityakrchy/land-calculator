# Geometric Figure Generation & Calculation Algorithms

## Overview

This application is a calculator for geometric figures, built as an Expo (React Native) app. It has two primary features, corresponding to two tabs:

1. **Area Finder** (`src/app/index.tsx`) — Select a shape (currently triangle) and enter dimensions to compute its area, interior angles, and unit conversions.
2. **Polygon Plotter** (`src/app/plot.tsx`) — Define an arbitrary polygon (3–20 sides) by specifying side lengths, then generate coordinate vertices, compute area/perimeter/angles, and render an interactive SVG diagram.

The core geometric logic lives in `src/utils/geometry.ts`, with state management in `src/store/use-polygon-store.ts` and canvas rendering in `src/components/polygon-canvas.tsx` and `src/components/shape-diagrams.tsx`.

---

## 1. Core Geometry Module (`src/utils/geometry.ts`)

### 1.1 Data Types

```typescript
interface Point     { x: number; y: number }
interface Vertex    { id: string; x: number; y: number }
interface Side      { start: string; end: string; length: number }
interface Polygon   { vertices: Vertex[]; sides: Side[] }
interface GeometryResult {
  vertices: Vertex[];
  area: number;
  perimeter: number;
  angles: number[];
}
```

- `Point` — raw coordinates in the model space.
- `Vertex` — a `Point` with an alphabetical label (`A`, `B`, `C`, ...).
- `Side` — an edge defined by its start/end vertex labels and length.
- `Polygon` — composite of vertices and sides from user input (before coordinate generation).
- `GeometryResult` — output after coordinate generation, including computed area/perimeter/angles.

### 1.2 Vertex Labeling (`getVertexLabel`)

Simple mapping from zero-based index to uppercase letter:

```typescript
getVertexLabel(index: number): string  // 0 → "A", 1 → "B", ..., 25 → "Z"
```

Uses `String.fromCharCode(65 + index)`. The cap at 20 sides (enforced by the UI) keeps labels within `A–T`.

### 1.3 Polygon Side Validation (`validatePolygonSides`)

**Algorithm:** Generalization of the triangle inequality theorem.

For any closed polygon with sides `s₁, s₂, ..., sₙ`:
- The longest side must be **strictly less than** the sum of all other sides.
- All sides must be positive, finite numbers.
- At least 3 sides are required.

```typescript
validatePolygonSides(sides: number[]): boolean
```

If this check fails, the side lengths cannot form a closed shape; the edges would either overlap or leave a gap.

For triangles, the conventional "sum of any two > third" is equivalent — the longest-side check is a stricter version of the same constraint.

### 1.4 Triangle Coordinate Generation (`generateTriangle`)

**Algorithm:** Law of Cosines (SSS case).

Given three side lengths `c` (AB), `a` (BC), `b` (CA), vertices are placed as:

```
A = (0, 0)
B = (c, 0)                             // along the positive x-axis
C = (b·cos(A), b·sin(A))               // where A is angle at vertex A
```

The angle at A is computed via the Law of Cosines:

```
cos(A) = (b² + c² - a²) / (2·b·c)
sin(A) = √(1 - cos²(A))
```

This produces a triangle in **standard position**: edge AB lies on the x-axis, vertex A at the origin, and vertex C in the upper half-plane. This deterministic placement ensures consistent rendering and angle computation.

### 1.5 General Polygon Coordinate Generation (`generatePolygon`)

**Algorithm:** Numerical relaxation (Gauss-Seidel-style) with initial regular-polygon estimate.

For N = 3, delegates to `generateTriangle`. For N ≥ 4, follows these steps:

#### Step 1 — Check for exact rectangle (N = 4)

If `sides[0] === sides[2]` and `sides[1] === sides[3]`, the polygon is a rectangle (parallel opposite sides). Exact coordinates are returned immediately, avoiding numerical drift:

```
A = (-a/2, -b/2)   B = (a/2, -b/2)
C = (a/2,  b/2)    D = (-a/2, b/2)
```

This centered rectangle replaces the relaxation output, guaranteeing exactly 90° interior angles.

#### Step 2 — Initial estimate (regular polygon)

A regular polygon with the same perimeter is used as the starting configuration:

```
R = P / (2N · sin(π/N))
```

Each vertex starts at angle `θᵢ = i · 2π/N` around the origin.

#### Step 3 — Edge relaxation (2000 iterations)

For each iteration, every edge is examined. The difference between the current edge length and the target is computed; vertices are pushed/pulled along the edge vector to reduce the error:

```
// For edge (i, i+1):
dist = ||Pᵢ₊₁ - Pᵢ||
diff = dist - target[i]

// Push vertices along the edge:
offset = (diff / dist) · learningRate
Pᵢ     += offset × edgeVector     // pull one end
Pᵢ₊₁   -= offset × edgeVector     // push the other
```

A **decreasing learning rate** schedules convergence:

```
learningRate = 0.5 · max(0.01, 1 - iteration/1500)
```

This starts with aggressive adjustments and settles into fine-tuning, preventing oscillation.

#### Step 4 — Alignment (rotate to horizontal)

After relaxation, the polygon is rotated so that the **first edge** (P₀ → P₁) is perfectly horizontal. The rotation angle is:

```
θ = atan2(P₁.y - P₀.y, P₁.x - P₀.x)
```

Each vertex is rotated by `-θ` around the origin.

#### Step 5 — Centering

The centroid is computed and subtracted from all vertices, centering the polygon at the origin.

### 1.6 Area Calculation (`calculateArea`)

Two strategies, selected by vertex count:

#### Triangle — Heron's Formula

```
s = (a + b + c) / 2
Area = √(s · (s-a) · (s-b) · (s-c))
```

Uses side lengths directly, so it works even before coordinate generation.

#### N ≥ 4 — Shoelace Formula (Gauss's area formula)

```
Area = ½ · | Σᵢ (xᵢ · yᵢ₊₁ - xᵢ₊₁ · yᵢ) |
```

Works with the generated coordinates. Handles convex and concave polygons alike.

### 1.7 Interior Angle Calculation (`calculateInteriorAngles`)

**Algorithm:** Dot product of adjacent edge vectors at each vertex.

For each vertex `Pᵢ`, the two incident edge vectors are:

```
v_prev = Pᵢ₋₁ - Pᵢ    (vector from Pᵢ to previous vertex)
v_next = Pᵢ₊₁ - Pᵢ    (vector from Pᵢ to next vertex)
```

The interior angle at `Pᵢ`:

```
cos(θ) = (v_prev · v_next) / (||v_prev|| · ||v_next||)
θ_deg  = arccos(clamp(cos(θ), -1, 1)) · 180/π
```

The result is clamped to `[-1, 1]` before `acos` to guard against floating-point overshoot.

---

## 2. Triangle Solver (`src/app/index.tsx` — `solveTriangleParams`)

### 2.1 Purpose

The Area Finder tab allows users to enter **any combination** of sides and angles for a triangle (e.g., two sides and an included angle, or two angles and a side). The solver determines all six parameters (three sides + three angles) from the known inputs.

### 2.2 Algorithm: Iterative Law of Cosines / Law of Sines

The solver runs up to 4 iterations, applying three rules:

1. **Angle sum:** If two angles are known, compute the third: `C = 180° - A - B`.
2. **Law of Cosines** (for missing sides):
   - `a² = b² + c² - 2bc·cos(A)`
3. **Law of Sines** (if a common circumdiameter `R` can be derived):
   - `R = a / sin(A)` for any known side-angle pair.
   - Missing sides: `a = R · sin(A)`.
   - Missing angles: `A = arcsin(a / R)`.

### 2.3 Validation

After solving, the triangle is validated against:
- All sides > 0, all angles > 0.
- `A + B + C ≈ 180°` (within 0.1° tolerance).
- Triangle inequality (three checks).

If validation fails, all values are set to `NaN`.

---

## 3. State Management (`src/store/use-polygon-store.ts`)

Uses **Zustand** to manage Polygon Plotter state:

| State | Description |
|---|---|
| `sideCount` | Number of polygon sides (3–20) |
| `sideLengths` | `Record<string, string>` — raw string values per side key (e.g., `"AB" → "10"`) |
| `vertices` | Generated `Vertex[]` |
| `sides` | Defined `Side[]` (with labels and lengths) |
| `area` | Computed area |
| `perimeter` | Sum of side lengths |
| `angles` | Computed interior angles |
| `isValid` | Whether the current configuration is geometrically valid |
| `hasCalculated` | Whether `generateGeometry()` has been called |
| `error` | Validation error message |

### Actions

- **`setSideCount(n)`** — Updates number of sides, preserves existing side lengths where possible, defaults new sides to `"10"`, resets all computed values.
- **`updateSideLength(key, value)`** — Sanitizes input (only digits and one decimal point), clears calculation state.
- **`generateGeometry()`** — Full pipeline: parse → validate → generate coordinates → compute area/perimeter/angles.
- **`reset()`** — Resets to triangle defaults.

---

## 4. Interactive Rendering

### 4.1 Polygon Canvas (`src/components/polygon-canvas.tsx`)

Renders the generated polygon using `react-native-svg`.

#### Coordinate transformation

Model-space vertices are first **rotated 90° clockwise** (`x, y → y, -x`) for visual display, then mapped to screen coordinates:

```
screenX = (modelX - centerX) · scale + canvasWidth / 2
screenY = canvasHeight / 2 - (modelY - centerY) · scale    // Y-axis flip
```

- Scale is computed from the bounding box to fit within `320×240` canvas with 70px padding.
- `canvasHeight / 2` vs. the flipped `(centerY - p.y)` convention maps screen-Y downward (standard for SVG/RN).

#### Label placement

- **Side labels:** Positioned at edge midpoints, pushed outward from centroid by 28px.
- **Vertex labels:** Positioned at vertices, pushed outward from centroid by 18px.
- **Angle labels:** Positioned at vertices, pulled inward toward centroid by 22px.

The direction vector is always `(point - centroid)`, normalized and scaled by the offset distance.

#### Angle arc rendering

Returns an SVG `<Path d="M ... A R R 0 0 sweep ...">` using the two adjacent screen-space edge vectors. Sweep direction is determined by the 2D cross product of the unit vectors:

```
cross = uₓ · wᵧ - uᵧ · wₓ
sweep = cross > 0 ? 1 : 0
```

#### Gesture support

- Pinch to zoom (scale: 0.5× – 5×).
- Drag to pan.
- Double tap to reset zoom/position.
Uses `react-native-gesture-handler` and `react-native-reanimated`.

### 4.2 Shape Diagram (`src/components/shape-diagrams.tsx`)

Renders fixed-diagram overlays for standard shapes (triangle, rectangle, parallelogram, trapezoid, quadrilateral).

**Triangle case** uses the same `generateTriangle` + `calculateInteriorAngles` functions as the Polygon Plotter, ensuring consistent geometry. All other shapes render static visual aids (not coordinate-generated), with dashed lines and annotations for their formula variables.

#### Formula reference (all commented out except triangle)

| Shape | Area Formula | Inputs |
|---|---|---|
| Triangle | `√(s(s-a)(s-b)(s-c))` (Heron) | 3 sides (or mixed sides/angles) |
| Rectangle | `l · w` | Length, width |
| Parallelogram | `b · h` | Base, height |
| Trapezoid | `½(a + b) · h` | Two bases, height |
| Quadrilateral | `½ · d · (h₁ + h₂)` | Diagonal, two perpendiculars |

---

## 5. Unit Conversion

### 5.1 Linear Conversion

The app supports five units: `mm`, `cm`, `m`, `in`, `ft`. All calculations are performed in the **user's selected unit**. The conversion system maps to meters internally for cross-unit conversions:

| Unit | Factor to meters |
|---|---|
| mm | 0.001 |
| cm | 0.01 |
| in | 0.0254 |
| ft | 0.3048 |
| m | 1 |

### 5.2 Area Conversion

Area is computed in the selected unit, then converted to square meters:

```
areaInSqM = area × (linearFactor)²
```

From square meters, the app converts to:

| Unit | Factor |
|---|---|
| Square Yard | × 1.19599 |
| Hectare | ÷ 10,000 |
| Are | ÷ 100 |
| Square Foot | × 10.7639 |
| Acre | sq ft ÷ 43,560 |
| Cent/Decimal | acre × 100 |
| Katha (Darbhanga) | sq ft ÷ 1,901.25 |
| Bigha (Darbhanga) | katha ÷ 20 |

The **Darbhanga standard** conversions for Katha and Bigha are specific to the Darbhanga region of Bihar, India, where 1 Katha = 1,901.25 sq ft.

### 5.3 Feet + Inches Parsing

When `ft` is the selected unit, the text input format is `feet.inches` — e.g., `4.7` means 4 feet 7 inches. A parser splits on the decimal point:

```
total_ft = integer_part + fractional_part / 12
```

For display, the reverse conversion formats the value back:

```
ft = floor(total_ft)
in = round((total_ft - ft) × 12)
```

---

## 6. Error Handling

### Validation Errors

| Condition | Message |
|---|---|
| Non-positive side length | "Please enter a valid positive length for side {key}." |
| Triangle violates inequality | "Invalid Triangle: The sum of any two sides must be greater than the third side." |
| Polygon violates generalized inequality | "Invalid Polygon: The length of the longest side must be less than the sum of all other sides." |
| Relaxation / coordinate failure | "An error occurred during coordinate generation." |

### UI Feedback

- Invalid configurations show a red border on the result card.
- Errors display an exclamation triangle icon with a message.
- Text inputs filter non-numeric characters and prevent multiple decimal points.

---

## 7. Key Implementation Details

### 7.1 Relaxation Convergence

The Gauss-Seidel-style relaxation converges well for most well-formed polygons but is not guaranteed for degenerate cases (very long vs. very short sides). The decreasing learning rate schedule mitigates oscillation, and the 2000-iteration cap bounds computation time. The rectangle special-case (N=4, alternating equal sides) avoids numerical drift in the most common scenario.

### 7.2 Vertex ordering

All polygons use **clockwise or counterclockwise** cyclic ordering. The Shoelace formula and angle calculation both assume the vertices are in cyclic order as returned by `generatePolygon`.

### 7.3 Screen-space conventions

- **Model space:** Y-axis upward (mathematical convention).
- **Screen space:** Y-axis downward (SVG/RNSVG convention).
- The 90° clockwise rotation (`x,y → y,-x`) and Y-flip in the transform function handle this conversion.
