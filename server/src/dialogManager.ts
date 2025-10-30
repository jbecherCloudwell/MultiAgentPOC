// DialogManager: orchestrates agent alternation and turn-taking

function uuidv4() {
  return 'temp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export type DialogTurn = {
  id: string;
  speaker: string;
  message: string;
  timestamp?: number;
};


export class DialogManager {
  public agents: string[];
  private dialog: DialogTurn[];
  private lastSpeaker: string | null = null;
  private selectedAgent: string | null = null;
  private userTyping: boolean = false;
  private participantIds: string[] = [];

  constructor(agentIds: string[]) {
    this.agents = agentIds;
    this.dialog = [];
    this.participantIds = agentIds;
  }

  setParticipants(ids: string[]) {
    this.participantIds = ids;
    this.agents = ids;
  }
  getParticipants() {
    return this.participantIds;
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
    const turn: DialogTurn = {
      id: uuidv4(),
      speaker,
      message,
      timestamp: Date.now()
    };
    this.dialog.push(turn);
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
    const participants = this.participantIds.length > 0 ? this.participantIds : this.agents;
    const lastSpeaker = this.getLastSpeaker();
    // If last speaker is user, use selected agent if set
    if (!lastSpeaker || lastSpeaker === 'user') {
      if (this.selectedAgent && participants.includes(this.selectedAgent)) {
        return this.selectedAgent;
      }
      return participants[0];
    }
    // Otherwise, alternate among participants
    const idx = participants.indexOf(lastSpeaker);
    return participants[(idx + 1) % participants.length];
  }

  resetDialog() {
    this.dialog = [];
    this.lastSpeaker = null;
    this.selectedAgent = null;
  }
}
