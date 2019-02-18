const { prefix, commandDelimiter, commandLimit } = require('../config');
const aliases = require('../data/aliases');
const serializer = require('../util/serializer');

const processCommand = (message, content) => {
  const botMentionPrefixRegExp = new RegExp(`^<@!?${message.client.user.id}>`);
  const noPrefix = !prefix || !content.startsWith(prefix);
  const noBotMentionPrefix = !botMentionPrefixRegExp.test(content);

  // ignore if not a command
  if (noPrefix && noBotMentionPrefix) {
    return;
  }

  // parse content into command and arguments
  let args = content
    .replace(noBotMentionPrefix ? prefix : botMentionPrefixRegExp, '')
    .trim()
    .split(' ');
  let command = args.shift().toLowerCase();

  if (command in alias) {
    command = alias[command];
  }

  // ignore if command does not exist
  try {
    command = require(`../commands/${command}`);
  } catch {
    return;
  }

  console.log(
    (message.channel.type === 'text'
      ? `${message.guild.name}#${message.channel.name}|`
      : '') + `${message.author.tag}: ${content}`
  );

  return [
    () => {
      if (command.removeFalsyArgs) {
        args = args.filter(Boolean);
      }

      if (command.requireArgs && !args.length) {
        return;
      }

      return command.run(message, args);
    },
    command.deleteCommand
  ];
};

module.exports = async message => {
  // ignore bot messages
  if (message.author.bot) {
    return;
  }

  // ignore non-guild text channel messages
  // if (message.channel.type !== 'text') {
  //   return;
  // }

  // if at least one config setting is bad, treat content as one command
  const contents =
    !commandDelimiter.length || !commandLimit.length || commandLimit <= 1
      ? [message.content]
      : message.content.split(commandDelimiter).slice(0, commandLimit);

  const responses = contents
    .map(content => processCommand(message, content))
    .filter(Boolean);

  // ignore if all of content has no or bad commands
  if (!responses.length) {
    return;
  }

  // send messages synchronously
  await serializer(responses.map(response => response[0]));

  // if at least one command asks to delete, delete it
  const deleteCommand = responses.some(response => response[1]);
  if (deleteCommand) {
    message.delete();
  }
};
