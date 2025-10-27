# MultiAgentPOC Copilot Instructions

## Project Overview
This Node.js/TypeScript/Express app is a proof-of-concept for multi-agent dialog. A user chats with two agents in parallel. Each agent can respond to the user and to the other agent, simulating a 3-person conversation. The app provides a browser-based chat UI at `/chat` and automatically redirects users from `/` to `/chat` for convenience.


## Architecture
- `server/src/index.ts`: Express entry point, serves browser UI at `/chat`, redirects `/` to `/chat`, and exposes `/chat` POST endpoint for dialog
- `server/src/manager.ts`: `AgentManager` orchestrates dialog turns between user, agent1, and agent2
- `server/src/agent.ts`: `Agent` class, replaceable with real AI logic
- `client/src/MultiAgentChat.tsx`: React chat UI component for agent selection and messaging


## Key Patterns
- All dialog is managed as a sequence of turns (`DialogTurn[]`)
- Each `/chat` POST triggers: user message → agent1 response → agent2 response (can see prior turns)
- Agent logic is isolated for easy extension or replacement
- `/` endpoint redirects to `/chat` for user convenience
- `/chat` (GET): Serves a modern, interactive chat UI for browser users
- `/chat` (POST): Accepts `{ user, message }` JSON and returns the updated dialog


## Developer Workflow
1. Install dependencies in both `server/` and `client/`:
  - `cd server && npm install`
  - `cd ../client && npm install`
2. Start server (dev): `npx ts-node src/index.ts` from `server/` (requires Node.js 18+)
  - Or use VS Code launch tasks for debugging with ts-node/nodemon
3. Start React client (dev): `npm start` from `client/`
4. Open [http://localhost:3000/](http://localhost:3000/) in your browser (auto-redirects to `/chat` UI)
5. Interact with the chat UI, or send POST to `/api/chat` with `{ "agentId": "agent1", "message": "Hello agents!" }`
6. Extend agent logic in `server/src/agent.ts` or dialog flow in `server/src/manager.ts`

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
- Add more agents by updating `AgentManager`
- Replace `Agent.respond` with real AI or API calls
- Update the `/` endpoint to show a custom message if desired (currently redirects to `/chat`)

Keep instructions concise and up to date as the project evolves.
