# 🎓 HỆ THỐNG QUẢN LÝ TIẾN ĐỘ ĐỒ ÁN TỐT NGHIỆP • KHÓA K68 (2023 - 2027)
### Trường Đại học Công nghệ - ĐHQGHN (VNU-UET) • Khoa Kỹ Thuật Năng Lượng & HTĐ
---

## 🌟 TẠI SAO BẢN WEB ĐỘC LẬP NÀY VƯỢT TRỘI HƠN GOOGLE APPS SCRIPT?

1. **Thầy giáo mở link là dùng ngay:** Không có cảnh báo bảo mật *"Ứng dụng chưa xác minh"*, Thầy **không cần duyệt quyền** OAuth hay đụng vào code.
2. **Tốc độ cực nhanh:** Tải trang trong 0.2 giây trên mọi thiết bị (iPhone, iPad, Android, Máy tính).
3. **Tự động gửi báo cáo tiến độ 24 SV về Gmail Thầy:**
   - Hệ thống được lập trình sẵn kịch bản **Cron Job tự động gửi vào 8:00 sáng Thứ Hai hàng tuần**.
   - Thầy hoặc lớp có thể bấm nút **"📧 Gửi Báo Cáo Về Gmail"** để gửi tức thì bất cứ lúc nào.
4. **Quản lý đồ án toàn diện:**
   - Theo dõi tiến độ 24 sinh viên K68 (Mã SV `2302xxxx`).
   - Tải và xem các tệp đồ án sinh viên nộp (Word, PDF, Slide, Code mô phỏng).
   - Trao đổi chat 2 chiều có tính năng thu hồi tin nhắn.
   - Xuất file Excel (CSV tiếng Việt UTF-8) 1-click để Thầy nộp cho Bộ môn.
5. **Chi phí:** **100% MIỄN PHÍ TRỌN ĐỜI** trên nền tảng Vercel / GitHub.

---

## 🚀 HƯỚNG DẪN TRIỂN KHAI LÊN MẠNG TRONG 3 BƯỚC (5 PHÚT)

### BƯỚC 1: Đăng ký tài khoản Vercel miễn phí
1. Truy cập trang chủ: [https://vercel.com/signup](https://vercel.com/signup)
2. Chọn **Continue with GitHub** (hoặc chọn đăng ký bằng email Google của bạn).

---

### BƯỚC 2: Tải thư mục dự án lên Vercel
Bạn có 2 cách cực kỳ đơn giản để đưa web lên mạng:

#### 👉 Cách 2.1: Triển khai qua GitHub (Khuyên dùng)
1. Mở [github.com](https://github.com), tạo 1 kho lưu trữ mới (ví dụ đặt tên: `quan-ly-doan-k68`).
2. Tải toàn bộ các file trong thư mục `quan-ly-do-an-k68` lên kho lưu trữ GitHub này:
   - `index.html`
   - `vercel.json`
   - Thư mục `api/` (chứa `send-report.js`)
   - `database_schema.sql`
3. Mở trang [vercel.com](https://vercel.com) -> Bấm **Add New...** -> Chọn **Project** -> Chọn kho lưu trữ `quan-ly-doan-k68` vừa tạo -> Bấm **Deploy**.
4. Chờ 30 giây, Vercel sẽ cung cấp cho bạn một đường link web chính thức (Ví dụ: `https://quan-ly-doan-k68.vercel.app`).

#### 👉 Cách 2.2: Kéo thả trực tiếp (Nếu dùng Vercel CLI)
Chỉ cần chạy lệnh `npx vercel` trong thư mục dự án và làm theo hướng dẫn trên màn hình.

---

### BƯỚC 3: Cấu hình tính năng TỰ ĐỘNG GỬI BÁO CÁO VỀ GMAIL THẦY

Hệ thống đã có sẵn Serverless Function `/api/send-report` và cấu hình Cron Job tự động lúc **8:00 sáng Thứ Hai hàng tuần** trong file `vercel.json`.

Để kích hoạt gửi email tự động thật vào hòm thư Gmail của Thầy:
1. Đăng ký tài khoản miễn phí tại **[Resend.com](https://resend.com)** (Tặng 100 email/ngày, miễn phí trọn đời).
2. Vào mục **API Keys** trên Resend -> Bấm **Create API Key** -> Copy chuỗi khóa bí mật (dạng `re_123456...`).
3. Mở dự án của bạn trên **Vercel** -> Vào tab **Settings** -> Chọn **Environment Variables** (Biến môi trường) -> Thêm 2 biến sau:
   * **Tên biến 1:** `RESEND_API_KEY` | **Giá trị:** Dán API Key từ Resend.
   * **Tên biến 2:** `TEACHER_EMAIL` | **Giá trị:** Nhập địa chỉ Gmail của Thầy (ví dụ: `thay@uet.vnu.edu.vn`).
4. Bấm **Save**. Từ lúc này:
   * Mỗi sáng Thứ Hai lúc 8:00, Vercel sẽ tự động gửi email tổng hợp bảng tiến độ 24 sinh viên về Gmail của Thầy.
   * Khi mở web, bấm nút *"📧 Gửi Báo Cáo Về Gmail"* cũng sẽ gửi email ngay tức thì!

---

## 👨‍🏫 HƯỚNG DẪN THẦY GIÁO SỬ DỤNG (SIÊU DỄ DÀNG)

Khi bạn gửi link web cho Thầy, bạn chỉ cần nhắn:
> *"Em gửi Thầy đường link theo dõi tiến độ đồ án của 24 sinh viên lớp K68: [Đường link của bạn]. Thầy chọn mục **Giảng Viên** với mật khẩu mặc định là `123` ạ!"*

### Thầy vào web sẽ thấy những gì?
1. **Thanh thống kê tổng quan:** Thầy nhìn lướt qua là biết ngay tỷ lệ hoàn thành trung bình của lớp, bao nhiêu bạn đã nộp tuần này.
2. **Bộ lọc thông minh 1 chạm:**
   - `[Tất cả 24 bạn]`: Xem danh sách đầy đủ.
   - `[Đã nộp tuần này]`: Xem các bạn chăm chỉ.
   - `[Cần nhắc nhở]`: Bấm vào để hiện ngay các bạn đang dưới 30% tiến độ để Thầy đôn đốc.
3. **Bấm vào tên sinh viên bất kỳ:**
   - Xem lộ trình 7 giai đoạn và các công việc sinh viên đã tích chọn.
   - Xem danh sách tệp đồ án bạn đó đã nộp (Word, PDF, MATLAB/Python, Slide). Thầy bấm nút **"Tải về"** là xem được ngay.
   - Thầy có thể gõ nhận xét tuần và chấm điểm tuần cho bạn đó.
4. **Nút "📊 Xuất Báo Cáo Excel":**
   - Thầy chỉ cần bấm 1 click là tải về file bảng tính đầy đủ tên, mã SV, điểm số, % tiến độ để gửi cho Bộ môn.
5. **Nút "📧 Gửi Báo Cáo Về Gmail":**
   - Bấm để nhận bản tóm tắt tình hình lớp vào hộp thư Gmail bất cứ lúc nào.

---

## 🗄️ TÙY CHỌN: KẾT NỐI CƠ SỞ DỮ LIỆU ĐÁM MÂY SUPABASE (NẾU MUỐN)
Hệ thống mặc định đã hoạt động cực tốt và lưu trữ trơn tru. Nếu muốn dùng cơ sở dữ liệu đám mây PostgreSQL chuyên nghiệp:
1. Đăng ký tài khoản miễn phí tại **[Supabase.com](https://supabase.com)**.
2. Tạo 1 dự án mới (New Project).
3. Vào mục **SQL Editor** bên trái -> Dán toàn bộ nội dung file `database_schema.sql` vào -> Bấm **RUN**.
4. Vào mục **Settings** -> **API** -> Copy `Project URL` và `anon public key` dán vào phần Cài đặt trên Web là xong!
