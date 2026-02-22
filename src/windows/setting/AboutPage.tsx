import { Info, Github, Facebook, Mail, AtSign, Copy, CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const AboutPage = () => {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="mt-8 space-y-8">
                <div className="flex flex-col items-center justify-center py-4">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <img src={logo} alt="App Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">AVOT <span className="text-sm font-normal text-muted-foreground">(auto-voice-over-tool)</span></h1>
                    <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                        Công cụ hỗ trợ tự động thuyết minh (Tiếng Việt) các dạng video nước ngoài. Khởi điểm là nội dung Minecraft nhưng vẫn có thể áp dụng đa dạng.
                    </p>

                    <div className="mt-8 flex flex-col items-center space-y-1">
                        <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                            Phiên bản: 1.0.0
                        </p>
                    </div>
                </div>

                {/* Author Info */}
                <div className="text-sm border-b pb-6">

                    <div className="flex flex-wrap justify-center gap-3">
                        <div className="flex items-center bg-background border rounded-md overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r" asChild>
                                <a href="https://github.com/leemjnnkdzuy" target="_blank" rel="noopener noreferrer">
                                    <AtSign className="w-4 h-4 mr-2" />
                                    leemjnnkdzuy
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-none text-muted-foreground hover:text-foreground relative"
                                onClick={() => handleCopy("https://github.com/leemjnnkdzuy", "leemjnnkdzuy")}
                                title="Copy Link"
                            >
                                {copiedId === "leemjnnkdzuy" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 animate-in fade-in zoom-in" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center bg-background border rounded-md overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r" asChild>
                                <a href="https://www.facebook.com/leemjnnkdzuy" target="_blank" rel="noopener noreferrer">
                                    <Facebook className="w-4 h-4 mr-2" />
                                    Facebook
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-none text-muted-foreground hover:text-foreground relative"
                                onClick={() => handleCopy("https://www.facebook.com/leemjnnkdzuy", "facebook")}
                                title="Copy Link"
                            >
                                {copiedId === "facebook" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 animate-in fade-in zoom-in" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center bg-background border rounded-md overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r" asChild>
                                <a href="https://github.com/leemjnnkdzuy/" target="_blank" rel="noopener noreferrer">
                                    <Github className="w-4 h-4 mr-2" />
                                    Github
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-none text-muted-foreground hover:text-foreground relative"
                                onClick={() => handleCopy("https://github.com/leemjnnkdzuy/", "github")}
                                title="Copy Link"
                            >
                                {copiedId === "github" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 animate-in fade-in zoom-in" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>

                        <div className="flex items-center bg-background border rounded-md overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r" asChild>
                                <a href="mailto:duylelv17@gmail.com">
                                    <Mail className="w-4 h-4 mr-2" />
                                    Email
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-none text-muted-foreground hover:text-foreground relative"
                                onClick={() => handleCopy("duylelv17@gmail.com", "email")}
                                title="Copy Email"
                            >
                                {copiedId === "email" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 animate-in fade-in zoom-in" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Project Info */}
                <div className="text-sm space-y-4 border-b pb-6">
                    <h3 className="font-semibold text-primary mb-2">Thông tin Dự án</h3>
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>
                            <strong>AVOT</strong> là một ứng dụng Desktop mạnh mẽ, được thiết kế để tự động hóa toàn bộ quy trình dịch thuật và thuyết minh video. Khởi điểm từ mục tiêu hỗ trợ cộng đồng làm nội dung Minecraft, ứng dụng hiện có khả năng xử lý tự động đa dạng các thể loại video khác nhau một cách mượt mà và chính xác.
                        </p>

                        <p>
                            Dự án được xây dựng dựa trên sự kiết hợp của các thư viện mã nguồn mở và nền tảng công nghệ tiên tiến nhằm đảm bảo hiệu suất xử lý tốt nhất và tính riêng tư (Offline) tuyệt đối cho người dùng cuối. Chúng tôi chân thành ghi nhận và cảm ơn các tập thể phát triển của các dự án sau:
                        </p>

                        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 mt-4 ml-2">
                            <ul className="list-disc list-inside space-y-3">
                                <li>
                                    <a href="https://www.electronjs.org/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">ElectronJS</a>: Nền tảng lõi xây dựng ứng dụng Desktop đa nền tảng.
                                </li>
                                <li>
                                    <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">React</a> & <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">Tailwind CSS</a>: Cấu trúc giao diện người dùng, mang lại trải nghiệm tương tác mượt mà.
                                </li>
                                <li>
                                    <a href="https://www.sqlite.org/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">SQLite</a>: Động cơ quản lý cơ sở dữ liệu nội bộ (Local DB), giúp lưu trữ thông tin mà không cần máy chủ ngoài.
                                </li>
                                <li>
                                    <a href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">yt-dlp</a>: Tiện ích tối ưu hoá việc tải luồng dữ liệu truyền thông đa phương tiện.
                                </li>
                            </ul>
                            <ul className="list-disc list-inside space-y-3">
                                <li>
                                    <a href="https://github.com/openai/whisper" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">OpenAI Whisper</a>: Công nghệ AI phân tích tín hiệu âm thanh và nhận dạng giọng nói đa ngôn ngữ.
                                </li>
                                <li>
                                    <a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">FFmpeg</a>: Bộ công cụ đồ sộ chuyên xử lý, chỉnh sửa và tạo mã video.
                                </li>
                                <li>
                                    <a href="https://handbrake.fr/" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline font-medium">HandBrake</a>: Trình chuyển mã video chuyên dụng, đảm bảo tỷ lệ khung hình chuẩn.
                                </li>
                                <li>
                                    <span className="text-foreground font-medium">Edge TTS</span>: Dịch vụ đám mây ảo hỗ trợ chuyển đổi văn bản sang giọng nói.
                                </li>
                            </ul>
                        </div>

                        <p className="border-t pt-4 mt-4">
                            <strong className="text-foreground">Mã nguồn (Github):</strong>{" "}
                            <a href="https://github.com/leemjnnkdzuy/auto-voice-over-tool" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">
                                https://github.com/leemjnnkdzuy/auto-voice-over-tool
                            </a>
                        </p>
                    </div>
                </div>

                {/* Terms of Use */}
                <div className="text-sm space-y-2 border-b pb-6">
                    <h3 className="font-semibold text-primary mb-2">Chính sách Sử dụng</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
                        <li>Bạn được cấp quyền sử dụng phần mềm cho mục đích cá nhân và sáng tạo nội dung của riêng mình.</li>
                        <li>Nghiêm cấm hành vi bán lại, sao chép hoặc phân phối mã nguồn/bản build của phần mềm mang tính chất thương mại nếu không được sự đồng ý của tác giả.</li>
                        <li>Người dùng tự chịu trách nhiệm hoàn toàn đối với bản quyền nội dung đầu vào (video gốc) và nội dung đầu ra (video sau khi lồng tiếng/vietsub) khi đăng tải lên các nền tảng công cộng.</li>
                        <li>Ứng dụng được cung cấp "nguyên trạng". Tác giả không chịu trách nhiệm pháp lý cho những lỗi phần mềm có thể gây xáo trộn dữ liệu của bạn, mặc dù chúng tôi luôn nỗ lực để tạo ra sản phẩm ổn định nhất.</li>
                    </ul>
                </div>

                {/* Privacy Policy */}
                <div className="text-sm space-y-2 pb-6">
                    <h3 className="font-semibold text-primary mb-2">Chính sách Bảo mật</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                        Chúng tôi vô cùng tôn trọng quyền riêng tư của bạn. Dưới đây là cách dữ liệu được xử lý:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
                        <li>Mọi video, âm thanh, text (prompt) xử lý bằng AI nội bộ (Local Whisper/Local Model) sẽ không bao giờ được gửi, thu thập hay chia sẻ lên bất kỳ máy chủ nào. Nó hoàn toàn nằm trên máy tính của bạn.</li>
                        <li>Trong trường hợp bạn sử dụng các tính năng tích hợp API Cloud (như AssemblyAI hay DeepSeek), dữ liệu nhất thiết phải được gửi tới các nền tảng đó để xử lý. Vui lòng tham khảo chính sách bảo mật của các hãng cung cấp (DeepSeek/AssemblyAI) để biết họ sử dụng dữ liệu như thế nào.</li>
                        <li>Phần mềm không đính kèm mã theo dõi (tracking, analytics) nhắm mục tiêu cá nhân hoặc đánh cắp thông tin nhạy cảm. Thư mục Database (SQLite) được lưu giữ cô lập tại thiết bị của bạn.</li>
                    </ul>
                </div>

                <div className="text-center mt-12 pt-8 border-t">
                    <p className="text-xs text-muted-foreground">
                        © 2026 Duy Le (leemjnnkdzuy). Tự hào phát hành tại Việt Nam.
                    </p>
                </div>
            </div>
        </div>
    );
};
