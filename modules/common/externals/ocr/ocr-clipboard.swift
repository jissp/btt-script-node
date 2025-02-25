import Vision
import AppKit

func recognizeTextFromClipboard() {
    // 클립보드에서 이미지 가져오기
    guard let image = getClipboardImage() else {
        return
    }

    // NSImage → CGImage 변환
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("NSImage를 CGImage로 변환하는데 실패했습니다.")
        return
    }

    // OCR 처리 요청
    let request = VNRecognizeTextRequest { (request, error) in
        guard let results = request.results as? [VNRecognizedTextObservation] else {
            print("OCR 처리 중 오류 발생.")
            return
        }

        // 인식된 텍스트 출력
        let recognizedText = results.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
        print("\(recognizedText)")
    }

    // 언어 및 기타 설정
    request.recognitionLanguages = ["ko-KR"]
    request.usesLanguageCorrection = false

    // VNImageRequestHandler로 OCR 처리
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        print("OCR 요청 처리 중 오류 발생: \(error.localizedDescription)")
    }
}

// 클립보드에서 이미지 가져오기
func getClipboardImage() -> NSImage? {
    let pasteboard = NSPasteboard.general
    guard let types = pasteboard.types, types.contains(.tiff) else {
        return nil
    }

    if let data = pasteboard.data(forType: .tiff), let image = NSImage(data: data) {
        return image
    }
    return nil
}

// 실행 부분
recognizeTextFromClipboard()