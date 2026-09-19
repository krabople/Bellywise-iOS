import ExpoModulesCore
import Foundation
import ImageIO
import Vision

public final class FoodprintVisionModule: Module {
  private let recognitionQueue = DispatchQueue(label: "app.foodprint.vision", qos: .userInitiated)

  public func definition() -> ModuleDefinition {
    Name("FoodprintVision")

    AsyncFunction("recognizeText") { (uri: String) throws -> [String: Any] in
      guard let url = URL(string: uri), url.isFileURL else {
        throw VisionInputException("Choose a local camera or photo-library image.")
      }
      guard FileManager.default.fileExists(atPath: url.path) else {
        throw VisionInputException("The image is no longer available. Take another photo.")
      }
      // ImageIO downsamples before decoding, preserving EXIF orientation while limiting memory.
      guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: 3200,
          kCGImageSourceShouldCacheImmediately: true
        ] as CFDictionary) else {
        throw VisionInputException("The image could not be opened. Try a new photo.")
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["en-GB", "en-US"]
      request.automaticallyDetectsLanguage = true
      request.customWords = ["Ingredients", "allergens", "lactose", "fructans", "inulin", "sorbitol", "xylitol", "erythritol"]
      let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
      try handler.perform([request])

      // Form rows before sorting within them; a pairwise tolerance comparator is not transitive.
      let vertical = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
      var rows: [[VNRecognizedTextObservation]] = []
      for observation in vertical {
        if let first = rows.last?.first,
          abs(first.boundingBox.midY - observation.boundingBox.midY) < min(first.boundingBox.height, observation.boundingBox.height) * 0.5 {
          rows[rows.count - 1].append(observation)
        } else {
          rows.append([observation])
        }
      }
      let observations = rows.flatMap { $0.sorted { $0.boundingBox.minX < $1.boundingBox.minX } }
      var blocks: [[String: Any]] = []
      var lines: [String] = []
      var weightedConfidence: Double = 0
      var characterCount: Int = 0
      for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { continue }
        let rect = observation.boundingBox
        blocks.append([
          "text": text,
          "confidence": Double(candidate.confidence),
          "bounds": ["x": Double(rect.minX), "y": Double(rect.minY), "width": Double(rect.width), "height": Double(rect.height)]
        ])
        lines.append(text)
        weightedConfidence += Double(candidate.confidence) * Double(text.count)
        characterCount += text.count
      }
      return [
        "text": lines.joined(separator: "\n"),
        "confidence": characterCount > 0 ? weightedConfidence / Double(characterCount) : 0,
        "blocks": blocks
      ]
    }.runOnQueue(recognitionQueue)
  }
}

private final class VisionInputException: GenericException<String> {
  override var reason: String { param }
}
