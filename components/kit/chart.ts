// La geometría de los gráficos del kit (§8.3): sin librería, en SVG.
//
// Las coordenadas van en una caja de 0..100 × 0..100 y el SVG se estira con
// `preserveAspectRatio="none"` y `vector-effect: non-scaling-stroke`: el trazo
// mantiene su grosor a cualquier ancho y el gráfico llena su contenedor.
//
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

export type Domain = { min: number; max: number };

/**
 * El rango vertical común a todas las series. Arranca en 0 si todo es positivo
 * (un ingreso no se lee bien con el eje cortado), y si todo es igual abre un
 * margen para que la línea no quede pegada a un borde.
 */
export function domainOf(...series: Array<ReadonlyArray<number | null> | undefined>): Domain | null {
  const values = series.flatMap((s) => (s ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v)));
  if (values.length === 0) return null;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min > 0) min = 0;
  if (min === max) max = min + (Math.abs(min) || 1);
  return { min, max };
}

/**
 * El `d` de un `<path>` para una serie en la caja 0..100. Un hueco (`null`) corta
 * la línea en vez de inventar un cero: "sin dato" no es "cero".
 */
export function linePath(values: ReadonlyArray<number | null>, domain: Domain): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const span = domain.max - domain.min || 1;
  let d = "";
  let pen = false;
  values.forEach((value, i) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      pen = false;
      return;
    }
    const x = values.length > 1 ? i * step : 50;
    const y = 100 - ((value - domain.min) / span) * 100;
    d += `${pen ? "L" : "M"}${round(x)} ${round(y)}`;
    pen = true;
  });
  return d;
}

/** El paso "redondo" (1, 2, 2,5 o 5 × 10ⁿ) que reparte el rango en unas `count` marcas. */
function niceStep(domain: Domain, count: number): number {
  const raw = (domain.max - domain.min) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
}

/**
 * El rango estirado hasta marcas redondas: 0–12.480 pasa a 0–15.000. Así la línea
 * más alta nunca toca el techo sin un filete de referencia encima.
 */
export function niceDomain(domain: Domain, count = 4): Domain {
  const step = niceStep(domain, count);
  return { min: round(Math.floor(domain.min / step) * step), max: round(Math.ceil(domain.max / step) * step) };
}

/** Las marcas del eje vertical dentro del rango: valores redondos. */
export function ticks(domain: Domain, count = 4): number[] {
  const step = niceStep(domain, count);
  const out: number[] = [];
  for (let v = Math.ceil(domain.min / step) * step; v <= domain.max + step * 0.001 && out.length < count + 2; v += step) {
    out.push(round(v));
  }
  return out;
}

/** Posición vertical (0..100, arriba = 0) de un valor en el rango. */
export function yOf(value: number, domain: Domain): number {
  const span = domain.max - domain.min || 1;
  return round(100 - ((value - domain.min) / span) * 100);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
