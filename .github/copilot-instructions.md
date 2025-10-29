# MultiAgentPOC Copilot Instructions

## Project Overview
This Node.js/TypeScript/Express app is a proof-of-concept for multi-agent dialog. A user chats with two agents in parallel. Each agent can respond to the user and to the other agent, simulating a 3-person conversation. The app provides a browser-based chat UI at `/chat` and automatically redirects users from `/` to `/chat` for convenience.

## Architecture
- `server/src/index.ts`: Express entry point, serves browser UI at `/chat`, redirects `/` to `/chat`, and exposes `/chat` POST endpoint for dialog
- `server/src/dialogManager.ts`: `DialogManager` orchestrates dialog turns and tracks last speaker
- `server/src/ollamaAgent.ts`: `OllamaAgent` class, replaceable with real AI logic
- `client/src/MultiAgentChat.tsx`: React chat UI component for agent selection and messaging

## Key Features
- **Turn-based agent alternation**: Agents and user take turns; agents cannot respond multiple times in a row
- **Turn-lock mechanism**: Prevents agents from responding simultaneously or out of order
- **User-agent-agent dialog**: User message triggers agent1, then agent2 responds to agent1, enforcing strict alternation
- **DialogManager**: Tracks dialog turns and last speaker for robust turn-taking
- **Streaming (in progress)**: SSE endpoint streams agent responses token-by-token, but frontend streaming integration is not yet complete and may have bugs
- **Extensible agent logic**: Agent classes are isolated for easy extension or replacement
- **Frontend polling**: React UI polls backend for dialog updates and displays streaming tokens
- **Convenient routing**: `/` endpoint redirects to `/chat` for user convenience

## Developer Workflow
1. Install dependencies in both `server/` and `client/`:
   - `cd server && npm install`
   - `cd ../client && npm install`
2. Start server (dev): `npx ts-node src/index.ts` from `server/` (requires Node.js 18+)
   - Or use VS Code launch tasks for debugging with ts-node/nodemon
3. Start React client (dev): `npm start` from `client/`
4. Open [http://localhost:3000/](http://localhost:3000/) in your browser (auto-redirects to `/chat` UI)
5. Interact with the chat UI, or send POST to `/api/chat` with `{ "agentId": "agent1", "message": "Hello agents!" }`
6. Extend agent logic in `server/src/ollamaAgent.ts` or dialog flow in `server/src/dialogManager.ts`

## Conventions
- Use TypeScript imports without `.js` extension for ts-node
- Keep all source in `src/` and output in `dist/` if building
- No external AI dependencies by default—add as needed

## Example API Request
```
POST /chat
{
  "user": "Alice",
  "message": "Hello agents!"
}
```

## Extending
- Add more agents by updating `DialogManager` and agent classes
- Replace `OllamaAgent` logic with real AI or API calls
- Update the `/` endpoint to show a custom message if desired (currently redirects to `/chat`)

## Known Limitations & TODOs
- Streaming UI integration is incomplete; SSE backend streams tokens, but frontend may not display them correctly
- Only two agents are supported by default; add more by updating `DialogManager` and agent logic
- Error handling and agent reset features are basic

Keep instructions concise and up to date as the project evolves.
