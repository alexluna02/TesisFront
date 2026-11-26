// Fases de la Luna calculadas con los algoritmos de Jean Meeus, «Astronomical Algorithms» (2.ª ed.,
// 1998): capítulo 49 (instantes de las fases principales, con todas sus correcciones periódicas y
// planetarias) y capítulo 48 (fracción iluminada). ΔT (TT − UT) según los polinomios de
// Espenak y Meeus (NASA, 2006). Verificado contra el catálogo de fases 2001–2100 de Fred Espenak
// (astropixels.com): la diferencia máxima es de 1 minuto, el redondeo de la tabla.
// Todas las funciones trabajan con Date (instantes absolutos); la zona horaria solo importa al mostrar.

const RAD = Math.PI / 180
const sin = (g) => Math.sin(g * RAD)
const cos = (g) => Math.cos(g * RAD)
const norm = (g) => ((g % 360) + 360) % 360

export const SINODICO = 29.530588861   // días (mes sinódico medio)
export const TIPOS = ['nueva', 'creciente', 'llena', 'menguante']   // k + 0 / 0.25 / 0.5 / 0.75

const jdAFecha = (jd) => new Date((jd - 2440587.5) * 86400000)
const fechaAJd = (fecha) => fecha.getTime() / 86400000 + 2440587.5

// ΔT en segundos (Espenak y Meeus, «Polynomial expressions for Delta T»)
function deltaT(anio) {
  const y = anio
  if (y >= 2005 && y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t }
  if (y >= 2050 && y < 2150) { const u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y) }
  if (y >= 1986 && y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5 }
  if (y >= 1961 && y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718 }
  if (y >= 1941 && y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547 }
  const u = (y - 1820) / 100
  return -20 + 32 * u * u
}

// Instante de la fase k (k entero = luna nueva; +0.25 cuarto creciente; +0.5 llena; +0.75 menguante)
export function instanteFase(k) {
  const T = k / 1236.85
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4
  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const M = norm(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3)
  const Mp = norm(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4)
  const F = norm(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4)
  const Om = norm(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3)
  const fraccion = ((k % 1) + 1) % 1

  let c
  if (fraccion < 0.01 || fraccion > 0.99 || Math.abs(fraccion - 0.5) < 0.01) {
    const llena = Math.abs(fraccion - 0.5) < 0.01
    c = (llena ? -0.40614 : -0.40720) * sin(Mp)
      + (llena ? 0.17302 : 0.17241) * E * sin(M)
      + (llena ? 0.01614 : 0.01608) * sin(2 * Mp)
      + (llena ? 0.01043 : 0.01039) * sin(2 * F)
      + (llena ? 0.00734 : 0.00739) * E * sin(Mp - M)
      + (llena ? -0.00515 : -0.00514) * E * sin(Mp + M)
      + (llena ? 0.00209 : 0.00208) * E * E * sin(2 * M)
      - 0.00111 * sin(Mp - 2 * F)
      - 0.00057 * sin(Mp + 2 * F)
      + 0.00056 * E * sin(2 * Mp + M)
      - 0.00042 * sin(3 * Mp)
      + 0.00042 * E * sin(M + 2 * F)
      + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * Mp - M)
      - 0.00017 * sin(Om)
      - 0.00007 * sin(Mp + 2 * M)
      + 0.00004 * sin(2 * Mp - 2 * F)
      + 0.00004 * sin(3 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(2 * Mp + 2 * F)
      - 0.00003 * sin(Mp + M + 2 * F)
      + 0.00003 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(Mp - M - 2 * F)
      - 0.00002 * sin(3 * Mp + M)
      + 0.00002 * sin(4 * Mp)
  } else {
    c = -0.62801 * sin(Mp)
      + 0.17172 * E * sin(M)
      - 0.01183 * E * sin(Mp + M)
      + 0.00862 * sin(2 * Mp)
      + 0.00804 * sin(2 * F)
      + 0.00454 * E * sin(Mp - M)
      + 0.00204 * E * E * sin(2 * M)
      - 0.0018 * sin(Mp - 2 * F)
      - 0.0007 * sin(Mp + 2 * F)
      - 0.0004 * sin(3 * Mp)
      - 0.00034 * E * sin(2 * Mp - M)
      + 0.00032 * E * sin(M + 2 * F)
      + 0.00032 * E * sin(M - 2 * F)
      - 0.00028 * E * E * sin(Mp + 2 * M)
      + 0.00027 * E * sin(2 * Mp + M)
      - 0.00017 * sin(Om)
      - 0.00005 * sin(Mp - M - 2 * F)
      + 0.00004 * sin(2 * Mp + 2 * F)
      - 0.00004 * sin(Mp + M + 2 * F)
      + 0.00004 * sin(Mp - 2 * M)
      + 0.00003 * sin(Mp + M - 2 * F)
      + 0.00003 * sin(3 * M)
      + 0.00002 * sin(2 * Mp - 2 * F)
      + 0.00002 * sin(Mp - M + 2 * F)
      - 0.00002 * sin(3 * Mp + M)
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F)
    c += fraccion < 0.5 ? W : -W
  }
  jde += c

  // Correcciones planetarias (comunes a todas las fases)
  const A = [
    299.77 + 0.107408 * k - 0.009173 * T2, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k, 349.42 + 36.412478 * k,
    84.66 + 18.206239 * k, 141.74 + 53.303771 * k, 207.14 + 2.453732 * k, 154.84 + 7.30686 * k, 34.52 + 27.261239 * k,
    207.19 + 0.121824 * k, 291.34 + 1.844379 * k, 161.72 + 24.198154 * k, 239.56 + 25.513099 * k, 331.55 + 3.592518 * k,
  ]
  const coef = [0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042, 0.00004, 0.000037, 0.000035, 0.000023]
  jde += A.reduce((s, a, i) => s + coef[i] * sin(a), 0)

  // De tiempo dinámico (TT) a tiempo universal (UT)
  const anio = 2000 + k / 12.3685
  return jdAFecha(jde - deltaT(anio) / 86400)
}

// Fases principales entre dos fechas, en orden: [{ tipo: 'nueva'|'creciente'|'llena'|'menguante', fecha }]
export function fasesEntre(desde, hasta) {
  const anioDesde = desde.getUTCFullYear() + desde.getUTCMonth() / 12
  let k = Math.floor((anioDesde - 2000) * 12.3685) - 2
  const fases = []
  for (; ; k += 1) {
    for (let q = 0; q < 4; q += 1) {
      const fecha = instanteFase(k + q / 4)
      if (fecha > hasta) return fases
      if (fecha >= desde) fases.push({ tipo: TIPOS[q], fecha })
    }
  }
}

// Fracción iluminada y ángulo de fase en un instante (Meeus cap. 48, fórmula de baja precisión
// con los argumentos fundamentales del cap. 47; error en la fracción < 0.2 %)
export function iluminacion(fecha) {
  const T = (fechaAJd(fecha) - 2451545) / 36525
  const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000)
  const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000)
  const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000)
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D)
  return (1 + cos(i)) / 2
}

// Estado de la Luna en un instante: fracción iluminada, si crece, edad (días desde la luna nueva),
// nombre de la fase visible (8 fases) y las fases principales anterior y siguiente.
export function estadoLuna(fecha) {
  const cerca = fasesEntre(new Date(fecha.getTime() - 40 * 86400000), new Date(fecha.getTime() + 40 * 86400000))
  const anterior = [...cerca].reverse().find((f) => f.fecha <= fecha)
  const siguiente = cerca.find((f) => f.fecha > fecha)
  const nuevaAnterior = [...cerca].reverse().find((f) => f.tipo === 'nueva' && f.fecha <= fecha)
  const creciendo = anterior.tipo === 'nueva' || anterior.tipo === 'creciente'
  const fraccion = iluminacion(fecha)
  const edad = (fecha - nuevaAnterior.fecha) / 86400000
  // A menos de ~1 día de una fase principal se la nombra así; si no, la fase intermedia
  const dia = 86400000
  const enFase = cerca.find((f) => Math.abs(f.fecha - fecha) < dia / 2)
  let visible
  if (enFase) visible = enFase.tipo
  else if (anterior.tipo === 'nueva') visible = 'creciente-iluminante'
  else if (anterior.tipo === 'creciente') visible = 'gibosa-creciente'
  else if (anterior.tipo === 'llena') visible = 'gibosa-menguante'
  else visible = 'menguante-iluminante'
  return { fraccion, creciendo, edad, visible, periodo: anterior.tipo, anterior, siguiente }
}
