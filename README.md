# Omkoi Check — โปรแกรมดูวันว่างอมก๋อย

โปรเจ็กต์อิสระ Vue + JavaScript + Node.js มี Git และ workflow ของตัวเอง ไม่มี dependency หรือการเรียกข้อมูลจากโปรเจ็กต์เชียงดาว

เว็บไซต์: https://theera-droid.github.io/omkoiCheck/

Repository: https://github.com/theera-droid/omkoiCheck

## รันในเครื่อง

เปิด terminal ในโฟลเดอร์ `omkoi-check` แล้วรัน:

```powershell
npm.cmd install
npm.cmd run dev
```

เปิด http://127.0.0.1:5174 (backend พอร์ต 3002) ใช้พอร์ตแยกเพื่อเปิดพร้อมกับโปรแกรมอื่นได้ กด Ctrl+C เพื่อหยุด

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

หลัง build เปิด http://127.0.0.1:3002 ได้

## ตรวจข้อมูลอัตโนมัติ

- รอเปิดจอง 3 พฤศจิกายน 2569 ตามกำหนดที่แจ้ง พร้อมตรวจสถานะจริงจาก `/api/omkoi/open`
- เมื่อถึงวันที่กำหนด ระบบต้องเปิดและปฏิทินต้นทางต้องเป็นฤดูกาลใหม่ จึงเริ่มอ่านยอดเอง
- อ่านเฉพาะ GET `/api/omkoi/reservation/check-qty-people` โดยใช้ `qty_reserve` เป็นที่ว่าง และ `qty` เป็นโควตา ไม่ส่งรายการจอง
- อ่านพร้อมกันสูงสุด 3 วันต่อรอบ แล้วแสดงชุดข้อมูลพร้อมกัน เก็บเวลาอ่านสำเร็จแยกรายวัน
- ถ้าต้นทางล่มจะใช้ยอดล่าสุดที่เคยตรวจได้พร้อมป้ายข้อมูลเก่า ไม่เติมศูนย์ ถ้า API หรือปฏิทินเปลี่ยนรูปแบบที่ไม่รองรับจะแจ้งสถานะรอตรวจสอบ
- โหมด local มี cache ของตนเองใน `.cache/` โหมด GitHub Pages ใช้ Actions ทุกประมาณ 5 นาทีหรือมากกว่า และอ่านชุดที่เผยแพร่ก่อนหน้าเพื่อเก็บยอดเก่า

## ไฟล์หลัก

- `src/App.vue`: หน้าอมก๋อยแบบ standalone
- `server/omkoi.js`: ตรวจสถานะ อ่านปฏิทินและยอดจากต้นทาง
- `server/app.js`: API ภายในเครื่องและ cache
- `scripts/export-pages.js`: เตรียมข้อมูลสำหรับ Pages
- `.github/workflows/pages.yml`: อัปเดตและ deploy เฉพาะโปรแกรมอมก๋อย

ไม่ commit `.env`, cache, node_modules หรือไฟล์ build ระบบนี้ไม่ใช่เว็บไซต์ทางการและไม่รับจอง
