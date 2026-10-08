// Uso: frame <video> <segundo> <salida.jpg> [ancho_salida]
// Extrae el fotograma exacto; si se da ancho, lo escala a ese ancho.
import AVFoundation
import AppKit

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let t = CMTime(seconds: Double(a[2])!, preferredTimescale: 600)
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
if a.count > 4, let w = Double(a[4]) { gen.maximumSize = CGSize(width: w, height: w) }
let sem = DispatchSemaphore(value: 0)
var img: CGImage?
gen.generateCGImageAsynchronously(for: t) { i, _, e in img = i; if let e { print(e) }; sem.signal() }
sem.wait()
guard let img else { exit(1) }
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.95])!.write(to: URL(fileURLWithPath: a[3]))
print(a[3], img.width, "x", img.height)
