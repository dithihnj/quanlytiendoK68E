// ==============================================================================
// VERCEL SERVERLESS FUNCTION: GỬI BÁO CÁO TIẾN ĐỘ & THÔNG BÁO TIN NHẮN VỀ GMAIL
// Đường dẫn API: /api/send-report
// Hỗ trợ:
//   1. Gửi báo cáo trực tiếp khi nhấn nút trên Web (type: 'progress_report')
//   2. Tự động gửi email thông báo khi sinh viên nhắn tin (type: 'chat_notification')
//   3. Tự động gửi báo cáo tiến độ cả lớp hàng tuần qua Vercel Cron (GET)
// ==============================================================================

const SUPABASE_URL = 'https://znrpuhmwhjmmgwcmenpw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_r-xHXvESEwLPTHIETaiayg_zvW7Td2-';
const DEFAULT_TEACHER_EMAIL = 'tkdark3010@gmail.com';

const getEnv = () => (typeof process !== 'undefined' && process.env) ? process.env : {};

// Hàm lấy cấu hình từ Supabase system_settings
async function getSupabaseSettings() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      const settings = {};
      data.forEach(item => { settings[item.key] = item.value; });
      return settings;
    }
  } catch (err) {
    console.error('Lỗi lấy settings từ Supabase:', err);
  }
  return {};
}

// Hàm gửi email qua các nhà cung cấp (Gmail trực tiếp, Brevo hoặc Resend)
async function sendEmailDispatch({ to, subject, html, settings }) {
  const env = getEnv();
  const gmailPass = (env.GMAIL_APP_PASSWORD || settings.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const brevoKey = env.BREVO_API_KEY || settings.BREVO_API_KEY;
  const resendKey = env.RESEND_API_KEY || settings.RESEND_API_KEY;

  // 1. ƯU TIÊN SỐ 1: Gửi trực tiếp qua Gmail SMTP (100% VÀO HỘP THƯ CHÍNH, KHÔNG BAO GIỜ VÀO SPAM/RÁC)
  if (gmailPass) {
    try {
      let nodemailer = null;
      try {
        nodemailer = require('nodemailer');
      } catch (errRequire) {
        console.warn('Chưa có thư viện nodemailer, sẽ dùng phương thức HTTP API...');
      }

      if (nodemailer) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: to,
            pass: gmailPass
          }
        });

        const info = await transporter.sendMail({
          from: `"Hệ Thống Quản Lý Đồ Án K68" <${to}>`,
          to: to,
          subject: subject,
          html: html
        });

        return { success: true, provider: 'gmail_direct', messageId: info.messageId };
      }
    } catch (e) {
      console.warn('Lỗi gửi qua Gmail SMTP trực tiếp:', e);
    }
  }

  // 2. Gửi qua Brevo (Sendinblue) API (với cấu hình chống rơi vào Spam)
  if (brevoKey) {
    try {
      const senderEmail = settings.BREVO_SENDER_EMAIL || env.BREVO_SENDER_EMAIL || to;
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Hệ Thống Quản Lý Đồ Án K68', email: senderEmail },
          to: [{ email: to }],
          replyTo: { email: to, name: 'Hệ Thống K68' },
          subject: subject,
          htmlContent: html,
          headers: {
            'X-Mailin-Tag': 'TienDoDoAnK68',
            'X-Auto-Response-Suppress': 'All'
          }
        })
      });

      const resData = await response.json();
      if (response.ok) {
        return { success: true, provider: 'brevo', data: resData };
      } else {
        console.warn('Brevo API trả về lỗi:', resData);
        return { success: false, provider: 'brevo', error: (resData && (resData.message || JSON.stringify(resData))) || 'Lỗi từ Brevo' };
      }
    } catch (e) {
      console.warn('Lỗi gọi Brevo API:', e);
      return { success: false, provider: 'brevo', error: e.message || e.toString() };
    }
  }

  return {
    success: false,
    need_key: true,
    message: 'Chưa cấu hình mã API Key (Resend hoặc Brevo) để gửi thư trực tiếp vào Gmail của bạn.'
  };
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const settings = await getSupabaseSettings();
    const env = getEnv();
    const teacherEmail = settings.TEACHER_EMAIL || env.TEACHER_EMAIL || DEFAULT_TEACHER_EMAIL;
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // =========================================================================
    // CASE 1: KÍCH HOẠT HÀNG TUẦN TỰ ĐỘNG BẰNG VERCEL CRON JOB (GET Request)
    // =========================================================================
    if (req.method === 'GET') {
      // Lấy danh sách toàn bộ sinh viên từ Supabase
      const [studentsRes, progressRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/students?select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/student_progress?select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        })
      ]);

      const students = studentsRes.ok ? await studentsRes.json() : [];
      const progressList = progressRes.ok ? await progressRes.json() : [];

      const progressMap = {};
      progressList.forEach(p => { progressMap[p.student_id] = p; });

      let rowsHtml = '';
      let totalPerc = 0;
      let completedCount = 0;
      let warningCount = 0;
      const totalCount = students.length || 24;

      students.forEach((s, idx) => {
        const p = progressMap[s.id] || {};
        const pct = p.percent || 0;
        const done = p.done_count || 0;
        const total = p.total_count || 24;
        totalPerc += pct;

        if (pct >= 80) completedCount++;
        if (pct < 30) warningCount++;

        const badgeColor = pct >= 80 ? '#16a34a' : (pct >= 50 ? '#2563eb' : (pct > 0 ? '#d97706' : '#94a3b8'));
        const statusText = pct >= 80 ? 'Hoàn thành tốt' : (pct >= 50 ? 'Đang thực hiện' : 'Cần đôn đốc');

        rowsHtml += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; font-weight: 600; font-size: 13px; color: #1e293b;">${idx + 1}. ${s.name}</td>
            <td style="padding: 10px 8px; font-family: monospace; font-size: 13px; color: #2563eb; font-weight: 600;">${s.id}</td>
            <td style="padding: 10px 8px; text-align: center;">
              <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor};">
                ${pct}% (${done}/${total})
              </span>
            </td>
            <td style="padding: 10px 8px; font-size: 12px; color: #475569; max-width: 260px;">${s.topic || 'Chưa đăng ký chính thức'}</td>
            <td style="padding: 10px 8px; font-size: 12px; color: #64748b; font-style: italic;">${statusText}</td>
          </tr>
        `;
      });

      const avgPercent = totalCount > 0 ? Math.round(totalPerc / totalCount) : 0;
      const emailSubject = `[Báo Cáo Tự Động Định Kỳ Hàng Tuần] Tiến Độ Đồ Án K68 - ${nowStr}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 24px; color: #ffffff;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">
              BÁO CÁO TỰ ĐỘNG ĐỊNH KỲ 1 TUẦN / 1 LẦN
            </div>
            <h2 style="margin: 0; font-size: 22px; font-weight: 800;">
              Tổng Hợp Tiến Độ Đồ Án Tốt Nghiệp Khóa K68
            </h2>
            <div style="font-size: 13px; color: #bae6fd; margin-top: 6px;">
              Thời gian xuất: <strong>${nowStr}</strong> &bull; Người nhận: <strong>${teacherEmail}</strong>
            </div>
          </div>

          <div style="padding: 24px;">
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Tiến độ TB lớp</div>
                <div style="font-size: 26px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${avgPercent}%</div>
              </div>
              <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Tiến độ tốt (>=80%)</div>
                <div style="font-size: 26px; font-weight: 900; color: #15803d; margin-top: 4px;">${completedCount} / ${totalCount}</div>
              </div>
              <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; color: #991b1b; font-weight: 700; text-transform: uppercase;">Cần nhắc nhở (<30%)</div>
                <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">${warningCount} SV</div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">
                  <th style="padding: 10px 8px;">Sinh viên</th>
                  <th style="padding: 10px 8px;">Mã SV</th>
                  <th style="padding: 10px 8px; text-align: center;">Tiến độ</th>
                  <th style="padding: 10px 8px;">Đề tài nghiên cứu</th>
                  <th style="padding: 10px 8px;">Đánh giá</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>

            <div style="margin-top: 24px; text-align: center;">
              <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 10px; font-size: 14px;">
                Mở Hệ Thống Quản Lý Đồ Án &rarr;
              </a>
            </div>
          </div>
        </div>
      `;

      const dispatchResult = await sendEmailDispatch({
        to: teacherEmail,
        subject: emailSubject,
        html: emailHtml,
        settings
      });

      return res.status(200).json({
        success: dispatchResult.success,
        mode: 'weekly_cron',
        recipient: teacherEmail,
        dispatchResult
      });
    }

    // =========================================================================
    // CASE 2: KÍCH HOẠT TỪ GIAO DIỆN WEB (POST Request)
    // =========================================================================
    const payload = req.body || {};
    const reqType = payload.type || 'progress_report';

    // -------------------------------------------------------------------------
    // 2A. THÔNG BÁO TIN NHẮN CHAT MỚI TỪ SINH VIÊN
    // -------------------------------------------------------------------------
    if (reqType === 'chat_notification') {
      const studentName = payload.studentName || 'Sinh viên';
      const studentId = payload.studentId || '';
      const messageText = payload.messageText || '(Không có nội dung)';
      const msgTime = payload.timestamp || nowStr;

      const chatSubject = `🔔 [Tin Nhắn Mới] Sinh viên ${studentName} (${studentId}) vừa nhắn trên web`;

      const chatHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; color: #ffffff;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">
              THÔNG BÁO TIN NHẮN TỨC THÌ
            </div>
            <h3 style="margin: 0; font-size: 20px; font-weight: 800;">
              Sinh Viên Vừa Gửi Tin Nhắn Mới
            </h3>
            <div style="font-size: 12px; color: #bae6fd; margin-top: 4px;">
              Thời gian: <strong>${msgTime}</strong>
            </div>
          </div>

          <div style="padding: 24px;">
            <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                Người gửi: <strong style="color: #1e293b; font-size: 14px;">${studentName}</strong> (MSV: <span style="font-family: monospace; color: #2563eb; font-weight: 700;">${studentId}</span>)
              </div>
              <div style="font-size: 15px; color: #0f172a; line-height: 1.5; font-style: italic; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                "${messageText}"
              </div>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 10px; font-size: 14px;">
                Vào Trả Lời Tin Nhắn Trên Web &rarr;
              </a>
            </div>
          </div>
        </div>
      `;

      const dispatchResult = await sendEmailDispatch({
        to: teacherEmail,
        subject: chatSubject,
        html: chatHtml,
        settings
      });

      return res.status(200).json({
        success: dispatchResult.success,
        mode: 'chat_notification',
        recipient: teacherEmail,
        dispatchResult
      });
    }

    // -------------------------------------------------------------------------
    // 2B. GỬI BÁO CÁO TIẾN ĐỘ TRỰC TIẾP (KHI NHẤN NÚT TRÊN WEB)
    // -------------------------------------------------------------------------
    const studentsData = payload.studentsData || [];
    let rowsHtml = '';
    let totalPercent = 0;
    let completedCount = 0;
    let warningCount = 0;
    const totalCount = studentsData.length || 24;

    studentsData.forEach((s, idx) => {
      const pct = s.percent || 0;
      totalPercent += pct;
      if (pct >= 80) completedCount++;
      if (pct < 30) warningCount++;

      const badgeColor = pct >= 80 ? '#16a34a' : (pct >= 50 ? '#2563eb' : (pct > 0 ? '#d97706' : '#94a3b8'));
      const statusText = pct >= 80 ? 'Hoàn thành tốt' : (pct >= 50 ? 'Đang thực hiện' : 'Cần đôn đốc');

      rowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-weight: 600; font-size: 13px; color: #1e293b;">${idx + 1}. ${s.name}</td>
          <td style="padding: 10px 8px; font-family: monospace; font-size: 13px; color: #2563eb; font-weight: 600;">${s.id}</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor};">
              ${pct}% (${s.done || 0}/${s.total || 24})
            </span>
          </td>
          <td style="padding: 10px 8px; font-size: 12px; color: #475569; max-width: 260px;">${s.topic || 'Đề tài tốt nghiệp'}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #64748b; font-style: italic;">${statusText}</td>
        </tr>
      `;
    });

    const avgPercent = totalCount > 0 ? Math.round(totalPercent / totalCount) : 0;
    const emailSubject = `[Báo Cáo Tiến Độ Đồ Án] Khóa K68 (2023 - 2027) - ${nowStr}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 24px; color: #ffffff;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">
            BÁO CÁO TIẾN ĐỘ TRỰC TIẾP
          </div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800;">
            Tổng Hợp Tiến Độ Đồ Án Tốt Nghiệp Khóa K68
          </h2>
          <div style="font-size: 13px; color: #bae6fd; margin-top: 6px;">
            Thời gian: <strong>${nowStr}</strong> &bull; Người nhận: <strong>${teacherEmail}</strong>
          </div>
        </div>

        <div style="padding: 24px;">
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Tiến độ TB lớp</div>
              <div style="font-size: 26px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${avgPercent}%</div>
            </div>
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Tiến độ tốt (>=80%)</div>
              <div style="font-size: 26px; font-weight: 900; color: #15803d; margin-top: 4px;">${completedCount} / ${totalCount}</div>
            </div>
            <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #991b1b; font-weight: 700; text-transform: uppercase;">Cần nhắc nhở (<30%)</div>
              <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">${warningCount} SV</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">
                <th style="padding: 10px 8px;">Sinh viên</th>
                <th style="padding: 10px 8px;">Mã SV</th>
                <th style="padding: 10px 8px; text-align: center;">Tiến độ</th>
                <th style="padding: 10px 8px;">Đề tài nghiên cứu</th>
                <th style="padding: 10px 8px;">Đánh giá</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 10px; font-size: 14px;">
              Xem Chi Tiết Trên Hệ Thống &rarr;
            </a>
          </div>
        </div>
      </div>
    `;

    const dispatchResult = await sendEmailDispatch({
      to: teacherEmail,
      subject: emailSubject,
      html: emailHtml,
      settings
    });

    return res.status(200).json({
      success: dispatchResult.success,
      mode: 'progress_report',
      recipient: teacherEmail,
      dispatchResult
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
};
