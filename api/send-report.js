// ==============================================================================
// VERCEL SERVERLESS FUNCTION: GỬI BÁO CÁO TIẾN ĐỘ 24 SINH VIÊN K68 VỀ GMAIL
// Đường dẫn: /api/send-report
// Hỗ trợ cả kích hoạt từ Web và kích hoạt TỰ ĐỘNG hàng tuần từ Vercel Cron Job
// ==============================================================================

module.exports = async function handler(req, res) {
  // Cho phép gọi CORS từ giao diện web
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const payload = req.method === 'POST' ? req.body : {};
    const teacherEmail = payload.teacherEmail || process.env.TEACHER_EMAIL || 'giangvien@uet.vnu.edu.vn';
    const studentsData = payload.studentsData || [];

    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    let rowsHtml = '';
    let totalPercent = 0;
    let completedCount = 0;
    const totalCount = studentsData.length || 24;

    studentsData.forEach((s, idx) => {
      const pct = s.percent || 0;
      totalPercent += pct;
      if (pct >= 80) completedCount++;

      const badgeColor = pct >= 80 ? '#16a34a' : (pct >= 50 ? '#2563eb' : (pct > 0 ? '#d97706' : '#94a3b8'));
      const statusText = pct >= 80 ? 'Tốt' : (pct >= 50 ? 'Đang làm' : 'Cần nhắc nhở');

      rowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-weight: 600; font-size: 13px; color: #1e293b;">${idx + 1}. ${s.name}</td>
          <td style="padding: 10px 8px; font-family: monospace; font-size: 13px; color: #2563eb; font-weight: 600;">${s.id}</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor};">
              ${pct}%
            </span>
          </td>
          <td style="padding: 10px 8px; font-size: 12px; color: #475569; max-width: 250px;">${s.topic || 'Đề tài tốt nghiệp'}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #64748b; font-style: italic;">${s.lastSubmitted || 'Chưa gửi báo cáo'}</td>
        </tr>
      `;
    });

    const avgPercent = totalCount > 0 ? Math.round(totalPercent / totalCount) : 0;

    const emailSubject = `[Báo Cáo Tiến Độ] Đồ Án Tốt Nghiệp Khóa K68 (2023 - 2027) - ${nowStr}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 750px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 24px; color: #ffffff;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">
            Báo Cáo Tự Động Định Kỳ
          </div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800;">
            Tổng Hợp Tiến Độ Đồ Án Khóa K68 (2023 - 2027)
          </h2>
          <div style="font-size: 13px; color: #bae6fd; margin-top: 6px;">
            Thời gian: <strong>${nowStr}</strong> &bull; Trường Đại học Công nghệ (VNU-UET)
          </div>
        </div>

        <div style="padding: 24px;">
          <!-- Thống kê nhanh -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Tiến độ TB lớp</div>
              <div style="font-size: 26px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${avgPercent}%</div>
            </div>
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Tiến độ tốt (>=80%)</div>
              <div style="font-size: 26px; font-weight: 900; color: #15803d; margin-top: 4px;">${completedCount} / ${totalCount}</div>
            </div>
          </div>

          <!-- Bảng 24 sinh viên -->
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">
                <th style="padding: 10px 8px;">Sinh viên</th>
                <th style="padding: 10px 8px;">Mã SV</th>
                <th style="padding: 10px 8px; text-align: center;">Tiến độ</th>
                <th style="padding: 10px 8px;">Tên đề tài nghiên cứu</th>
                <th style="padding: 10px 8px;">Lần nộp gần nhất</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
              Hệ Thống Quản Lý Đồ Án Tốt Nghiệp Khóa K68 (Năm học 2023 - 2027) &bull; Đại học Công nghệ (VNU-UET)
            </p>
          </div>
        </div>
      </div>
    `;

    // 1. Gửi qua Resend API nếu có RESEND_API_KEY
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'He Thong Do An K68 <onboarding@resend.dev>',
          to: teacherEmail,
          subject: emailSubject,
          html: emailHtml
        })
      });

      const resData = await response.json();
      return res.status(200).json({ success: true, method: 'resend', data: resData });
    }

    // 2. Gửi qua Brevo (Sendinblue) nếu có BREVO_API_KEY
    if (process.env.BREVO_API_KEY) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Hệ Thống Đồ Án K68', email: 'no-reply@k68doan.uet' },
          to: [{ email: teacherEmail }],
          subject: emailSubject,
          htmlContent: emailHtml
        })
      });

      const resData = await response.json();
      return res.status(200).json({ success: true, method: 'brevo', data: resData });
    }

    // Nếu chưa cấu hình API key trên Vercel, trả về mẫu HTML để client hiển thị hoặc gửi trực tiếp
    return res.status(200).json({
      success: true,
      message: 'Đã chuẩn bị nội dung báo cáo thành công. Cần cấu hình RESEND_API_KEY hoặc BREVO_API_KEY trên Vercel để gửi tự động.',
      previewHtml: emailHtml,
      teacherEmail: teacherEmail
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
};
