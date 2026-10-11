// Ficha del modelo desplegado (Mit_B0_384_Test.pth).
// Fuentes: log del notebook de entrenamiento (Google Colab) y artículo
// "Artículo_Tesis_Alex.Luna.docx" (Tablas 4–14). Valores transcritos, no estimados.
// Donde el log y el artículo difieren, se usa el log.

export const CLASSES = ['Fondo', 'Tizón', 'Roya', 'Mancha blanca']

export const MODEL_INFO = {
  name: 'DeepLabV3+ con encoder MiT-B0',
  weightsFile: 'Mit_B0_384_Test.pth',
  decoder: 'DeepLabV3+',
  encoder: 'MiT-B0 (Mix Transformer B0)',
  pretrained: 'ImageNet',
  inputSize: '384 × 384 px (RGB)',
  numClasses: 4,
  params: 4136820,
  sizeMB: 15.78,
}

// 1 256 imágenes anotadas, partición 80/10/10 (1 005 / 126 / 125). El aumento x3
// (Roboflow) se aplicó solo a entrenamiento: 1 005 → 3 015.
export const DATASET = {
  annotated: 1256,
  splitRatio: '80 / 10 / 10',
  trainOriginal: 1005,
  augmentation: 'x3 solo en entrenamiento (volteos, rotaciones, recortes, exposición)',
}

export const DATASET_SPLIT = [
  { split: 'Entrenamiento (aumentado x3)', images: 3015 },
  { split: 'Validación',                   images: 126 },
  { split: 'Test',                         images: 125 },
]

export const TRAINING = {
  maxEpochs: 70,
  epochsRun: 49,
  bestEpoch: 29,
  bestValMiou: 0.8170,
  earlyStoppingPatience: 20,
  itersPerEpoch: 301,
  totalMinutes: 22.90,
  secondsPerEpoch: 28.0,
  optimizer: 'AdamW',
  lrEncoder: 6e-5,
  lrDecoder: 6e-4,
  scheduler: 'Calentamiento lineal + recocido por coseno',
  lossSchedule: [
    { epochs: '1–25',  loss: '0,5·Dice + 0,5·CE' },
    { epochs: '26–49', loss: '0,5·Lovász + 0,3·CE + 0,2·Dice' },
  ],
  evaluation: 'Pesos EMA de la época 29 + TTA',
  framework: 'PyTorch + Segmentation Models PyTorch',
  hardware: 'NVIDIA A100 80 GB (Google Colab Pro)',
}

// Métricas globales finales (mejor modelo EMA + TTA). mAP de validación = 0.9418
// según el log; el artículo reporta 0.9468.
export const FINAL_METRICS = [
  { metric: 'mIoU',           val: 0.8182, test: 0.7593 },
  { metric: 'Pixel Accuracy', val: 0.9767, test: 0.9736 },
  { metric: 'F1 (macro)',     val: 0.8972, test: 0.8560 },
  { metric: 'mAP',            val: 0.9418, test: 0.9008 },
]

// Métricas por clase sobre TEST (EMA + TTA). AP de Roya no fue calculado (NaN en el log).
export const TEST_PER_CLASS = [
  { cls: 'Fondo',         iou: 0.9720, precision: 0.9853, recall: 0.9863, f1: 0.9858, ap: 0.9871 },
  { cls: 'Tizón',         iou: 0.7774, precision: 0.8360, recall: 0.9172, f1: 0.8747, ap: 0.8544 },
  { cls: 'Roya',          iou: 0.5853, precision: 0.8340, recall: 0.6625, f1: 0.7384, ap: null   },
  { cls: 'Mancha blanca', iou: 0.7024, precision: 0.8448, recall: 0.8065, f1: 0.8252, ap: 0.8609 },
]

// Métricas por clase sobre VALIDACIÓN (EMA + TTA) — artículo, Tabla 12
export const VAL_PER_CLASS = [
  { cls: 'Fondo',         iou: 0.9758, precision: 0.9891, recall: 0.9864, f1: 0.9877, ap: 0.9978 },
  { cls: 'Tizón',         iou: 0.7514, precision: 0.8203, recall: 0.8995, f1: 0.8581, ap: 0.9340 },
  { cls: 'Roya',          iou: 0.7463, precision: 0.8592, recall: 0.8503, f1: 0.8547, ap: 0.9223 },
  { cls: 'Mancha blanca', iou: 0.7993, precision: 0.8958, recall: 0.8812, f1: 0.8884, ap: 0.9329 },
]

// Comparación de encoders con DeepLabV3+ a 384 px — validación: artículo, Tabla 9;
// test (EMA + TTA): logs de cada notebook.
// Sin AP/mAP: el AP de Roya en test es NaN, así que el mAP de test no es comparable entre conjuntos.
export const ENCODER_COMPARISON = [
  { encoder: 'MiT-B0',          type: 'Transformer', params: 4136820,  sizeMB: 15.78, miou: 0.8182, f1: 0.8972, pixAcc: 0.9767, fps: 70.4, selected: true, test: { miou: 0.7593, f1: 0.8560, pixAcc: 0.9736 } },
  { encoder: 'MobileNetV2',     type: 'CNN',         params: 4379284,  sizeMB: 16.71, miou: 0.8132, f1: 0.8938, pixAcc: 0.9760, fps: 109.0, test: { miou: 0.7588, f1: 0.8559, pixAcc: 0.9729 } },
  { encoder: 'EfficientNet-B0', type: 'CNN',         params: 4908240,  sizeMB: 18.72, miou: 0.7955, f1: 0.8819, pixAcc: 0.9740, fps: 72.5, test: { miou: 0.7361, f1: 0.8390, pixAcc: 0.9709 } },
  { encoder: 'MobileOne-S0',    type: 'CNN',         params: 6090244,  sizeMB: 23.23, miou: 0.8191, f1: 0.8975, pixAcc: 0.9764, fps: 32.0, test: { miou: 0.7495, f1: 0.8487, pixAcc: 0.9726 } },
  { encoder: 'ResNet18',        type: 'CNN',         params: 12330068, sizeMB: 47.04, miou: 0.8385, f1: 0.9099, pixAcc: 0.9790, fps: 182.6, test: { miou: 0.7528, f1: 0.8521, pixAcc: 0.9727 } },
  { encoder: 'MiT-B1',          type: 'Transformer', params: 14304980, sizeMB: 54.57, miou: 0.8184, f1: 0.8973, pixAcc: 0.9771, fps: 69.4, test: { miou: 0.7674, f1: 0.8619, pixAcc: 0.9748 } },
  { encoder: 'MiT-B2',          type: 'Transformer', params: 25349844, sizeMB: 96.70, miou: 0.8144, f1: 0.8947, pixAcc: 0.9759, fps: 39.5, test: { miou: 0.7655, f1: 0.8611, pixAcc: 0.9738 } },
]

// Sensibilidad de MiT-B0 a la resolución de entrada, sobre validación — artículo, Tabla 10
export const RESOLUTION_STUDY = [
  { res: 256, miou: 0.8151, f1: 0.8949, secPerEpoch: 24.8, fps: 68.7 },
  { res: 384, miou: 0.8182, f1: 0.8972, secPerEpoch: 28.0, fps: 70.4, selected: true },
  { res: 512, miou: 0.8087, f1: 0.8912, secPerEpoch: 35.3, fps: 73.2 },
  { res: 768, miou: 0.8016, f1: 0.8862, secPerEpoch: 59.2, fps: 66.3 },
]

// Matrices de confusión en píxeles (filas = real, columnas = predicción), con TTA
export const CONFUSION = {
  test: [
    [16718490, 122712,  39890,  69316],
    [   56035, 630804,     49,    825],
    [   99618,     56, 200680,   2576],
    [   94015,    996,      0, 395938],
  ],
  val: [
    [16663571, 126279,  63845,  40358],
    [   64198, 576877,    170,    102],
    [   49251,     71, 390602,  19453],
    [   69474,      0,      0, 515205],
  ],
}

export const INFERENCE = {
  device: 'GPU NVIDIA A100 (Colab)',
  noTta: { ms: 14.20, fps: 70.4 },
  tta:   { ms: 98.63, fps: 10.1 },
}

// Historial por época: [época, lr, loss train, loss val, mIoU val, IoU Fondo, IoU Tizón, IoU Roya, IoU Mancha blanca]
const RAW_HISTORY = [
  [ 1, 0.00000300, 0.6239, 0.4088, 0.6906, 0.9525, 0.5614, 0.5839, 0.6644],
  [ 2, 0.00002200, 0.4167, 0.3769, 0.7271, 0.9604, 0.6580, 0.5977, 0.6923],
  [ 3, 0.00004100, 0.3906, 0.3703, 0.7267, 0.9622, 0.6701, 0.5985, 0.6762],
  [ 4, 0.00006000, 0.3847, 0.3525, 0.7765, 0.9646, 0.6905, 0.6593, 0.7915],
  [ 5, 0.00005997, 0.3735, 0.3505, 0.7745, 0.9656, 0.7010, 0.6546, 0.7768],
  [ 6, 0.00005987, 0.3649, 0.3508, 0.7751, 0.9672, 0.7045, 0.6592, 0.7695],
  [ 7, 0.00005971, 0.3617, 0.3540, 0.7732, 0.9680, 0.7076, 0.6590, 0.7582],
  [ 8, 0.00005948, 0.3536, 0.3493, 0.7722, 0.9691, 0.7097, 0.6490, 0.7608],
  [ 9, 0.00005919, 0.3481, 0.3492, 0.7824, 0.9690, 0.7113, 0.6803, 0.7688],
  [10, 0.00005884, 0.3419, 0.3475, 0.7810, 0.9691, 0.7166, 0.6785, 0.7598],
  [11, 0.00005843, 0.3442, 0.3464, 0.7834, 0.9699, 0.7213, 0.6838, 0.7589],
  [12, 0.00005795, 0.3340, 0.3439, 0.7931, 0.9708, 0.7199, 0.7066, 0.7752],
  [13, 0.00005741, 0.3369, 0.3417, 0.7979, 0.9713, 0.7222, 0.7229, 0.7750],
  [14, 0.00005682, 0.3302, 0.3405, 0.8033, 0.9720, 0.7265, 0.7291, 0.7855],
  [15, 0.00005616, 0.3322, 0.3405, 0.8039, 0.9722, 0.7287, 0.7222, 0.7927],
  [16, 0.00005545, 0.3255, 0.3396, 0.8078, 0.9729, 0.7303, 0.7308, 0.7973],
  [17, 0.00005469, 0.3254, 0.3399, 0.8092, 0.9735, 0.7308, 0.7306, 0.8019],
  [18, 0.00005387, 0.3190, 0.3399, 0.8100, 0.9732, 0.7306, 0.7328, 0.8035],
  [19, 0.00005300, 0.3201, 0.3415, 0.8091, 0.9738, 0.7323, 0.7334, 0.7970],
  [20, 0.00005208, 0.3186, 0.3419, 0.8092, 0.9741, 0.7349, 0.7337, 0.7941],
  [21, 0.00005111, 0.3141, 0.3444, 0.8045, 0.9743, 0.7370, 0.7246, 0.7822],
  [22, 0.00005010, 0.3123, 0.3477, 0.7958, 0.9740, 0.7366, 0.7104, 0.7623],
  [23, 0.00004905, 0.3120, 0.3478, 0.7979, 0.9740, 0.7374, 0.7097, 0.7704],
  [24, 0.00004795, 0.3094, 0.3452, 0.8076, 0.9742, 0.7418, 0.7277, 0.7865],
  [25, 0.00004682, 0.3051, 0.3454, 0.8078, 0.9741, 0.7432, 0.7294, 0.7845],
  [26, 0.00004565, 0.2618, 0.3006, 0.8098, 0.9744, 0.7444, 0.7333, 0.7869],
  [27, 0.00004444, 0.2633, 0.2989, 0.8121, 0.9746, 0.7465, 0.7371, 0.7901],
  [28, 0.00004321, 0.2619, 0.2976, 0.8144, 0.9749, 0.7454, 0.7412, 0.7963],
  [29, 0.00004195, 0.2616, 0.2965, 0.8170, 0.9751, 0.7459, 0.7470, 0.7999],
  [30, 0.00004066, 0.2601, 0.2970, 0.8168, 0.9751, 0.7453, 0.7470, 0.7998],
  [31, 0.00003935, 0.2550, 0.2989, 0.8157, 0.9752, 0.7462, 0.7437, 0.7978],
  [32, 0.00003802, 0.2562, 0.2991, 0.8159, 0.9753, 0.7472, 0.7423, 0.7990],
  [33, 0.00003668, 0.2533, 0.2999, 0.8161, 0.9753, 0.7477, 0.7401, 0.8012],
  [34, 0.00003532, 0.2513, 0.3001, 0.8162, 0.9753, 0.7485, 0.7397, 0.8013],
  [35, 0.00003395, 0.2516, 0.3009, 0.8165, 0.9752, 0.7489, 0.7396, 0.8023],
  [36, 0.00003257, 0.2509, 0.3025, 0.8137, 0.9750, 0.7493, 0.7333, 0.7973],
  [37, 0.00003119, 0.2496, 0.3035, 0.8115, 0.9749, 0.7486, 0.7279, 0.7947],
  [38, 0.00002981, 0.2504, 0.3037, 0.8107, 0.9749, 0.7479, 0.7263, 0.7936],
  [39, 0.00002843, 0.2478, 0.3062, 0.8090, 0.9748, 0.7483, 0.7233, 0.7897],
  [40, 0.00002705, 0.2442, 0.3083, 0.8066, 0.9748, 0.7488, 0.7186, 0.7843],
  [41, 0.00002568, 0.2478, 0.3070, 0.8087, 0.9749, 0.7492, 0.7215, 0.7894],
  [42, 0.00002432, 0.2453, 0.3062, 0.8100, 0.9749, 0.7493, 0.7251, 0.7906],
  [43, 0.00002298, 0.2421, 0.3053, 0.8103, 0.9749, 0.7490, 0.7285, 0.7886],
  [44, 0.00002165, 0.2429, 0.3042, 0.8114, 0.9750, 0.7493, 0.7322, 0.7891],
  [45, 0.00002034, 0.2401, 0.3041, 0.8101, 0.9750, 0.7490, 0.7296, 0.7869],
  [46, 0.00001905, 0.2399, 0.3041, 0.8102, 0.9750, 0.7488, 0.7295, 0.7876],
  [47, 0.00001779, 0.2425, 0.3045, 0.8101, 0.9750, 0.7483, 0.7276, 0.7895],
  [48, 0.00001656, 0.2393, 0.3043, 0.8104, 0.9751, 0.7476, 0.7278, 0.7911],
  [49, 0.00001535, 0.2386, 0.3042, 0.8105, 0.9751, 0.7476, 0.7283, 0.7911],
]

export const HISTORY = RAW_HISTORY.map(([epoch, lr, trainLoss, valLoss, miou, fondo, tizon, roya, mancha]) => ({
  epoch, lr, trainLoss, valLoss, miou, iou: [fondo, tizon, roya, mancha],
}))
