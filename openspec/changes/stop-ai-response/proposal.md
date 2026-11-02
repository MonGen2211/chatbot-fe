# Proposal

## Why

Nút Stop hiện có chỉ ngắt stream: FE giữ chữ tạm với trạng thái `interrupted`, trong khi BE lưu `failed` với nội dung rỗng. Người dùng mất phần trả lời dở khi tải lại và không gửi tiếp được trong cùng cuộc trò chuyện; cần thống nhất hành vi dừng chủ động trên cả FE và BE.

## What Changes

- Hoàn thiện nút Dừng trả lời cho send, retry và edit: ngừng hiển thị delta ngay, yêu cầu BE dừng đúng lượt sinh và đồng bộ kết quả cuối.
- Thêm API Stop có xác thực, kiểm tra quyền sở hữu và generation token; hỗ trợ gọi lặp và xử lý cạnh tranh với hoàn tất, retry, edit, xóa conversation.
- Thêm trạng thái lưu trữ `stopped`, giữ nội dung BE đã sinh ở attempt hiện tại đến lúc xử lý Stop; phân biệt với lỗi, timeout và mất kết nối.
- Cho gửi tin mới sau khi BE xác nhận terminal; tải lại vẫn thấy nội dung đã dừng. Đưa nội dung stopped không rỗng vào context của tin sau.
- Giữ chính sách Retry chỉ dành cho `failed`; không bổ sung Continue/Regenerate cho `stopped` trong change này.
- Bổ sung hợp đồng API/SSE, kiểm thử FE/BE và hướng dẫn triển khai tương thích.

## Capabilities

### New Capabilities

- `chat-generation-stop`: Dừng chủ động một lượt AI đang trả lời, hủy upstream, giữ nội dung dở và khôi phục khả năng chat tiếp một cách nhất quán.

### Modified Capabilities

Không có capability đã đăng ký; inventory OpenSpec hiện rỗng.

## Impact

- Planning home: `ai-chat-ui/openspec/changes/stop-ai-response`; phạm vi sản phẩm gồm cả `ai-chat-ui` và repo sibling `ai-chat-be`. Change này chỉ tạo tài liệu tại planning home, không cấp thêm quyền ghi implementation ngoài root.
- FE: `src/features/chat/{chatService.ts,chatSlice.ts,useChat.ts,Message.ts}`, composer và message components; `tests/chat.test.cjs`.
- BE: chat routes/controllers/services, retry cancellation, repository, message/database types và message history; migration mới cho stop intent; tests service, HTTP và PostgreSQL.
- API mới: `POST /api/chat/messages/:message_id/stop`; mở rộng SSE conversation bằng generation token và message status bằng `stopped`.
- Không thêm dịch vụ bên ngoài; dùng PostgreSQL làm nguồn trạng thái chung giữa các BE instance. Không cam kết việc hủy HTTP sẽ thu hồi token/chi phí đã phát sinh tại nhà cung cấp.
- Ngoài phạm vi: tiếp tục từ chỗ dừng, retry stopped, thiết kế lại toàn bộ chat, hủy generation chỉ vì đóng tab/logout, và triển khai code trong bước propose.
