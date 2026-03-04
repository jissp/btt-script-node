import Vision
import AppKit

func recognizeText(from imagePath: String) {
    let url = URL(fileURLWithPath: imagePath)

    // 파일 존재 여부 확인
    guard FileManager.default.fileExists(atPath: url.path) else {
        print("File Not Found")
        return
    }

    // NSImage 로드
    guard let nsImage = NSImage(contentsOf: url) else {
        print("Load Image Failed")
        return
    }

    // NSImage → CGImage 변환
    let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil)
    guard let validCGImage = cgImage else {
        print("convert NSImage to CGImage Failed")
        return
    }

    let request = VNRecognizeTextRequest { (request, error) in
        guard let results = request.results as? [VNRecognizedTextObservation] else { return }

        let recognizedText = results.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        print("\(recognizedText)")
    }

    // request.recognitionLevel = .fast
    request.recognitionLanguages = ["ko-KR"]
    request.usesLanguageCorrection = false

    let handler = VNImageRequestHandler(cgImage: validCGImage, options: [:])
    try? handler.perform([request])
}

// 실행 부분
if CommandLine.arguments.count > 1 {
    let imagePath = CommandLine.arguments[1]
    recognizeText(from: imagePath)
} else {
    print("이미지 경로를 입력하세요.")
}
