## [0.1.3] - 2025-10-29
- Feature: Agent selection in UI and backend; selected agent responds first after user message
- Backend: DialogManager tracks selected agent and uses it for next response
- API: /api/chat now accepts agentId and sets selected agent for alternation
- Documentation updated for agent creation and selection
# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2025-10-29
- Bug fix: chat window auto-scroll logic now allows manual scrolling during streaming
- Updated documentation for new features and versioning
- Added CHANGELOG.md and semantic versioning to package.json
- Backend: turn-lock, agent alternation, DialogManager, streaming backend


## [0.1.2] - 2025-10-29
- Feature: Agent loop now restarts automatically when user clears text box, using most recent message
- Hybrid dialog management: frontend manages local state, backend enforces agent alternation and turn-lock
- Frontend: Optimistic UI, error handling, loading spinner, debounce typing state, dialog sync
- Backend: Strict alternation logic reviewed and confirmed robust
- Agents now communicate with each other and the user in a turn-based fashion
- DialogManager tracks last speaker and dialog turns
- Streaming backend implemented (SSE), frontend integration in progress
- Streaming backend implemented (SSE), frontend integration in progress
- Documentation updated to reflect new features and limitations
