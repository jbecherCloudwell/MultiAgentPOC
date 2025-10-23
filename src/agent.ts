export class Agent {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async respond(input: string, dialog: { speaker: string; message: string }[]): Promise<string> {
    // POC: echo with agent name and count of dialog turns
    return `(${this.name}): I received: "${input}". Dialog so far: ${dialog.length} turns.`;
  }
}
