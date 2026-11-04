-- ==============================================================================
-- CƠ SỞ DỮ LIỆU SUPABASE: HỆ THỐNG QUẢN LÝ TIẾN ĐỘ ĐỒ ÁN KHÓA K68 (2023 - 2027)
-- Trường Đại học Công nghệ - ĐHQGHN (VNU-UET)
-- Hướng dẫn: Mở Supabase -> SQL Editor -> Dán toàn bộ đoạn mã này vào -> Bấm RUN
-- ==============================================================================

-- 1. BẢNG DANH SÁCH 24 SINH VIÊN K68
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(20) PRIMARY KEY,
  stt INT,
  name VARCHAR(100) NOT NULL,
  gpa NUMERIC(3,2),
  topic TEXT,
  password VARCHAR(100) DEFAULT '123456',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG TIẾN ĐỘ & CHECKLIST LỘ TRÌNH TỪNG SINH VIÊN
CREATE TABLE IF NOT EXISTS student_progress (
  student_id VARCHAR(20) PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  percent INT DEFAULT 0,
  done_count INT DEFAULT 0,
  total_count INT DEFAULT 24,
  checked_tasks JSONB DEFAULT '{}'::jsonb,
  custom_roadmap JSONB DEFAULT '[]'::jsonb,
  last_submitted TIMESTAMPTZ,
  last_access TIMESTAMPTZ,
  student_note TEXT DEFAULT '',
  teacher_feedback TEXT DEFAULT '',
  teacher_grade VARCHAR(20) DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BẢNG TỆP TIN ĐỒ ÁN DO SINH VIÊN NỘP
CREATE TABLE IF NOT EXISTS student_files (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(20) REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(100),
  file_name TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'Bản thảo đồ án',
  file_size VARCHAR(50),
  file_url TEXT NOT NULL,
  note TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG TIN NHẮN CHAT (GV - SV) KÈM TRẠNG THÁI THU HỒI
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(20) REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(100),
  sender_role VARCHAR(20) NOT NULL, -- 'teacher' hoặc 'student'
  sender_name VARCHAR(100),
  message_text TEXT NOT NULL,
  is_recalled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BẢNG CẤU HÌNH HỆ THỐNG & EMAIL CỦA GIẢNG VIÊN
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- THÊM DỮ LIỆU CẤU HÌNH MẶC ĐỊNH
INSERT INTO system_settings (key, value) VALUES
  ('TEACHER_PASSWORD', '123'),
  ('TEACHER_EMAIL', 'giangvien@uet.vnu.edu.vn'),
  ('EMAIL_AUTO_NOTIFY', 'true'),
  ('CRON_WEEKLY_ENABLED', 'true')
ON CONFLICT (key) DO NOTHING;

-- THÊM DỮ LIỆU 24 SINH VIÊN K68
INSERT INTO students (stt, id, name, gpa, topic) VALUES
  (1, '23020452', 'Trần Gia Bình', 2.98, 'Điện mặt trời'),
  (2, '23020460', 'Nguyễn Thành Đạt', 2.94, 'Kiểm toán năng lượng kết hợp phân tích dữ liệu, tối ưu hóa hiệu suất năng lượng và quản lý năng lượng thông minh.'),
  (3, '23020476', 'Dương Thuỳ Linh', 2.85, 'Kiểm toán năng lượng'),
  (4, '23020501', 'Đặng Duy Thịnh', 2.81, 'Kiểm toán năng lượng'),
  (5, '23020461', 'Nguyễn Thành Đạt', 2.78, 'Điện mặt trời'),
  (6, '23020505', 'Phạm Huy Hoàng Vũ', 2.77, 'Nhiệt'),
  (7, '23020467', 'Phạm Huy Hoàng', 2.75, 'Điện mặt trời / Điện gió'),
  (8, '23020499', 'Lê Duy Thái', 2.72, 'Kiểm toán năng lượng'),
  (9, '23020506', 'Trần Nho Long Vũ', 2.63, 'Ứng dụng IoT và AI trong quản lý năng lượng các công trình'),
  (10, '23020484', 'Dương Tuấn Phong', 2.61, 'Kiểm toán năng lượng'),
  (11, '23020478', 'Nguyễn Hải Long', 2.61, 'Điện mặt trời'),
  (12, '23020463', 'Nguyễn Xuân Hoàng Hà', 2.57, 'Điện mặt trời'),
  (13, '23020477', 'Bùi Đức Long', 2.53, 'Thiết kế hệ thống IoT giám sát và điều độ phụ tải tối ưu hóa chi phí điện năng theo biểu giá cao điểm mới'),
  (14, '23020462', 'Phạm Công Đoàn', 2.51, 'Chưa đăng ký chính thức'),
  (15, '23020480', 'Hoàng Hữu Ngọc Minh', 2.50, 'Đánh giá hiệu quả năng lượng và xây dựng hệ thống quản lý năng lượng cho các công trình'),
  (16, '23020465', 'Trần Đức Hòa', 2.48, 'Điện mặt trời'),
  (17, '23020470', 'Nguyễn Công Huy', 2.48, 'Kiểm toán năng lượng trong các nhà máy công nghiệp, điện/pin mặt trời'),
  (18, '23020500', 'Trần Bá Thành', 2.42, 'Kiểm toán năng lượng'),
  (19, '23020464', 'Bùi Thế Hiếu', 2.41, 'Kiểm toán và đưa ra các giải pháp sử dụng điện hiệu quả cho các hệ thống điện lớn'),
  (20, '23020466', 'Nguyễn Duy Hoàng', 2.38, 'Kiểm toán năng lượng'),
  (21, '23020481', 'Nguyễn Bình Minh', 2.38, 'Hành vi tiết kiệm năng lượng'),
  (22, '23020469', 'Đoàn Quang Huy', 2.15, 'Kiểm toán năng lượng và đề xuất giải pháp tiết kiệm năng lượng cho nhà máy'),
  (23, '23020482', 'Nguyễn Mậu Hoàng Minh', 2.08, 'Kiểm toán năng lượng trong các toà nhà, khu công nghiệp, khu nghỉ dưỡng'),
  (24, '23020471', 'Nguyễn Văn Huy', 2.23, 'Kiểm toán năng lượng')
ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic, name = EXCLUDED.name;

-- KHỞI TẠO TIẾN ĐỘ BAN ĐẦU CHO 24 SINH VIÊN
INSERT INTO student_progress (student_id, percent, done_count, total_count)
SELECT id, 0, 0, 24 FROM students
ON CONFLICT (student_id) DO NOTHING;

-- BẬT REALTIME CHO BẢNG CHAT VÀ TIẾN ĐỘ
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE student_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE student_files;
