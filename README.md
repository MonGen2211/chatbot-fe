# React + TypeScript + Vite

Reusable notifications: mount `ToastNotifications` once (already included in `main.tsx`) and import `toast` from `src/components/toast`. The second argument is the lifetime in milliseconds, defaulting to 4000:

```ts
import { toast } from "./components/toast";

toast.success("Saved successfully", 3000);
toast.warning("Please check your input", 5000);
toast.info("Check your confirmation email", 7000);
toast.error("Something went wrong", 5000);
```

Authentication uses `http://localhost:3001` by default. Set `VITE_API_URL` in `.env.local` to change it, then restart Vite.

- `src/api/client.ts`: shared Axios client, base URL, Bearer header, and API error formatting.
- `src/features/auth/authService.ts`: calls login/register and maps `data.session.access_token`.
- `src/features/auth/authSlice.ts`: manages session, loading, and errors.
- `src/features/auth/useAuth.ts`: exposes auth state and actions to components.
- `src/features/auth/authStorage.ts`: preserves the session in this browser tab; logout clears it.

Components call `useAuth().submit("login" | "register", { email, password })`. Both routes sign the user in immediately using the backend JWT. Registration accepts passwords of at least 8 characters and at most 72 UTF-8 bytes. The session includes the backend user ID and token expiration. Old Supabase sessions are discarded; logout, expiration, or a protected API returning 401 clears the session and chat state. Passwords are never persisted. There is no refresh/logout endpoint.

Chat integration:

- API contract: `GET /api/conversations?limit=50&offset=0`, `GET /api/messages?conversation_id=<UUID>&limit=50&offset=0`, and `POST /api/chat` (SSE). FE uses these canonical routes rather than the legacy conversation subroutes.

- `src/features/chat/chatService.ts`: Axios for conversation/message GET requests; `fetch`, `TextDecoder`, and a frame buffer for POST SSE. All routes share the base URL in `src/api/client.ts`.
- `src/features/chat/chatSlice.ts`: list pagination, cached history, optimistic messages, backend IDs, stream updates, and interrupted replies.
- `src/features/chat/useChat.ts`: loads data, tracks session expiration, and connects the Stop button to an `AbortController`.
- The sidebar loads 50 conversations at a time with a Load more button. Opening a conversation automatically reads all history pages (50 messages per request) in oldest-to-newest order before enabling the composer.
- New Chat sends only `{ message }`. The server's `conversation` event supplies the real ID for subsequent requests. `done` replaces the temporary assistant message with its saved version. Partial replies remain marked as interrupted after an error, disconnect, or Stop. Requests are never retried automatically.
- Set backend `CORS_ORIGIN` if the frontend runs anywhere other than `http://localhost:5173`. Gemini credentials stay on the backend.

Run `npm test` for mocked API/SSE integration checks, `npm run lint`, and `npm run build`. Tests never contact Gemini or write to the backend database.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
