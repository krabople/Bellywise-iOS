// CI-only macOS helper: recognize the actual simulator screenshot with Apple Vision.
import Foundation
import ImageIO
import Vision

guard CommandLine.arguments.count == 2 else {
  fputs("Usage: read-simulator-screen screenshot.png\n", stderr)
  exit(1)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fputs("The simulator screenshot could not be decoded.\n", stderr)
  exit(1)
}
do {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["en-US"]
  request.usesLanguageCorrection = true
  try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
  let lines = (request.results ?? [])
    .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    .compactMap { $0.topCandidates(1).first?.string }
  let output = try JSONSerialization.data(withJSONObject: ["lines": lines], options: [.prettyPrinted, .sortedKeys])
  FileHandle.standardOutput.write(output)
  FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
  fputs("Vision could not read the simulator screenshot: \(error)\n", stderr)
  exit(1)
}
