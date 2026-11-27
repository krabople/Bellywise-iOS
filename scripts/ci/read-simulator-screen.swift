// CI-only macOS helper: recognize the actual simulator screenshot with Apple Vision.
import Foundation
import ImageIO
import Vision
import CoreGraphics

guard (2...3).contains(CommandLine.arguments.count) else {
  fputs("Usage: read-simulator-screen screenshot.png [locale]\n", stderr)
  exit(1)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
  let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceThumbnailMaxPixelSize: 1800,
    kCGImageSourceCreateThumbnailWithTransform: true
  ] as CFDictionary) else {
  fputs("The simulator screenshot could not be decoded.\n", stderr)
  exit(1)
}
do {
  let request = VNRecognizeTextRequest()
  // Headless hosted Macs do not always provide a usable Metal accelerator.
  request.usesCPUOnly = true
  request.recognitionLevel = .accurate
  let locale = CommandLine.arguments.count == 3 ? CommandLine.arguments[2] : "en-US"
  let supported = try request.supportedRecognitionLanguages()
  let language = supported.first { $0.lowercased() == locale.lowercased() }
    ?? supported.first { $0.split(separator: "-").first == locale.split(separator: "-").first }
  request.recognitionLanguages = [language ?? "en-US"]
  request.automaticallyDetectsLanguage = language == nil
  request.usesLanguageCorrection = true
  try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
  let lines = (request.results ?? [])
    .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    .compactMap { $0.topCandidates(1).first?.string }
  // Vision cannot read every script the app supports. Verify visible ink too,
  // excluding system status/navigation areas, to distinguish content from a spinner.
  let width = image.width, height = image.height
  var pixels = [UInt8](repeating: 0, count: width * height * 4)
  let inkFraction: Double = pixels.withUnsafeMutableBytes { buffer in
    guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
      bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return 0 }
    context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    let bytes = buffer.bindMemory(to: UInt8.self)
    var ink = 0, count = 0
    for y in stride(from: height * 15 / 100, to: height * 90 / 100, by: 2) {
      for x in stride(from: width * 8 / 100, to: width * 92 / 100, by: 2) {
        let i = (y * width + x) * 4
        count += 1
        if bytes[i] < 130 && bytes[i+1] < 160 && bytes[i+2] < 160 { ink += 1 }
      }
    }
    return Double(ink) / Double(max(count, 1))
  }
  let output = try JSONSerialization.data(withJSONObject: ["lines": lines,
    "languageSupported": language != nil, "contentInkFraction": inkFraction], options: [.prettyPrinted, .sortedKeys])
  FileHandle.standardOutput.write(output)
  FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
  fputs("Vision could not read the simulator screenshot: \(error)\n", stderr)
  exit(1)
}
