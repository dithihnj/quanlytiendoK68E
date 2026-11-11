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
        // Tài khoản Gmail dùng để phát thư (mặc định tkdark3010@gmail.com - tài khoản có App Password)
        const senderEmail = env.GMAIL_SENDER_EMAIL || settings.GMAIL_SENDER_EMAIL || 'tkdark3010@gmail.com';

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: senderEmail,
            pass: gmailPass
          }
        });

        const info = await transporter.sendMail({
          from: `"Hệ Thống Quản Lý Đồ Án K68" <${senderEmail}>`,
          to: to,
          replyTo: senderEmail,
          subject: subject,
          text: `${subject}\n\nBáo cáo tiến độ đồ án tốt nghiệp Khóa K68.\nĐịa chỉ nhận: ${to}\nXem chi tiết tại: https://quanlytiendok68e.vercel.app/`,
          html: html,
          headers: {
            'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
          }
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

// ==============================================================================
// HÀM TỔNG HỢP & PHÁT BẢN TIN 7:00 SÁNG CỐ ĐỊNH HÀNG NGÀY VỀ GMAIL CỦA THẦY
// ==============================================================================
async function generateAndSendDailyDigest({ teacherEmail, settings, clientMessages, nowStr }) {
  try {
    let pendingList = [];
    if (settings && settings.PENDING_STUDENT_MESSAGES_FOR_DIGEST) {
      try {
        const parsed = JSON.parse(settings.PENDING_STUDENT_MESSAGES_FOR_DIGEST);
        if (Array.isArray(parsed)) pendingList = parsed;
      } catch (e) {}
    }

    if (Array.isArray(clientMessages) && clientMessages.length > 0) {
      pendingList = pendingList.concat(clientMessages);
    }

    // Nếu hàng đợi trống, thử lấy từ bảng chat_messages trong 24h qua
    if (pendingList.length === 0) {
      try {
        const sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?sender_role=eq.student&created_at=gte.${sinceTime}&order=created_at.asc`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            pendingList = rows.map(r => ({
              studentId: r.student_id,
              studentName: r.student_name || 'Sinh viên',
              cohort: 'Sinh viên',
              phone: '',
              email: '',
              text: r.message_text || '',
              timestamp: r.created_at ? new Date(r.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : nowStr
            }));
          }
        }
      } catch (errDb) {
        console.warn("Lỗi đọc chat_messages trong 24h:", errDb);
      }
    }

    if (pendingList.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Hiện không có tin nhắn mới nào từ sinh viên trong 24 giờ qua cần phát bản tin 7:00 sáng.'
      };
    }

    // Trích xuất danh bạ từ THESIS_STUDENTS_CONTACTS và REGULAR_STUDENTS_LIST
    let thesisContacts = {};
    if (settings && settings.THESIS_STUDENTS_CONTACTS) {
      try { thesisContacts = JSON.parse(settings.THESIS_STUDENTS_CONTACTS) || {}; } catch (e) {}
    }
    let regularStudents = [];
    if (settings && settings.REGULAR_STUDENTS_LIST) {
      try { regularStudents = JSON.parse(settings.REGULAR_STUDENTS_LIST) || []; } catch (e) {}
    }

    // Nhóm tin nhắn theo từng sinh viên
    const byStudent = {};
    pendingList.forEach(item => {
      const sId = item.studentId || 'Chưa rõ MSV';
      if (!byStudent[sId]) {
        const matchedReg = regularStudents.find(rs => rs.id === sId) || {};
        const matchedThesis = thesisContacts[sId] || {};

        const resolvedPhone = item.phone && item.phone !== 'Chưa có' && item.phone !== 'Chưa cập nhật' 
          ? item.phone 
          : (matchedThesis.phone || matchedReg.phone || '');
        const resolvedEmail = item.email && item.email !== 'Chưa có' && item.email !== 'Chưa cập nhật' 
          ? item.email 
          : (matchedThesis.email || matchedReg.email || '');

        byStudent[sId] = {
          id: sId,
          name: item.studentName || matchedReg.name || 'Sinh viên',
          cohort: item.cohort || matchedReg.course || 'Sinh viên',
          phone: resolvedPhone,
          email: resolvedEmail,
          messages: []
        };
      }
      byStudent[sId].messages.push({
        text: item.text,
        time: item.timestamp || nowStr
      });
    });

    const studentList = Object.values(byStudent);
    const totalMessages = pendingList.length;
    const studentCount = studentList.length;

    let studentsCardsHtml = '';
    studentList.forEach((s, idx) => {
      let msgsHtml = '';
      s.messages.forEach(m => {
        msgsHtml += `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;">
            <div style="font-size: 14px; color: #0f172a; line-height: 1.5; font-style: italic;">
              "${m.text}"
            </div>
            <div style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 4px;">
              🕒 ${m.time}
            </div>
          </div>
        `;
      });

      const phoneLink = s.phone ? `<a href="tel:${s.phone}" style="color: #2563eb; text-decoration: none; font-weight: 700;">📞 ${s.phone}</a>` : `<span style="color: #94a3b8; font-style: italic;">Chưa có SĐT</span>`;
      const emailLink = s.email ? `<a href="mailto:${s.email}" style="color: #7c3aed; text-decoration: none; font-weight: 700;">✉️ ${s.email}</a>` : `<span style="color: #94a3b8; font-style: italic;">Chưa có Email</span>`;

      studentsCardsHtml += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 15px; font-weight: 800; color: #0f172a;">${idx + 1}. ${s.name}</span>
              <span style="display: inline-block; background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-left: 6px; font-family: monospace;">MSV: ${s.id}</span>
              <span style="font-size: 12px; color: #64748b; margin-left: 6px;">(${s.cohort})</span>
            </div>
            <div style="font-size: 12px;">
              ${phoneLink} &bull; ${emailLink}
            </div>
          </div>
          <div>${msgsHtml}</div>
        </div>
      `;
    });

    const emailSubject = `📬 [Bản Tin 7:00 Sáng] Tổng Hợp ${totalMessages} Tin Nhắn Mới Từ ${studentCount} Sinh Viên (${nowStr})`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); padding: 26px; color: #ffffff;">
          <div style="display: inline-block; padding: 4px 10px; background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
            BẢN TIN ĐỊNH KỲ 7:00 SÁNG HÀNG NGÀY
          </div>
          <h2 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
            Tổng Hợp Tin Nhắn Sinh Viên Gửi Thầy
          </h2>
          <div style="font-size: 13px; color: #93c5fd; margin-top: 6px;">
            Khoa Vật Lý Kỹ Thuật và Công Nghệ Nano &bull; Đại học Công nghệ (VNU-UET)
          </div>
          <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">
            Thời gian phát bản tin: <strong>${nowStr}</strong> &bull; Hộp thư nhận: <strong>${teacherEmail}</strong>
          </div>
        </div>

        <div style="padding: 24px;">
          <!-- METRICS CARDS -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Số SV Nhắn Tin</div>
              <div style="font-size: 28px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${studentCount}</div>
            </div>
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Tổng Tin Nhắn Mới</div>
              <div style="font-size: 28px; font-weight: 900; color: #15803d; margin-top: 4px;">${totalMessages}</div>
            </div>
            <div style="flex: 1; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 14px; text-align: center;">
              <div style="font-size: 11px; color: #6b21a8; font-weight: 700; text-transform: uppercase;">Chu kỳ gửi</div>
              <div style="font-size: 14px; font-weight: 800; color: #7e22ce; margin-top: 10px;">7:00 Sáng Cố Định</div>
            </div>
          </div>

          <!-- GROUPED MESSAGES -->
          <div>
            ${studentsCardsHtml}
          </div>

          <!-- CTA BUTTON -->
          <div style="margin-top: 24px; text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 800; border-radius: 12px; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4);">
              Mở Hệ Thống Trả Lời Tin Nhắn Trên Web &rarr;
            </a>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
              Bản tin được tổng hợp tự động mỗi ngày 1 lần vào 7:00 sáng để đảm bảo hộp thư của Thầy luôn tinh gọn và không bị ngập email.
            </div>
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

    if (dispatchResult.success) {
      // Xóa sạch hàng đợi tin nhắn sau khi đã gửi thành công
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/system_settings`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            key: 'PENDING_STUDENT_MESSAGES_FOR_DIGEST',
            value: JSON.stringify([]),
            updated_at: new Date().toISOString()
          })
        });
      } catch (errClear) {
        console.warn("Lỗi dọn dẹp hàng đợi sau khi gửi bản tin:", errClear);
      }
    }

    return {
      success: dispatchResult.success,
      mode: 'daily_digest',
      count: totalMessages,
      studentCount,
      recipient: teacherEmail,
      message: `Đã phát bản tin 7:00 sáng thành công tới ${teacherEmail} (${totalMessages} tin nhắn từ ${studentCount} sinh viên).`,
      dispatchResult
    };
  } catch (err) {
    console.error("Lỗi generateAndSendDailyDigest:", err);
    return { success: false, error: err.message };
  }
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
    const payload = (req.method === 'POST' && req.body) ? req.body : {};
    const teacherEmail = payload.teacherEmail || settings.TEACHER_EMAIL || env.TEACHER_EMAIL || DEFAULT_TEACHER_EMAIL;
    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // =========================================================================
    // CASE 1: KÍCH HOẠT TỰ ĐỘNG BẰNG VERCEL CRON JOB (GET Request)
    // =========================================================================
    if (req.method === 'GET') {
      const action = (req.query && req.query.action) || 'daily_digest';
      
      // Mặc định Cron 0 0 * * * (07:00 AM VN) sẽ gửi Bản Tin Tổng Hợp Tin Nhắn Sinh Viên
      if (action === 'daily_digest') {
        const digestResult = await generateAndSendDailyDigest({ teacherEmail, settings, clientMessages: [], nowStr });
        return res.status(200).json(digestResult);
      }

      // Nếu action=weekly: Tổng hợp bảng tiến độ cả lớp hàng tuần
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
    const reqType = payload.type || 'progress_report';

    // -------------------------------------------------------------------------
    // 2A. BẢN TIN TỔNG HỢP 7:00 SÁNG CỐ ĐỊNH (KÍCH HOẠT THỦ CÔNG HOẶC TỰ ĐỘNG)
    // -------------------------------------------------------------------------
    if (reqType === 'daily_digest') {
      const clientMessages = payload.clientMessages || [];
      const digestResult = await generateAndSendDailyDigest({ teacherEmail, settings, clientMessages, nowStr });
      return res.status(200).json(digestResult);
    }

    // -------------------------------------------------------------------------
    // 2B. NẾU CÓ REQUEST CHAT_NOTIFICATION: GOM VÀO HÀNG ĐỢI (KHÔNG GỬI EMAIL TỨC THÌ ĐỂ TRÁNH SPAM)
    // -------------------------------------------------------------------------
    if (reqType === 'chat_notification') {
      try {
        let curPending = [];
        if (settings && settings.PENDING_STUDENT_MESSAGES_FOR_DIGEST) {
          try { curPending = JSON.parse(settings.PENDING_STUDENT_MESSAGES_FOR_DIGEST); } catch (e) {}
        }
        curPending.push({
          studentName: payload.studentName || 'Sinh viên',
          studentId: payload.studentId || '',
          cohort: payload.cohort || 'Sinh viên',
          phone: payload.phone || '',
          email: payload.email || '',
          text: payload.messageText || '',
          timestamp: payload.timestamp || nowStr
        });
        await fetch(`${SUPABASE_URL}/rest/v1/system_settings`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            key: 'PENDING_STUDENT_MESSAGES_FOR_DIGEST',
            value: JSON.stringify(curPending),
            updated_at: new Date().toISOString()
          })
        });
      } catch (e) {}

      return res.status(200).json({
        success: true,
        mode: 'queued_for_daily_digest',
        message: 'Tin nhắn đã được gom vào Bản Tin 7:00 Sáng gửi về Thầy (không spam email tức thì).'
      });
    }

    // -------------------------------------------------------------------------
    // 2B. GỬI THÔNG BÁO TỰ ĐỘNG TỚI TOÀN THỂ SINH VIÊN (QUA EMAIL)
    // -------------------------------------------------------------------------
    if (reqType === 'broadcast_announcement') {
      const title = payload.title || 'Thông báo từ Giáo viên Chủ nhiệm';
      const content = payload.content || '';
      const recipients = Array.isArray(payload.recipients) ? payload.recipients : (payload.recipients ? [payload.recipients] : []);
      const targetGroupName = payload.targetGroupName || 'Toàn thể sinh viên';

      if (recipients.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách email người nhận trống!' });
      }

      let sentCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const recipientEmail of recipients) {
        const cleanEmail = (recipientEmail || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@')) continue;

        const emailSubject = `📢 [Thông Báo GVCN] ${title}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 24px; color: #ffffff;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">
                THÔNG BÁO TỪ GIÁO VIÊN CHỦ NHIỆM &bull; KHOA KỸ THUẬT NĂNG LƯỢNG
              </div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">
                ${title}
              </h2>
              <div style="font-size: 12px; color: #bae6fd; margin-top: 6px;">
                Gửi tới: <strong>${cleanEmail}</strong> (${targetGroupName}) &bull; Thời gian: <strong>${nowStr}</strong>
              </div>
            </div>

            <div style="padding: 26px;">
              <div style="font-size: 15px; line-height: 1.7; color: #1e293b; background: #f8fafc; border-left: 4px solid #0284c7; padding: 18px 20px; border-radius: 8px; white-space: pre-wrap;">${content}</div>

              <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>Giáo viên Chủ nhiệm</strong><br>
                  <span style="font-size: 12px; color: #94a3b8;">Hệ Thống Quản Lý Đào Tạo & Nghiên Cứu • VNU-UET</span>
                </div>
                <div style="text-align: right;">
                  <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 8px 16px; background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 12px;">
                    Truy Cập Hệ Thống &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        `;

        try {
          const resDispatch = await sendEmailDispatch({
            to: cleanEmail,
            subject: emailSubject,
            html: emailHtml,
            settings
          });
          if (resDispatch.success) {
            sentCount++;
          } else {
            failedCount++;
            errors.push({ email: cleanEmail, error: resDispatch.message || 'Không gửi được' });
          }
        } catch (errOne) {
          failedCount++;
          errors.push({ email: cleanEmail, error: errOne.message });
        }
      }

      return res.status(200).json({
        success: sentCount > 0,
        mode: 'broadcast_announcement',
        total: recipients.length,
        sentCount,
        failedCount,
        errors
      });
    }

    // -------------------------------------------------------------------------
    // 2C. GỬI EMAIL KHÔI PHỤC MẬT KHẨU CHO SINH VIÊN
    // -------------------------------------------------------------------------
    if (reqType === 'password_reset') {
      const studentEmail = (payload.email || '').trim();
      const studentName = payload.name || 'Sinh viên';
      const studentId = payload.studentId || '';
      const resetPassword = payload.newPassword || '';

      if (!studentEmail) {
        return res.status(400).json({ success: false, message: 'Thiếu email nhận khôi phục mật khẩu!' });
      }

      const emailSubject = `🔑 [Khôi Phục Mật Khẩu] Hệ Thống Đào Tạo - Sinh viên ${studentName} (${studentId})`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #1e3a8a, #0284c7); padding: 22px; color: #ffffff;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700;">
              YÊU CẦU KHÔI PHỤC MẬT KHẨU
            </div>
            <h2 style="margin: 6px 0 0; font-size: 20px; font-weight: 800;">
              Cấp Lại Mật Khẩu Đăng Nhập
            </h2>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Xin chào <strong>${studentName}</strong> (Mã SV: <strong style="font-family: monospace; color: #2563eb;">${studentId}</strong>),
            </p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Bạn hoặc quản trị viên vừa thực hiện yêu cầu cấp lại mật khẩu đăng nhập trên Hệ Thống Quản Lý Đào Tạo.
            </p>
            <div style="background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 10px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="font-size: 12px; color: #1e40af; font-weight: 600; text-transform: uppercase;">Mật Khẩu Mới Của Bạn:</div>
              <div style="font-size: 24px; font-weight: 900; color: #1d4ed8; font-family: monospace; letter-spacing: 2px; margin-top: 6px;">
                ${resetPassword}
              </div>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Vui lòng đăng nhập và đổi lại mật khẩu mới ngay trong mục <em>🔑 Đổi MK</em> để đảm bảo an toàn tài khoản.
            </p>
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://quanlytiendok68e.vercel.app/" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 10px; font-size: 14px;">
                Đăng Nhập Ngay &rarr;
              </a>
            </div>
          </div>
        </div>
      `;

      const dispatchResult = await sendEmailDispatch({
        to: studentEmail,
        subject: emailSubject,
        html: emailHtml,
        settings
      });

      return res.status(200).json({
        success: dispatchResult.success,
        mode: 'password_reset',
        recipient: studentEmail,
        dispatchResult
      });
    }

    // -------------------------------------------------------------------------
    // 2D. GỬI BÁO CÁO TIẾN ĐỘ TRỰC TIẾP (KHI NHẤN NÚT TRÊN WEB)
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
