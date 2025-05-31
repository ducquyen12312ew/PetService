# Hệ thống chăm sóc thú cưng - GoPetBet 🎲🃏
```bash
Videos và phần Demo của project trong Project-Media.
```
## 1. Phân chia công viêc:

| Họ tên - Tài khoản Github | MSSV | Công việc thực hiện |
| :---                      | :--: | :------------------ |
| Phan Đức Quyền - ducquyen12312ew | 20225916 | Thiết kế biểu đồ trình tự cho hệ thống.<br>Thiết kế giao diện hệ thống.<br>Thiết kế phần backend.<br>Tham gia test hệ thống. |
| Nguyễn Văn Hoàn - HoanxHoan | 20225718 | Phân tích yêu cầu, phân tích nghiệp vụ cho hệ thống.<br>Thiết kế kiến trúc và Use Case.<br>Thiết kế biểu đồ hoạt động cho hệ thống.<br>Tham gia test hệ thống. |
| Nguyễn Thanh Tân - turoisme | 20225923 | Thiết kế cơ sở dữ liệu.<br>Làm các chức năng kiểm thử đơn vị.<br>Tham gia test hệ thống. |
| Phan Hoàng Long - anybody1234 | 20225738 | Làm các chức năng kiểm thử đơn vị.<br>Phân tích yêu cầu, phân tích nghiệp vụ cho hệ thống.<br>Tham gia test hệ thống. |


## 2. Hướng dẫn sử dụng
# 2.1 Clone project:
```bash
git clone git@github.com:ducquyen12312ew/GoPetBet_ITSS_nhom2.git
```
Sau đó chuyển đến folder của project:
```bash
cd GoPetBet_ITSS_nhom2
```
# 2.2 Yêu cầu cài đặt: 
- Tải xuống `Node.js` from the official website: [Node.js](https://nodejs.org/)
- Chay trên terminal:
```bash
node -v
npm -v
npm install
```
- Cài đặt `nodemon`:
```bash
npm install -g nodemon
```
- Cài đặt `MongoDB`: [MongoDB Compass](https://www.mongodb.com/try/download/community)
- Sau đó cài đặt module Mongoose cho MongoDB:
```bash
npm install mongoose
```
# Chạy chương trình
```bash
Di chuyển đến folder chứa project
cd GoPetBet_ITSS_nhom2
nodemon src/index.js
```
Sau khi tập lệnh trên thực thi thành công, máy chủ cục bộ sẽ được khởi chạy. Mở liên kết sau trong trình duyệt web của bạn để xem trang web:
```bash
localhost:5000
```
Để đóng máy chủ, nhấn `control + C` trên cửa sổ terminal.
# Đăng nhập tài khoản
Bạn có thể mở trang web thú y để xem cơ sở dữ liệu trong user-friendly GUI. Mở liên kết sau, sau đó chọn đăng nhập:
```bash
localhost:5000
```
Sau đó, đăng nhập bằng tài khoản:
```bash
Bác sĩ thú y:
- Username: `vet`
- Password: `vet`
```
```bash
Người dùng:
- Username: `Gmail đăng ký của bạn`
- Password: `Mật khẩu đăng ký của bạn`
```
```bash
Admin:
- Username: `admin@gmail.com`
- Password: `123456789`
```














