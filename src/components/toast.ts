import { toast as notify, type TypeOptions } from "react-toastify";

// Duration is in milliseconds; the default is 4 seconds.
const createToast = (type: TypeOptions) => (message: string, duration = 4000) =>
  notify(message, { type, autoClose: duration });

export const toast = {
  success: createToast("success"),
  warning: createToast("warning"),
  info: createToast("info"),
  error: createToast("error"),
};
