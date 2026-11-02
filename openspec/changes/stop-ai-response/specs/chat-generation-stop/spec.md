
## ADDED Requirements

### Requirement: Stop is available throughout an active response
FE SHALL cung cấp nút Dừng trả lời cho send, retry và edit trong thời gian chờ hoặc nhận câu trả lời. Khi bấm, FE SHALL ngừng áp dụng delta ngay và h# Spec Delta

## Purpose

Cho phép người dùng dừng một lượt AI đang trả lời, giữ nội dung đã sinh và tiếp tục trò chuyện với trạng thái nhất quán giữa giao diện, backend và lịch sử lưu trữ.
iển thị trạng thái đang dừng đến khi nhận kết quả có thẩm quyền từ BE.

#### Scenario: Stop during streaming
- **WHEN** người dùng bấm Stop khi đang nhận delta
- **THEN** chữ đang hiển thị ngừng tăng ngay, kể cả delta đã đệm
- **AND** FE yêu cầu dừng lượt hiện tại và không mở lượt gửi mới khi chưa xác nhận

#### Scenario: Stop before response identity arrives
- **WHEN** người dùng bấm Stop trước khi FE nhận định danh assistant và generation từ BE
- **THEN** FE ghi nhận ý định dừng và gửi Stop ngay khi nhận được các định danh
- **AND** FE không ngắt kênh nhận định danh hoặc gửi Stop vào một lượt khác

### Requirement: Stop targets an authenticated generation
BE SHALL cung cấp `POST /api/chat/messages/:message_id/stop` với body `{ generation_id }`. BE MUST kiểm tra Bearer token, UUID, quyền sở hữu, role assistant và generation hiện tại trước khi thay đổi một lượt đang pending.

#### Scenario: Valid stop
- **WHEN** chủ sở hữu gửi Stop với generation token khớp assistant pending
- **THEN** BE ghi nhận yêu cầu dừng bền vững cho đúng lượt và trả kết quả có cấu trúc

#### Scenario: Invalid or unauthorized stop
- **WHEN** Stop thiếu phiên đăng nhập, có UUID không hợp lệ, trỏ đến message không tồn tại hoặc thuộc người khác, hoặc trỏ đến user message
- **THEN** BE lần lượt trả 401, 400, 404 hoặc 400 theo lỗi tương ứng và không thay đổi generation
- **AND** 404 không tiết lộ dữ liệu của chủ sở hữu khác

### Requirement: Stop cancels generation without automatic retry
Sau khi chấp nhận Stop, BE SHALL hủy upstream của lượt được nhắm tới và dừng mọi backoff hoặc automatic retry đang chờ. Hành vi này SHALL hoạt động khi request Stop và stream được xử lý bởi các BE instance khác nhau.

#### Scenario: Stop while provider is waiting
- **WHEN** Stop được chấp nhận trong lúc đang chờ token đầu hoặc đang đọc stream
- **THEN** BE truyền tín hiệu hủy tới request upstream và kết thúc lượt mà không tạo attempt tự động mới

#### Scenario: Stop during retry backoff across instances
- **WHEN** một instance chấp nhận Stop trong khi instance khác đang chờ backoff cho cùng generation
- **THEN** backoff bị hủy và không gọi provider cho attempt tiếp theo

### Requirement: Stopped content survives history reload
BE SHALL lưu kết quả dừng chủ động với status `stopped` và nội dung của attempt hiện tại đã tích lũy đến lúc xử lý hủy. FE SHALL đồng bộ theo bản lưu BE; bản này có thể chứa nhiều chữ hơn phần FE đã hiển thị trước Stop. Stop trước token đầu SHALL cho phép nội dung rỗng.

#### Scenario: Partial response is retained
- **WHEN** BE xử lý Stop sau khi đã tích lũy nội dung
- **THEN** bản ghi assistant trở thành `stopped`, giữ nội dung đó và không dùng thông báo lỗi provider
- **AND** tải lại lịch sử trả cùng status và nội dung; FE hiển thị nhãn Đã dừng

#### Scenario: No token or an attempt reset
- **WHEN** Stop xảy ra trước token đầu của attempt hiện tại, kể cả sau một reset do retry
- **THEN** BE lưu `stopped` với nội dung rỗng và không khôi phục chữ của attempt bị reset

### Requirement: Stop and completion have a single terminal outcome
BE MUST tuần tự hóa Stop và hoàn tất để một generation chỉ có một kết quả terminal. Yêu cầu lặp SHALL an toàn; Stop cũ SHALL không thay đổi generation mới. Kết quả sau edit hoặc xóa SHALL không hồi sinh message đã bị thay thế.

#### Scenario: Stop wins the race
- **WHEN** stop intent được commit trước transaction hoàn tất của cùng generation
- **THEN** kết quả cuối là `stopped`, kể cả provider vừa trả xong
- **AND** completion hoặc cleanup đến muộn không ghi đè status hay nội dung đã lưu

#### Scenario: Completion wins or Stop is repeated
- **WHEN** Stop đến sau khi message đã terminal, hoặc được gọi lại sau một Stop đã xử lý
- **THEN** BE trả bản ghi terminal hiện có và không đổi `completed` hoặc `failed` thành `stopped`

#### Scenario: Old stop targets a new retry
- **WHEN** assistant đang pending với generation mới nhưng Stop mang token của lượt trước
- **THEN** BE trả 409 `generation_mismatch` và không hủy lượt mới

#### Scenario: Edit or deletion removes the target
- **WHEN** edit hoặc xóa conversation đã xóa assistant trước khi Stop hay worker cũ hoàn tất
- **THEN** Stop trả 404 và worker không tạo lại message đã xóa

### Requirement: Continue chatting only after authoritative reconciliation
FE SHALL cho gửi tiếp sau khi xác nhận terminal và lịch sử không còn pending hoặc failed khác. `stopped` SHALL không chặn gửi. Context cho tin sau SHALL gồm assistant stopped không rỗng theo thứ tự lịch sử và giới hạn hiện có; assistant stopped rỗng SHALL bị loại. Retry thủ công SHALL tiếp tục chỉ hỗ trợ `failed`.

#### Scenario: Send after stopping
- **WHEN** BE xác nhận `stopped` và conversation không có message unresolved khác
- **THEN** composer cho gửi tin mới trong cùng conversation mà không cần refresh
- **AND** request tiếp theo nhận nội dung stopped không rỗng làm context

#### Scenario: Empty stopped answer
- **WHEN** người dùng gửi tiếp sau một câu trả lời stopped rỗng
- **THEN** hệ thống giữ user message trước đó trong lịch sử nhưng không gửi assistant rỗng làm context

#### Scenario: Stopped is not retryable
- **WHEN** người dùng xem message stopped hoặc gọi API retry vào message đó
- **THEN** FE không hiển thị Retry cho stopped và BE từ chối retry bằng 409

### Requirement: Stop acknowledgement is distinct from terminal confirmation
API Stop SHALL trả 200 kèm `{ success: true, data: { conversation_id, message } }` khi đã terminal, hoặc 202 kèm `{ success: true, data: { conversation_id, assistant_message_id, generation_id, stop_requested: true } }` khi mới ghi nhận. FE MUST tiếp tục đối soát qua stream hoặc lịch sử; lỗi mạng SHALL không được coi là đã dừng thành công.

#### Scenario: Accepted but not finalized
- **WHEN** API Stop trả 202
- **THEN** FE giữ trạng thái đang dừng, không áp dụng delta và không cho gửi tiếp đến khi xác nhận terminal

#### Scenario: Lost acknowledgement
- **WHEN** request Stop lỗi mạng hoặc SSE mất kết nối trong lúc đang dừng
- **THEN** FE đối soát lịch sử, giữ bản chữ tạm đến khi có kết quả và cho thử lại Stop nếu lượt vẫn pending
- **AND** FE không báo Đã dừng thành công chỉ dựa trên việc kết nối đã bị hủy

### Requirement: Unexpected interruptions remain distinguishable
Mất mạng, đóng tab, logout, timeout hoặc lỗi provider không có stop intent đã được chấp nhận SHALL không tự trở thành `stopped`. Nếu worker mất trước finalize, hệ thống SHALL phục hồi pending hết lease theo stop intent và nội dung checkpoint đã lưu.

#### Scenario: Disconnect without Stop
- **WHEN** stream bị ngắt mà BE chưa chấp nhận stop intent
- **THEN** hệ thống giữ chính sách lỗi/interrupted và stale recovery hiện có, không ghi nhãn dừng chủ động

#### Scenario: Worker dies after accepting Stop
- **WHEN** worker mất và pending hết lease sau khi Stop đã được chấp nhận
- **THEN** lần đối soát phục hồi message thành `stopped` với checkpoint hiện có, có thể rỗng
- **AND** worker cũ không thể gia hạn hoặc ghi đè kết quả phục hồi
