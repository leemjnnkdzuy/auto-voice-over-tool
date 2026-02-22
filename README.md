<div align="center">

# AVOT - AUTO VOICE OVER TOOL

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC.svg?logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-61DAFB.svg?logo=react&logoColor=black)](#)
[![Electron](https://img.shields.io/badge/Electron-47848F.svg?logo=electron&logoColor=white)](#)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-007808.svg?logo=ffmpeg&logoColor=white)](#)
[![HandBrake](https://img.shields.io/badge/HandBrake-111111.svg?logo=handbrake&logoColor=white)](#)
[![Whisper](https://img.shields.io/badge/Whisper-10A37F.svg?logo=openai&logoColor=white)](#)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-FF0000.svg?logo=youtube&logoColor=white)](#)

*Một giải pháp toàn diện để tải, trích xuất, dịch thuật và lồng tiếng tự động cho các video đa phương tiện.*

</div>

---

## 1. Công dụng và Mục đích sử dụng

**AVOT** là một phần mềm Desktop (máy tính) ưu việt được xây dựng nhằm tự động hóa hoàn toàn quy trình xử lý video đa ngôn ngữ. 

**Những tính năng và công dụng chính bao gồm:**
- **Tự động hóa hoàn toàn:** Nhận link gốc (như YouTube), phần mềm tự động tải video, tách âm thanh, nhận diện giọng đọc để tạo phụ đề (SRT), dịch thuật và lồng một giọng đọc AI mới.
- **Sản xuất nội dung đa ngôn ngữ:** Phù hợp cho các nhà sáng tạo nội dung muốn đẩy mạnh video của mình ra toàn cầu, hỗ trợ đa dạng ngôn ngữ như Tiếng Anh, Nhật, Trung, Pháp, Đức,...
- **Lồng tiếng chuyên nghiệp (Edge TTS):** Cung cấp các giọng đọc có chất lượng cao và tự nhiên, hỗ trợ tự động canh chỉnh khoảng cách, tăng hoặc giảm tốc độ đọc để khớp với khẩu hình gốc.
- **Chất lượng hiển thị và đồng bộ:** Khắc phục triệt để vấn đề lệch âm thanh (Audio Sync) bằng việc sử dụng HandBrake để thiết lập Constant Framerate (CFR) sau bước ghép video.

---

## 2. Kiến trúc & Thành phần cốt lõi (Components)

Hệ thống được chia sẻ thành các module độc lập, với Flow xử lý đi theo một luồng nhất quán (Pipeline):

1. **Download Phase:** Chịu trách nhiệm lấy video và audio gốc thông qua tiến trình con gọi `yt-dlp`.
2. **Transcribe Phase:** Trích xuất lời thoại từ video thông qua AI Whisper cục bộ. Tự động chia các mốc thời gian hoàn hảo.
3. **Translate Phase:** Cung cấp giao diện dịch phụ đề nhanh chóng thông qua các API dịch ngoại vi. Rất mạnh mẽ với những yêu cầu chuyên ngành (Ví dụ: tự cấu hình prompt dịch các thuật ngữ Game, chuyên ngành y tế,...).
4. **TTS Phase (Text-to-Speech):** Sử dụng dịch vụ Edge TTS (`msedge-tts`) nhằm biến văn bản đã dịch thành các file âm thanh (`mp3`) tương ứng với từng mốc thời gian phụ đề.
5. **Final Video Phase:** Ghép nối các file âm thanh với video gốc. Xử lý khoảng trống (gap), chèn âm thanh nền, re-encode đồng bộ thông qua GPU NVENC, đảm bảo không có khung hình chết (frozen frames).

---

## 3. Quản lý Tệp thực thi (Bin)

Để đảm bảo hiệu suất tốt nhất, ứng dụng tải sẵn và thao tác qua các phần mềm phần cứng ngoại vi (được lưu tại thư mục `bin/`):

- **`bin/yt-dlp`**: Tiện ích command-line mã nguồn mở, phục vụ việc tải video chất lượng cao từ nhiều nền tảng.
- **`bin/ffmpeg`**: Công cụ vạn năng cắt ghép, xuất âm thanh, và re-encode video sử dụng nhân NVENC cho tốc độ cực cao.
- **`bin/handbrake` (HandBrakeCLI)**: Chuyên trách re-render lần cuối (Constant Framerate) để phòng ngừa tuyệt đối tình trạng trễ tiếng (desync).
- **`bin/whisper-cpu` & `bin/whisper-gpu`**: Native engine phân tích giọng hát/nói thành văn bản của *ggml-org*. Bản GPU sử dụng kiến trúc CUDA để đẩy nhanh thời gian Transcribe tới mức tối đa (Real-time hoặc nhanh hơn).
- **`bin/models`**: Khu vực lưu trữ file AI model nhận diện, điển hình nhất là `ggml-base.bin`.

---

## 4. Công nghệ & Thư viện (Technologies)

Dự án áp dụng mô hình kiến trúc hai chiều của Electron kết hợp cùng các công nghệ hiện đại nhất:
- **Core App Framework:** Electron v40 (Node.js).
- **Frontend Framework:** React 19, TypeScript, kết hợp Vite.
- **Thiết kế Giao diện (UI/UX):** Tailwind CSS v4, shadcn/ui.
- **Database cục bộ:** Better-sqlite3 đi kèm mã hóa ciphers.
- **Xử lý hội thoại:** API Microsoft Edge TTS (`msedge-tts`), Parse phụ đề (`srt-utils`).
- **Terminal Parsing:** Child Process (`spawn`) chạy script liên kết với hệ thống Windows PowerShell.

---

## 5. Hướng dẫn Cài đặt

**Yêu cầu hệ thống:**
- Node.js bản 20 trở lên.
- Card đồ họa NVIDIA hỗ trợ CUDA và công nghệ NVENC (Khuyến nghị để ứng dụng chạy mượt mà).

**Các bước cài đặt cục bộ:**

**Bước 1:** Tải mã nguồn về thư mục làm việc:
```bash
git clone <repository_url>
cd mc
```

**Bước 2:** Khôi phục các thư viện:
```bash
npm install
```

**Bước 3:** Chạy chương trình trong chế độ phát triển:
```bash
npm start
```
> **Lưu ý:** Trong lần khởi động đầu tiên, `EnvironmentService` của hệ thống sẽ mất một khoảng thời gian để tự động tải về các tệp nhị phân bị thiếu (khoảng hơn 300MB đối với FFmpeg, HandBrake, yt-dlp, Whisper và Models AI).

**Bước 4:** Đóng gói chương trình ra bộ cài đặt chạy độc lập (`.exe`):
```bash
npm run make
```

---

## 6. Hướng dẫn Sử dụng (Usage Workflow)

Để có được một video thành phẩm chất lượng nhất, bạn hãy làm theo các chỉ dẫn chuẩn bị môi trường sau:

1. Thiết lập Key API nếu bạn chuẩn bị sử dụng chức năng Dịch Thuật tự động bằng cách nhấn vào mục **API Key** ở Menu trên cùng.
2. Tạo mới một **Project** bằng nút "Tạo Project". Chọn đường dẫn lưu trữ trên ổ đĩa sao cho có đủ dung lượng rỗng (ít nhất 2GB).
3. Ấn vào thư mục Project để đi vào khu vực xử lý tiến trình:
   - Điền Link cấu hình Video và trích xuất.
   - Run tiến trình Whisper để ra dòng timeline phụ đề.
   - Run tiến trình dịch thuật, hoặc click thẳng vào từng dòng chữ để chỉnh sửa văn phong theo ý cá nhân.
   - Run sinh giọng đọc AI (Hệ thống cung cấp hơn 10 Voice Name của từng quốc gia khác nhau).
   - Cuối cùng, run mục "Tạo video Final" - vui lòng đợi quá trình NVENC và HandBrake tái lập khung hình. 
4. Truy xuất video đã lồng tiếng thành công tại thư mục `[Tên Project]/final/final_video_synced.mp4`.

---

<div align="center">
  <sub>Mã nguồn và ứng dụng được phát triển bởi leemjnnkdzuy (duylelv17@gmail.com).</sub>
</div>
