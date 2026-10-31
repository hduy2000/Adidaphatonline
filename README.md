# 🙏 Phật Tử Dâng Hương — TikTok Live Realtime

Tool livestream TikTok thời gian thực: mỗi **comment** trên livestream sẽ tạo ra một **phật tử bé** đi từ đáy sảnh ra **bồ đoàn** trước đàn hương, **ngồi khấn vái**, dâng nén hương (khói hương bay lên) và hiện **bong bóng lặp lại đúng câu comment** của người xem.

Tính năng:

- 💬 **Comment → phật tử dâng hương** + bong bóng lời nhắn (tên người xem màu vàng + nội dung comment)
- 🌹 **Gift (Hoa hồng...) → phật tử dâng hoa** + hiệu ứng hoa bay + popup `🌹 xN` + cộng tổng hoa
- ❤️ **Like → hoa sen bay** lên phía tượng Phật
- 🏆 **Bảng vàng dâng hương** — top 5 người dâng nhiều nhất (cập nhật realtime)
- 👥 **Panel "Người quen đã dâng lại"** — 5 người dâng gần nhất
- ✨ Thông báo gia nhập phòng / theo dõi
- 🧪 **Chế độ DEMO** — chạy thử toàn bộ hiệu ứng mà không cần live thật

---

## 1. Cài đặt (1 lần duy nhất)

Cần cài sẵn [Node.js](https://nodejs.org) phiên bản 18 trở lên. Sau đó trong thư mục dự án:

```
npm install
```

## 2. Chạy tool

```
npm start
```

hoặc chạy demo xem thử ngay (không cần live thật):

```
npm run demo
```

Server chạy tại `http://localhost:3000`:

| Trang | Địa chỉ | Dùng để |
|---|---|---|
| **Cảnh chính** | http://localhost:3000/ | Dán vào OBS / quay lên sóng |
| **Điều khiển** | http://localhost:3000/control | Nhập username, kết nối livestream, xem log |

## 3. Kết nối livestream TikTok

1. Mở http://localhost:3000/control
2. Nhập **username** của người đang live (không cần dấu `@` — ví dụ `tranvana.xxx`)
3. Bấm **▶ Kết nối livestream** — comment/gift/like sẽ bắt đầu đổ về cảnh

> Lưu ý: người livestream phải **đang phát trực tiếp** thì tool mới kết nối được.

### Nếu báo lỗi kết nối (signature/sign)

TikTok đôi khi chặn kết nối trực tiếp. Cách xử lý:

1. Mở **tiktok.com** trên máy tính bằng Chrome/Edge và **đăng nhập** (bất kỳ tài khoản nào)
2. Bấm **F12** → tab **Application** → **Cookies** → `https://www.tiktok.com`
3. Copy giá trị cookie **`sessionid`**
4. Mở file **`config.json`**, dán vào ô `"sessionid"`:
   ```json
   { "sessionid": "dán giá trị vào đây", ... }
   ```
5. Chạy lại `npm start`

## 4. Lên sóng TikTok qua OBS

1. Trong **OBS Studio**, thêm nguồn **Browser** (Browser Source):
   - URL: `http://localhost:3000/`
   - Width: **1080**, Height: **1920** (dọc 9:16)
   - Tick "Shutdown source when not visible" là không cần
2. Cảnh chùa sẽ hiển thị trong OBS — đặt làm nguồn chính
3. Bấm **Start Streaming**, chọn dịch vụ **TikTok Live** (hoặc dùng Custom RTMP của TikTok Live Studio)
4. Mở trang **control** để kết nối livestream và theo dõi comment

> Có thể cũng dùng **TikTok Live Studio** (phần mềm chính thức của TikTok): thêm nguồn trình duyệt/web tương tự.

## 5. Cài đặt tool

**Mọi cài đặt chỉnh trực tiếp tại trang điều khiển** http://localhost:3000/control — bấm **💾 LƯU CÀI ĐẶT** là lưu vĩnh viễn (vào `config.json`) và áp dụng ngay cho cảnh đang chạy:

| Nhóm | Cài đặt |
|---|---|
| 🔴 Kết nối | Username TikTok, Sessionid dự phòng (có hướng dẫn từng bước lấy ngay trên trang) |
| ⚙️ Cảnh | Số phật tử/bồ đoàn tối đa, thời gian hiện bình luận, tốc độ đi, **ảnh nền** (chọn từ `public/image/`), **chế độ hiển thị 2 bảng**: luôn hiện / thỉnh thoảng hiện / ẩn hẳn + chu kỳ hiện, đổi tiêu đề 2 bảng |
| 🧪 Demo | Tốc độ demo, bật/tắt gift, like, vào phòng |

Các giá trị cũng có thể sửa trực tiếp trong `config.json`:

| Khóa | Ý nghĩa | Mặc định |
|---|---|---|
| `port` | Cổng server | 3000 |
| `username` | Username mặc định, tự kết nối khi khởi động | "" |
| `sessionid` | Cookie dự phòng khi TikTok chặn kết nối | "" |
| `maxMonks` | Số phật tử/bồ đoàn tối đa (1–20) | 20 |
| `bubbleSeconds` | Giây hiện bubble bình luận (2–15) | 5 |
| `walkSpeed` | Tốc độ đi của phật tử (0.5–2) | 1 |
| `panelMode` | Hiển thị 2 bảng: `always` / `occasional` / `hidden` | occasional |
| `panelEveryMinutes` | [occasional] Mỗi N phút hiện bảng 1 lần (1–30) | 3 |
| `panelShowSeconds` | [occasional] Giữ bảng bao lâu mỗi lần (10–120 giây) | 30 |
| `showTotals` | Ẩn/hiện tổng hoa góc màn hình | true |
| `leaderboardTitle` / `recentTitle` | Tiêu đề 2 panel | — |
| `demoSpeed` | Tốc độ demo (0.5–3) | 1 |
| `demoGift` / `demoLike` / `demoJoin` | Bật/tắt sự kiện giả lập | true |

## 6. Cấu trúc dự án

```
├── server.js            # Server: HTTP + WebSocket + TikTok Live + Demo
├── config.json          # Cấu hình
├── package.json
└── public/
    ├── index.html       # Cảnh chính (cho OBS)
    ├── control.html     # Trang điều khiển
    └── js/
        ├── scene.js     # Nền chùa + tượng Phật + bồ đoàn vẽ bằng code
        ├── monk.js      # Phật tử: đi ra bồ đoàn -> ngồi khấn vái -> dâng hương -> bubble comment
        ├── effects.js   # Khói hương, hoa hồng, hoa sen, popup
        ├── panels.js    # Bảng xếp hạng + người quen đã dâng
        └── main.js      # WebSocket + vòng lặp render
```
