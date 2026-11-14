/* ข้อมูลตัวอย่าง (ชื่อสมมติ) — ใช้ปุ่ม "นำเข้าข้อมูลตัวอย่าง" ในหน้าตั้งค่า เมื่อฐานข้อมูลยังว่าง */
(function () {

  // PRNG แบบกำหนดค่าเริ่มต้น เพื่อให้ข้อมูลตัวอย่างเหมือนเดิมทุกครั้ง
  let seed = 20261114;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function daysAgo(d, h = 8, m = 0) {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(h, m, 0, 0);
    return t.toISOString();
  }

  function buildSeed() {
    const boys = ['ธนกร', 'ภูมิพัฒน์', 'กิตติพงษ์', 'ณัฐวุฒิ', 'ปภังกร', 'ศุภกฤต', 'วรเมธ', 'อนุชา', 'ธีรภัทร', 'พีรพล', 'จิรายุ', 'ชยพล'];
    const girls = ['ปุณยวีร์', 'กชกร', 'ณิชาภัทร', 'พิมพ์ชนก', 'อรอุมา', 'ธัญชนก', 'สุพิชญา', 'ชนิดา', 'วรรณิดา', 'ภัทรา', 'เบญญาภา', 'ศิริกานต์'];
    const lasts = ['ใจดี', 'แสงทอง', 'ศรีสุข', 'บุญมา', 'วงศ์ไทย', 'สุขเจริญ', 'ทองคำ', 'พรหมมา', 'อินทร์แก้ว', 'มีสุข', 'ชัยมงคล', 'รุ่งเรือง', 'คงดี', 'เพ็ชรงาม'];
    const nicksB = ['ต้น', 'ภูมิ', 'กิต', 'ณัฐ', 'ปั้น', 'ภู', 'เมธ', 'ชา', 'ธีร์', 'พี', 'จิ', 'ชัย'];
    const nicksG = ['ปุณ', 'กช', 'ณิชา', 'พิม', 'อร', 'ธัญ', 'พิชญ์', 'ดา', 'วรร', 'ภัท', 'เบญ', 'ศิริ'];
    const advisors = ['ครูสมศรี วงศ์ใหญ่', 'ครูประยุทธ ศรีวงศ์', 'ครูวิภาวดี แก้วกล้า', 'ครูอำนาจ ทองดี', 'ครูจันทร์เพ็ญ มณีรัตน์', 'ครูนพดล สายสุข'];
    const guardians = ['นายสมชาย', 'นางสมพร', 'นายวิชัย', 'นางมาลี', 'นายประเสริฐ', 'นางกาญจนา', 'นายบุญเลิศ', 'นางสุดา'];
    const places = ['ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี', 'ต.คลองสอง อ.คลองหลวง จ.ปทุมธานี', 'ต.คลองสาม อ.คลองหลวง จ.ปทุมธานี', 'ต.ประชาธิปัตย์ อ.ธัญบุรี จ.ปทุมธานี', 'ต.เชียงรากน้อย อ.บางปะอิน จ.พระนครศรีอยุธยา'];

    const students = [];
    let n = 0;
    for (let grade = 1; grade <= 6; grade++) {
      for (let room = 1; room <= 2; room++) {
        for (let no = 1; no <= 3; no++) {
          const boy = rnd() < 0.5;
          const i = Math.floor(rnd() * 12);
          const junior = grade <= 3;
          const yearIn = 2569 - grade + 1;
          n++;
          students.push({
            id: String(yearIn).slice(2) + String(100 + n).padStart(3, '0'),
            cid: '1' + Array.from({ length: 12 }, () => Math.floor(rnd() * 10)).join(''),
            prefix: boy ? (junior ? 'ด.ช.' : 'นาย') : (junior ? 'ด.ญ.' : 'นางสาว'),
            first: boy ? boys[i] : girls[i],
            last: pick(lasts),
            nick: boy ? nicksB[i] : nicksG[i],
            grade, room, no,
            advisor: advisors[(grade - 1 + room) % advisors.length],
            guardian: pick(guardians) + ' ' + pick(lasts),
            guardianPhone: '08' + Math.floor(rnd() * 10) + '-' + String(Math.floor(rnd() * 900) + 100) + '-' + String(Math.floor(rnd() * 9000) + 1000),
            address: (Math.floor(rnd() * 200) + 1) + '/' + (Math.floor(rnd() * 20) + 1) + ' ' + pick(places),
            status: 'studying',
          });
        }
      }
    }
    // ตัวอย่างสถานะอื่น ๆ
    students.push({ ...students[4], id: '66190', first: 'สิทธิชัย', last: 'ดวงดี', nick: 'สิทธิ์', prefix: 'นาย', grade: 4, room: 1, no: 9, status: 'moved' });

    const rules = [
      { id: 'r1', name: 'มาสาย', points: -2 },
      { id: 'r2', name: 'แต่งกายผิดระเบียบ', points: -3 },
      { id: 'r3', name: 'ทรงผมผิดระเบียบ', points: -3 },
      { id: 'r4', name: 'ไม่เข้าแถวเคารพธงชาติ', points: -5 },
      { id: 'r5', name: 'หนีเรียน / ออกนอกห้องโดยไม่ได้รับอนุญาต', points: -10 },
      { id: 'r6', name: 'ใช้โทรศัพท์ในเวลาเรียน', points: -5 },
      { id: 'r7', name: 'ทะเลาะวิวาท', points: -20 },
      { id: 'r8', name: 'สูบบุหรี่ / บุหรี่ไฟฟ้า', points: -30 },
      { id: 'p1', name: 'ช่วยเหลืองานโรงเรียน', points: 5 },
      { id: 'p2', name: 'เก็บของได้ส่งคืน', points: 10 },
      { id: 'p3', name: 'กิจกรรมคืนคะแนน (จิตอาสา)', points: 5, restore: true },
    ];
    const recorders = ['ครูสมศรี วงศ์ใหญ่', 'ครูอำนาจ ทองดี', 'ครูนพดล สายสุข', 'ครูเวรประจำวัน'];
    const records = [];
    const active = students.filter((s) => s.status === 'studying');
    // นักเรียนบางคนมีพฤติกรรมเยอะเป็นพิเศษ
    const heavy = [active[2], active[9], active[15], active[22], active[30]];
    active.forEach((s) => {
      const cnt = heavy.includes(s) ? 4 + Math.floor(rnd() * 4) : Math.floor(rnd() * 4);
      for (let k = 0; k < cnt; k++) {
        const r = heavy.includes(s) ? pick(rules.slice(0, 6)) : pick(rules);
        records.push({ id: uid() + k, studentId: s.id, ruleId: r.id, title: r.name, points: r.points, note: '', by: pick(recorders), at: daysAgo(Math.floor(rnd() * 80), 7 + Math.floor(rnd() * 8), Math.floor(rnd() * 60)), term: '2/2569' });
      }
    });
    records.push({ id: uid() + 'f1', studentId: active[9].id, ruleId: 'r7', title: 'ทะเลาะวิวาท', points: -20, note: 'มีปากเสียงและผลักกันที่โรงอาหาร', by: 'ครูนพดล สายสุข', at: daysAgo(3, 12, 20), term: '2/2569' });
    records.push({ id: uid() + 'f2', studentId: active[9].id, ruleId: 'r5', title: 'หนีเรียน / ออกนอกห้องโดยไม่ได้รับอนุญาต', points: -10, note: 'ไม่เข้าเรียนคาบ 5–6', by: 'ครูอำนาจ ทองดี', at: daysAgo(6, 13, 40), term: '2/2569' });
    // บันทึกของวันนี้
    records.push({ id: uid() + 't1', studentId: active[2].id, ruleId: 'r1', title: 'มาสาย', points: -2, note: 'มาถึง 08:10 น.', by: 'ครูเวรประจำวัน', at: daysAgo(0, 7, 52), term: '2/2569' });
    records.push({ id: uid() + 't2', studentId: active[7].id, ruleId: 'r2', title: 'แต่งกายผิดระเบียบ', points: -3, note: 'ไม่ใส่เข็มขัด', by: 'ครูอำนาจ ทองดี', at: daysAgo(0, 8, 15), term: '2/2569' });
    records.push({ id: uid() + 't3', studentId: active[11].id, ruleId: 'p1', title: 'ช่วยเหลืองานโรงเรียน', points: 5, note: 'ช่วยจัดสถานที่งานวันลอยกระทง', by: 'ครูนพดล สายสุข', at: daysAgo(0, 9, 30), term: '2/2569' });

    const topics = ['การเรียน', 'ครอบครัว', 'เพื่อน', 'สุขภาพจิต', 'การวางแผนอนาคต', 'พฤติกรรม'];
    const counselors = ['ครูพรทิพย์ แนะแนวดี (แนะแนว)', 'ครูสุนันทา ใจเย็น (แนะแนว)'];
    const counsel = [];
    [active[2], active[9], active[15], active[5], active[22], active[18], active[30], active[12]].forEach((s, idx) => {
      const times = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < times; k++) {
        const topic = pick(topics);
        const conf = topic === 'ครอบครัว' || topic === 'สุขภาพจิต';
        counsel.push({
          id: uid() + idx + k, studentId: s.id, at: daysAgo(5 + k * 14 + Math.floor(rnd() * 6), 10 + k, 0),
          counselor: pick(counselors), topic,
          detail: conf ? 'นักเรียนเล่าถึงความกังวลส่วนตัว ได้รับฟังและให้กำลังใจ' : 'พูดคุยเรื่อง' + topic + ' นักเรียนให้ความร่วมมือดี',
          plan: conf ? 'ติดตามอย่างใกล้ชิด ประสานครูที่ปรึกษา' : 'ติดตามผลการเรียน/พฤติกรรมในสัปดาห์ถัดไป',
          nextAt: k === 0 ? daysAgo(-(2 + Math.floor(rnd() * 10)), 10, 0) : '',
          level: conf ? 'confidential' : 'normal',
        });
      }
    });

    const screenings = [];
    active.forEach((s) => {
      const r = rnd();
      const result = heavy.includes(s) ? (r < 0.5 ? 'problem' : 'risk') : r < 0.82 ? 'normal' : 'risk';
      screenings.push({ id: uid() + s.id, studentId: s.id, at: daysAgo(30 + Math.floor(rnd() * 20), 13, 0), tool: 'SDQ', result, by: s.advisor, note: '' });
    });
    const visits = [];
    active.filter((_, i) => i % 3 === 0 || heavy.includes(active[i])).forEach((s) => {
      visits.push({ id: uid() + s.id, studentId: s.id, at: daysAgo(10 + Math.floor(rnd() * 50), 15, 0), by: s.advisor, note: 'พบผู้ปกครอง สภาพบ้านเหมาะสม ผู้ปกครองให้ความร่วมมือดี' });
    });
    const needs = [
      { id: uid() + 'n1', studentId: active[5].id, kind: 'สุขภาพ', text: 'โรคหอบหืด พกยาพ่นประจำตัว' },
      { id: uid() + 'n2', studentId: active[18].id, kind: 'ความต้องการพิเศษ', text: 'ภาวะสมาธิสั้น (ADHD) ควรนั่งหน้าห้อง' },
    ];
    const referrals = [
      { id: uid() + 'f1', studentId: active[9].id, at: daysAgo(12, 11, 0), type: 'internal', to: 'งานแนะแนว', note: 'ส่งต่อเพื่อให้คำปรึกษาเรื่องพฤติกรรม' },
      { id: uid() + 'f2', studentId: active[15].id, at: daysAgo(20, 11, 0), type: 'external', to: 'โรงพยาบาลคลองหลวง', note: 'ประเมินภาวะซึมเศร้า' },
    ];

    return {
      version: 1,
      settings: {
        year: 2569, term: 2,
        baseScore: 100, warnBelow: 70, alertBelow: 50,
        apps: { care: true, counsel: true, behavior: true },
        currentUserId: 'u1',
      },
      users: [
        { id: 'u1', name: 'ครูสมศรี วงศ์ใหญ่', role: 'admin' },
        { id: 'u2', name: 'ครูพรทิพย์ แนะแนวดี', role: 'counselor' },
        { id: 'u3', name: 'ครูอำนาจ ทองดี', role: 'teacher' },
      ],
      students,
      history: [
        { id: uid(), at: daysAgo(60, 9, 0), by: 'ครูสมศรี วงศ์ใหญ่', studentId: '', action: 'นำเข้าข้อมูล', detail: 'นำเข้าทะเบียนนักเรียนปีการศึกษา 2569 จำนวน ' + (students.length - 1) + ' คน' },
        { id: uid(), at: daysAgo(14, 10, 20), by: 'ครูสมศรี วงศ์ใหญ่', studentId: '66190', action: 'เปลี่ยนสถานะ', detail: 'กำลังศึกษา → ย้ายออก' },
      ],
      behavior: { rules, records },
      counsel,
      care: { screenings, visits, needs, referrals },
    };
  }

  window.buildSampleData = () => { seed = 20261114; return buildSeed(); };
})();
