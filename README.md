# crud_day30

Node.js HTTP API dùng MongoDB Node.js driver thuần, không dùng ORM.

## Cài đặt và cấu hình

1. Cài Node.js 20.12 trở lên.
2. Cài dependencies: npm install
3. Sao chép .env.example thành .env rồi cấu hình:
   - MONGODB_URI: MongoDB local hoặc Atlas URI.
   - MONGODB_DB: tên database, mặc định crud_day30.
   - PORT: cổng HTTP, mặc định 3000.
   - MONGODB_SETUP_URI: URI tùy chọn dùng một lần cho tài khoản có quyền dbAdmin để cài schema/index.
4. Cài schema và index: npm run setup-db
5. Chuyển dữ liệu cũ vào MongoDB (idempotent): npm run migrate
6. Chạy server: npm start

Không commit .env. Với Atlas, dùng tài khoản readWrite cho MONGODB_URI; chỉ dùng tài khoản dbAdmin trong MONGODB_SETUP_URI khi chạy setup-db.

## Dữ liệu và API

- GET /products?limit=5: trả về mảng sản phẩm; limit phải là số nguyên dương.
- GET /products/:id: sản phẩm không tồn tại hoặc id sai định dạng trả 404.
- POST /products: nhận name, price, category; stock và cost tùy chọn, mặc định 0. cost không được trả về client.
- PUT /products/:id: cập nhật name, price, category mà không ghi đè stock hoặc cost.
- PATCH /products/:id: cập nhật các field được phép.
- PATCH /products/:id/stock: body gồm change là số nguyên khác 0; giảm tồn kho dùng phép cập nhật nguyên tử.
- DELETE /products/:id: xoá mềm, phản hồi 204.
- POST /customers: tạo khách hàng với name và email.
- POST /orders: nhận code, customerId và items [{ productId, quantity }]. Server lấy giá hiện tại từ DB và ghi snapshot vào đơn.
- GET /orders/:code: xem đơn.
- PATCH /orders/:code/status: chuyển đơn pending sang paid hoặc cancelled.
- GET /reports/revenue/by-customer: doanh thu đã thanh toán, tổng hợp trong MongoDB.

Ví dụ tạo đơn:

    POST /customers
    { "name": "An", "email": "an@example.com" }

Dùng _id trong phản hồi khách hàng cho customerId:

    POST /orders
    {
      "code": "ORD-001",
      "customerId": "<customer ObjectId>",
      "items": [{ "productId": 1, "quantity": 2 }]
    }

## Migration

Script migrate đọc database.json ở thư mục gốc nếu có, nếu không đọc src/data-sources/products.txt. Nó dùng upsert theo id nên chạy lại không tạo bản ghi trùng. File nguồn được giữ nguyên; chỉ xóa sau khi đã xác nhận dữ liệu trong MongoDB.

Transactions của tạo đơn/hủy đơn cần MongoDB replica set; Atlas đáp ứng yêu cầu này. MongoDB local dạng standalone không chạy được các route tạo/hủy đơn dùng transaction.