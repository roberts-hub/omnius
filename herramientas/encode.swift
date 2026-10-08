// Uso: swift encode.swift <entrada> <salida> <hevc|h264> <ancho> <alto> <bitrate_bps>
// Escala/recorta al centro (como object-fit: cover), sin audio, fast-start, Rec.709.
import AVFoundation
import VideoToolbox

let a = CommandLine.arguments
guard a.count == 7, let W = Int(a[4]), let H = Int(a[5]), let BR = Int(a[6]) else {
    print("uso: entrada salida hevc|h264 ancho alto bitrate"); exit(1)
}
let entrada = URL(fileURLWithPath: a[1])
let salida = URL(fileURLWithPath: a[2])
let codec: AVVideoCodecType = a[3] == "hevc" ? .hevc : .h264
try? FileManager.default.removeItem(at: salida)

let asset = AVURLAsset(url: entrada)
let sem = DispatchSemaphore(value: 0)
var pista: AVAssetTrack!
var fps: Float = 30
var dur = CMTime.zero
Task {
    pista = try! await asset.loadTracks(withMediaType: .video).first!
    fps = try! await pista.load(.nominalFrameRate)
    dur = try! await asset.load(.duration)
    sem.signal()
}
sem.wait()

let tam = pista.naturalSize
// escala para cubrir el cuadro de salida, centrado (igual que object-fit: cover)
let s = max(CGFloat(W) / tam.width, CGFloat(H) / tam.height)
let tx = (CGFloat(W) - tam.width * s) / 2
let ty = (CGFloat(H) - tam.height * s) / 2
let xf = CGAffineTransform(scaleX: s, y: s).concatenating(CGAffineTransform(translationX: tx, y: ty))

let comp = AVMutableVideoComposition()
comp.renderSize = CGSize(width: W, height: H)
comp.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps.rounded()))
let instr = AVMutableVideoCompositionInstruction()
instr.timeRange = CMTimeRange(start: .zero, duration: dur)
let capa = AVMutableVideoCompositionLayerInstruction(assetTrack: pista)
capa.setTransform(xf, at: .zero)
instr.layerInstructions = [capa]
comp.instructions = [instr]
comp.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
comp.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
comp.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2

let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderVideoCompositionOutput(videoTracks: [pista], videoSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
])
out.videoComposition = comp
out.alwaysCopiesSampleData = false
reader.add(out)

var props: [String: Any] = [
    AVVideoAverageBitRateKey: BR,
    AVVideoMaxKeyFrameIntervalKey: Int(fps.rounded()) * 2,
    AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
    AVVideoAllowFrameReorderingKey: true,
]
if codec == .h264 {
    props[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel
    props[AVVideoH264EntropyModeKey] = AVVideoH264EntropyModeCABAC
} else {
    props[AVVideoProfileLevelKey] = kVTProfileLevel_HEVC_Main_AutoLevel as String
}

let writer = try! AVAssetWriter(outputURL: salida, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true // fast-start: empieza a reproducir mientras descarga
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: codec,
    AVVideoWidthKey: W,
    AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: props,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
])
input.expectsMediaDataInRealTime = false
writer.add(input)

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let cola = DispatchQueue(label: "enc")
let fin = DispatchSemaphore(value: 0)
input.requestMediaDataWhenReady(on: cola) {
    while input.isReadyForMoreMediaData {
        if let buf = out.copyNextSampleBuffer() {
            input.append(buf)
        } else {
            input.markAsFinished()
            writer.finishWriting { fin.signal() }
            return
        }
    }
}
fin.wait()
if writer.status != .completed { print("ERROR:", writer.error ?? "desconocido"); exit(1) }
let bytes = (try? FileManager.default.attributesOfItem(atPath: salida.path)[.size] as? Int) ?? 0
print(String(format: "%@  %dx%d  %@  %.1f Mbps  →  %.1f MB  (%.0f fps, %.1f s)",
             salida.lastPathComponent, W, H, a[3], Double(BR) / 1e6, Double(bytes) / 1e6, fps, dur.seconds))
