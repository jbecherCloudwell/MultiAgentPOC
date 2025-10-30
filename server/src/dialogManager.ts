// DialogManager: orchestrates agent alternation and turn-taking

export type DialogTurn = {
  speaker: string;
  message: string;
};

export class DialogManager {
  public agents: string[];
  private dialog: DialogTurn[];
  private lastSpeaker: string | null = null;
  private selectedAgent: string | null = null;
  private userTyping: boolean = false;

  constructor(agentIds: string[]) {
    this.agents = agentIds;
    this.dialog = [];
  }

  setSelectedAgent(agentId: string) {
    this.selectedAgent = agentId;
  }
  getSelectedAgent() {
    return this.selectedAgent;
  }

  addAgent(agentId: string) {
    if (!this.agents.includes(agentId)) {
      this.agents.push(agentId);
    }
  }
  setUserTyping(typing: boolean) {
    console.log(`[DialogManager] setUserTyping called: ${typing}`);
    this.userTyping = typing;
    console.log(`[DialogManager] userTyping now: ${this.userTyping}`);
  }

  getUserTyping() {
    console.log(`[DialogManager] getUserTyping called, returning: ${this.userTyping}`);
    return this.userTyping;
  }

  addTurn(speaker: string, message: string) {
    this.dialog.push({ speaker, message });
    this.lastSpeaker = speaker;
  }

  getDialog() {
    return this.dialog;
  }

  getLastSpeaker() {
    if (this.lastSpeaker) return this.lastSpeaker;
    if (this.dialog.length === 0) return null;
    return this.dialog[this.dialog.length - 1].speaker;

  }

  setLastSpeaker(speaker: string) {
    this.lastSpeaker = speaker;
  }

  getNextAgent() {
    const lastSpeaker = this.getLastSpeaker();
    // If last speaker is user, use selected agent if set
    if (!lastSpeaker || lastSpeaker === 'user') {
      if (this.selectedAgent && this.agents.includes(this.selectedAgent)) {
        return this.selectedAgent;
      }
      return this.agents[0];
    }
    // Otherwise, alternate agents
    const idx = this.agents.indexOf(lastSpeaker);
    return this.agents[(idx + 1) % this.agents.length];
  }

  resetDialog() {
    this.dialog = [];
    this.lastSpeaker = null;
    this.selectedAgent = null;
  }
}
