const process = require('process');
const {spawn} = require('child_process');
const fs = require('fs');

const MENTION_PATH = './MENTIONS.md'
const README_PATH = './README.md'
const COMMENT_TAG_NAME = 'MENTIONS-LIST'
const COMMITTER_USERNAME = 'mentions-bot'
const COMMITTER_EMAIL = 'mentions-bot@example.com'
const COMMIT_MESSAGE = ':memo: Updated README with new mentions'

/**
 * Executes a command and returns its result as promise
 * @param cmd {string} command to execute
 * @param args {array} command line args
 * @param options {Object} extra options
 * @return {Promise<Object>}
 */
const exec = (cmd, args = [], options = {}) => new Promise((resolve, reject) => {
  let outputData = '';
  const optionsToCLI = {
    ...options
  };
  if (!optionsToCLI.stdio) {
    Object.assign(optionsToCLI, {stdio: ['inherit', 'inherit', 'inherit']});
  }
  const app = spawn(cmd, args, optionsToCLI);
  if (app.stdout) {
    // Only needed for pipes
    app.stdout.on('data', function (data) {
      outputData += data.toString();
    });
  }

  app.on('close', (code) => {
    if (code !== 0) {
      return reject({code, outputData});
    }
    return resolve({code, outputData});
  });
  app.on('error', () => reject({code: 1, outputData}));
});

/**
 * Builds the new readme by replacing the readme's <!-- MENTIONS-LIST:START --><!-- MENTIONS-LIST:END --> tags
 * @param previousContent {string} actual readme content
 * @param newContent {string} content to add
 * @return {string}: content after combining previousContent and newContent
 */
const buildReadme = (previousContent, newContent) => {
  const tagNameInput = COMMENT_TAG_NAME;
  const tagToLookFor = tagNameInput ? `<!-- ${tagNameInput}:` : `<!-- MENTIONS-LIST:`;
  const closingTag = '-->';
  const startOfOpeningTagIndex = previousContent.indexOf(
    `${tagToLookFor}START`,
  );
  const endOfOpeningTagIndex = previousContent.indexOf(
    closingTag,
    startOfOpeningTagIndex,
  );
  const startOfClosingTagIndex = previousContent.indexOf(
    `${tagToLookFor}END`,
    endOfOpeningTagIndex,
  );
  if (
    startOfOpeningTagIndex === -1 ||
    endOfOpeningTagIndex === -1 ||
    startOfClosingTagIndex === -1
  ) {
    // Exit with error if comment is not found on the readme
    console.error(
      `Cannot find the comment tag on the readme:\n${tagToLookFor}START -->\n${tagToLookFor}END -->`
    );
    process.exit(1);
  }
  return [
    previousContent.slice(0, endOfOpeningTagIndex + closingTag.length),
    '\n',
    newContent,
    '\n',
    previousContent.slice(startOfClosingTagIndex),
  ].join('');
};

/**
 * Unicode aware javascript truncate
 * @param str {string} string to truncated
 * @param length {number} length to truncate
 * @return {string} truncated value
 */
const truncateString = (str, length) => {
  const trimmedString = str.trim();
  const truncatedString = [...trimmedString].slice(0, length).join('');
  return truncatedString === trimmedString ?
    trimmedString : truncatedString.trim() + '...';
};

/**
 * Code to do git commit
 * @param githubToken {string} github token
 * @param readmeFilePaths {string[]} path to the readme file
 * @return {Promise<void>}
 */
const commitReadme = async (githubToken, readmeFilePaths) => {
  // Getting config
  const committerUsername = COMMITTER_USERNAME;
  const committerEmail = COMMITTER_EMAIL;
  const commitMessage = COMMIT_MESSAGE;
  // Doing commit and push
  await exec('git', [
    'config',
    '--global',
    'user.email',
    committerEmail,
  ]);
  if (githubToken) {
    // git remote set-url origin
    await exec('git', ['remote', 'set-url', 'origin',
      `https://${githubToken}@github.com/${process.env.GITHUB_REPOSITORY}.git`]);
  }
  await exec('git', ['config', '--global', 'user.name', committerUsername]);
  await exec('git', ['add', ...readmeFilePaths]);
  await exec('git', ['commit', '-m', commitMessage]);
  await exec('git', ['push']);
  console.log('Readme updated successfully in the upstream repository')
};

/**
 * Compound parameter parser, Updates obj with compound parameters and returns item name
 * @param sourceWithParam filter source with compound param eg: stackoverflow/Comment by $author/
 * @param obj {Object} object to update
 * @return {string} actual source name eg: stackoverflow
 */
const updateAndParseCompoundParams = (sourceWithParam, obj) => {
  const param = sourceWithParam.split('/'); // Reading params ['stackoverflow','Comment by $author', '']
  if (param.length === 3) {
    Object.assign(obj, {[param[0]]: param[1]});
    return param[0];// Returning source name
  } else {
    return sourceWithParam;
  }
};

/**
 * Returns parsed parameterised templates as array or return null
 * @param template
 * @param keyName
 * @return {null|string[]}
 */
const getParameterisedTemplate = (template, keyName) => {
  const key = '$' + keyName + '(';
  if (template.indexOf(key) > -1) {
    const startIndex = template.indexOf(key) + key.length;
    const endIndex = template.indexOf(')', startIndex);
    if (endIndex === -1) {
      return null;
    }
    return template.slice(startIndex, endIndex).split(',').map(item => item.trim());
  } else {
    return null;
  }
};

const mentionData = fs.readFileSync(MENTION_PATH, 'utf8');
const mentionMarkdown = mentionData.split('\n').map((mentionDataLine) => {
    let [githubUsername, link] = mentionDataLine.split('|')
    return `<a href="${link}"><img src="https://github.com/${githubUsername}.png?size=96" alt="${githubUsername}" width="96px" height="96px" /></a>`
}).join('\n')

const readmeData = fs.readFileSync(README_PATH, 'utf8');
const newReadme = buildReadme(readmeData, mentionMarkdown);
// if there's change in readme file update it
if (newReadme !== readmeData) {
    console.log('Writing to ' + README_PATH);
    fs.writeFileSync(README_PATH, newReadme);
}