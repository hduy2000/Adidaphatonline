# 🎨 Prompt tạo ảnh phật tử + bồ đoàn cho tool

> Dán các prompt dưới đây vào AI tạo ảnh (Bing Image Creator, Midjourney, Leonardo, Recraft, Nano Banana...).
> **Đọc phần "Yêu cầu kỹ thuật" trước khi tạo** — ảnh sai nền/góc nhìn là không ghép vào web được.

---

## ⚙️ Yêu cầu kỹ thuật (bắt buộc)

| Hạng mục | Yêu cầu |
|---|---|
| Định dạng | **PNG nền trong suốt** (transparent) |
| Kích thước | 1024×1024 (hoặc lớn nhất tool cho phép) |
| Khung hình | Nhân vật chiếm ~80% khung, **đầu hướng lên trên**, đứng thẳng, cách đều 4 mép |
| Góc nhìn | **Nhìn từ phía sau, chếch 3/4 từ trên xuống** (vì phật tử đi về phía bàn thờ + ngồi quay lưng xuống khán giả, giống video mẫu) |
| Bóng đổ | **KHÔNG cần** — tool tự vẽ bóng dưới chân |
| Bồ đoàn | **KHÔNG vẽ kèm** trong ảnh ngồi — tool ghép bồ đoàn riêng |
| Phong cách | 3D cartoon chibi kiểu Pixar, tông vàng ấm — khớp ảnh nền chùa |
| Nhất quán | Tạo cả bộ trong cùng 1 phiên chat/seed; nếu tool không giữ được nhân vật, thêm chữ "same character as the previous image" |

> **Nếu tool không tạo được nền trong suốt:** thay dòng nền bằng `isolated on plain solid bright green background (#00FF00), no shadow` rồi xóa nền tại **remove.bg** hoặc công cụ xóa nền bất kỳ.

---

## 1️⃣ PHẬT TỬ ĐI BỘ (bắt buộc — file `walk.png`)

```
A chibi little Buddhist monk character, 3D cartoon render, Pixar style, big round head and tiny body, seen from BEHIND at a slight 3/4 top-down angle, wearing a small conical Asian straw hat, saffron orange robe, walking pose with one foot forward and arms swinging naturally mid-step, walking toward a temple altar, soft warm cinematic lighting with subtle golden rim light, full body centered with margin around, isolated on transparent background, PNG cutout, no shadow on ground, no ground, no other objects, adorable
```

*(Tuỳ chọn đẹp hơn: tạo thêm `walk-2.png` — same prompt nhưng "the OTHER foot forward", tool sẽ tự phát 2 khung hình làm bước chân)*

## 2️⃣ PHẬT TỬ NGỒI KHẤN VÁI + NẾN HƯƠNG (bắt buộc — file `sit.png`)

```
A chibi little Buddhist monk character, 3D cartoon render, Pixar style, big round head and tiny body, seen from BEHIND at a slight 3/4 top-down angle, wearing a small conical Asian straw hat, saffron orange robe draped spread over folded legs, sitting in seiza kneeling pose on the floor, both hands raised together in prayer position holding a bundle of thin brown incense sticks, bowing slightly forward, soft warm cinematic lighting with subtle golden rim light, full body centered with margin around, isolated on transparent background, PNG cutout, no shadow on ground, no cushion, no ground, no other objects, adorable
```

## 3️⃣ PHẬT TỬ DÂNG HOA HỒNG (tuỳ chọn — file `sit-gift.png`, dùng khi có người tặng gift)

> ⚠️ Prompt này nhấn mạnh: **phật tử là nhân vật chính, hoa hồng chỉ là phụ kiện nhỏ 3 bông** — tránh việc AI sinh ra ảnh bó hoa to/giỏ hoa che mất nhân vật.

```
A chibi little Buddhist monk character holding three small red roses, 3D cartoon render, Pixar style, big round head and tiny body, seen from BEHIND at a slight 3/4 top-down angle, wearing a small conical Asian straw hat, pink robe draped spread over folded legs, sitting in seiza kneeling pose on the floor, both small hands raised forward offering just THREE small red roses with short stems, the roses are tiny, each rose much smaller than his head, NOT a large bouquet, no flower basket, no wrapping paper, no wedding bouquet, soft golden glowing aura around the body, sparkles, warm cinematic lighting, full body centered with margin around, the cute monk is the main subject and fully visible, isolated on transparent background, PNG cutout, no shadow on ground, no cushion, no ground, no other objects, adorable
```

**Mẹo tránh lỗi:** nếu ảnh vẫn ra bó hoa to hoặc thiếu phật tử, tăng mạnh phần nhân vật bằng cách thêm vào cuối: `the monk takes up 80% of the frame, the three roses are a tiny accessory in his hands`

## 4️⃣ BỒ ĐOÀN (tuỳ chọn — file `cushion.png`)

```
A traditional Vietnamese Buddhist prayer cushion (bồ đoàn), round flat woven rush cushion viewed from a high 45-degree top-down angle showing slight 3D thickness, deep crimson red fabric with concentric golden stitched rings, small golden round button at the center, short golden tassels on the side, photorealistic 3D render, warm temple lighting, centered, isolated on transparent background, PNG cutout, no shadow on ground, no ground, no other objects
```

---

## 🎨 Biến thể màu áo (thay dòng màu trong prompt trên)

| Muốn áo | Thay bằng |
|---|---|
| Vàng sặc (mặc định) | `saffron orange robe` |
| Trắng | `cream white robe` |
| Xám | `light grey robe` |
| Cam đất | `terracotta brown robe` |

Tạo 2–3 màu khác nhau rồi đặt thêm file `walk-2.png`, `sit-2.png`... — tool sẽ chọn màu ngẫu nhiên cho từng phật tử, cảnh sinh động hơn.

---

## 📁 Quy ước tên file — bỏ vào `D:\Tiktok\public\image\monk\`

```
public/image/monk/
├── walk.png        (bắt buộc) phật tử đi bộ
├── walk-2.png      (tuỳ chọn) khung bước chân 2
├── sit.png         (bắt buộc) ngồi khấn vái + nén hương
├── sit-gift.png    (tuỳ chọn) ngồi dâng hoa hồng
├── cushion.png     (tuỳ chọn) bồ đoàn
```

> Tạo xong các file này thì báo mình — mình tích hợp sprite vào tool thay cho nhân vật vẽ code: giữ nguyên bồ đoàn đỏ (hoặc dùng `cushion.png`), bubble comment, khói hương, hiệu ứng hoa hồng, và màu áo ngẫu nhiên nếu có nhiều bộ.
