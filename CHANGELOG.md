## [0.1.3] - 2025-10-29
- Documentation updated for agent creation and selection
## [0.2.0] - 2025-11-01
- UI: Persona preview is now clickable to open a modal for viewing/copying agent persona
- UI: "Use for New Agent" button in modal fills agent creation form with selected persona
- UI: Markdown rendering for all agent messages (not just names starting with 'agent')
- UI: Clear Chat button resets the conversation
- UI: Export Chat button downloads the full chat session as a .txt file
- UI: Agent creation form supports default instructions (markdown formatting, etc.) via checkboxes
- UI: Expanded persona input box and increased max length
- Backend: No changes required for markdown, agent persona, or export features
- Version bump: client 0.2.0, server 1.1.0

## [1.1.0] - 2025-11-01
- Server version bump for new UI features and agent creation improvements

# Changelog
- UI and backend now support dynamic agent control during agent-to-agent dialog
- Documentation updated for participant selection and live sync
#
## [0.1.4] - 2025-10-29
- Bug fix: Chat flicker resolved—frontend now robustly replaces temp agent turns with backend responses, preventing duplicate or blank entries
- Improved dialog sync logic for agent/user turns
- Documentation updated for agent creation, alternation, and dialog sync

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
