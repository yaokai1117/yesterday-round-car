export class CommandHandler {
  constructor(name, description, callback) {
    this.name = name;
    this.description = description;
    this.callback = callback;
  }
}

export class CommandHandlerRegistry {
  constructor(handlers) {
    this.handlers = {};
    for (const handler of handlers) {
      this.handlers[handler.name] = handler;
    }
  }

  register(commandHandler) {
    this.handlers[commandHandler.name] = commandHandler;
  }

  unregister(commandName) {
    if (commandName in this.handlers) {
      delete this.handlers[commandName];
    }
  }

  handleCommand(data, res) {
    const { name } = data;
    const handler = this.handlers[name];
    if (handler == undefined) {
      res.status(400).send(`Bad request: unsupported command: ${name}`);
      return;
    }
    handler.callback(data, res);
  }

  generateHelpMessage() {
    const keys= Object.keys(this.handlers);
    keys.sort();
    var message = 'Supported commands: \n';
    message = message + keys.map((key) => `    ${this.handlers[key].name} --- ${this.handlers[key].description}\n`).join('');
    message = message + 'Have fun.';
    return message;
  }
}
