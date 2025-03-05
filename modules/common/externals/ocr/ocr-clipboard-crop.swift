import Vision
import AppKit

func recognizeTextFromClipboard(inRect rect: NSRect, debuggingMode: String, contrast: Float, removeR: String) {
    // 클립보드에서 이미지 가져오기
    guard let image = getClipboardImage() else {
        return
    }

    // NSImage → CGImage 변환
    guard let transformedCgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return
    }

    // 지정된 영역을 잘라냄
    guard var cgImage = cropImage(transformedCgImage, to: rect) else {
        return
    }

    cgImage = contrast == 1 ? cgImage : preprocessImage(cgImage, contrast)

    // 디버깅: 크롭된 이미지를 파일로 저장
    if debuggingMode == "debug" {
        let filePath = "/tmp/debugging.png"  // 파일 경로 수정
        saveCGImageToFile(cgImage: cgImage, to: filePath)
    }

    // OCR 처리 요청
    let request = VNRecognizeTextRequest { (request, error) in
        guard let results = request.results as? [VNRecognizedTextObservation] else {
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
    }
}

// 흑백 대비 높이기
func preprocessImage(_ cgImage: CGImage, _ contrast: Float) -> CGImage {
    let ciImage = CIImage(cgImage: cgImage)
    let filter = CIFilter(name: "CIColorControls")!
    filter.setValue(ciImage, forKey: kCIInputImageKey)
    filter.setValue(contrast, forKey: kCIInputContrastKey)  // 대비 증가
    let context = CIContext()
    return context.createCGImage(filter.outputImage!, from: filter.outputImage!.extent) ?? cgImage
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

// CGImage에서 지정된 사각형 영역을 잘라내기
func cropImage(_ cgImage: CGImage, to rect: NSRect) -> CGImage? {
    let croppingRect = CGRect(x: rect.origin.x, y: rect.origin.y, width: rect.width, height: rect.height)

    // CGImage에서 해당 영역을 잘라냄
    return cgImage.cropping(to: croppingRect)
}

func saveCGImageToFile(cgImage: CGImage, to path: String, type: CFString = kUTTypePNG) {
    // 파일 URL 생성
    let url = URL(fileURLWithPath: path)

    // CGImageDestination 생성
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type, 1, nil) else {
        print("파일에 이미지를 저장할 수 없습니다.")
        return
    }

    // 이미지 추가
    CGImageDestinationAddImage(destination, cgImage, nil)

    // 이미지 저장
    if !CGImageDestinationFinalize(destination) {
        print("이미지 저장에 실패했습니다.")
    } else {
        print("이미지가 파일에 저장되었습니다: \(path)")
    }
}

// 실행 부분 (클립보드에서 가져온 이미지의 특정 영역만 OCR)
if CommandLine.arguments.count >= 7 {
    // 인자를 숫자형으로 안전하게 변환
    if let x = Int(CommandLine.arguments[1]),
       let y = Int(CommandLine.arguments[2]),
       let width = Int(CommandLine.arguments[3]),
       let height = Int(CommandLine.arguments[4]),
       let contrast = Float(CommandLine.arguments[6]) {

        let debuggingMode = CommandLine.arguments[5]
        let removeR = CommandLine.arguments[7]

        let rect = NSRect(x: x, y: y, width: width, height: height)
        recognizeTextFromClipboard(inRect: rect, debuggingMode: debuggingMode, contrast: contrast, removeR: removeR)
    } else {
        print("인자가 숫자 형식이어야 합니다.")
    }
} else {
    print("인자가 부족합니다. (x, y, width, height 값을 모두 입력해야 합니다.)")
}
