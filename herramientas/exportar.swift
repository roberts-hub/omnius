// Uso: swift exportar.swift <entrada> <salida.mp4> <preset>
// Exporta con audio usando un preset de AVFoundation (p. ej. AVAssetExportPresetHEVC1920x1080,
// AVAssetExportPreset1280x720) y "fast start" para que empiece a reproducir en la web antes de bajar todo.
import AVFoundation
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let salida = URL(fileURLWithPath: a[2])
try? FileManager.default.removeItem(at: salida)
guard let s = AVAssetExportSession(asset: asset, presetName: a[3]) else { print("preset no disponible"); exit(1) }
s.outputURL = salida
s.outputFileType = .mp4
s.shouldOptimizeForNetworkUse = true
let sem = DispatchSemaphore(value: 0)
s.exportAsynchronously { sem.signal() }
sem.wait()
if s.status == .completed { print("ok", a[2]) } else { print("error", s.error ?? "") ; exit(1) }
