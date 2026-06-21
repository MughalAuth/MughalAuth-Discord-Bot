const { 
  ContainerBuilder, 
  SectionBuilder, 
  SeparatorBuilder, 
  SeparatorSpacingSize, 
  TextDisplayBuilder 
} = require('discord.js');
const os = require('os');
const path = require('path');

function progress_bar(percentage, length = 10) {
  const filled = Math.max(0, Math.min(length, Math.round(length * (percentage / 100))));
  const empty = length - filled;
  let emojiFilled = "🟩";
  let emojiEmpty = "⬛";
  
  if (percentage >= 80) {
    emojiFilled = "🔴";
    emojiEmpty = "⚫";
  } else if (percentage >= 60) {
    emojiFilled = "🟡";
    emojiEmpty = "⚫";
  }
  
  return emojiFilled.repeat(filled) + emojiEmpty.repeat(empty);
}

function get_disk_path() {
  if (process.platform === 'win32') {
    return path.parse(process.cwd()).root;
  }
  return '/';
}

function getCpuAverage() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  
  let idleMs = 0;
  let totalMs = 0;
  cpus.forEach((core) => {
    for (let type in core.times) {
      totalMs += core.times[type];
    }
    idleMs += core.times.idle;
  });
  
  return {
    idle: idleMs / cpus.length,
    total: totalMs / cpus.length
  };
}

async function getCpuUsage(intervalMs = 200) {
  const startMeasure = getCpuAverage();
  await new Promise(resolve => setTimeout(resolve, intervalMs));
  const endMeasure = getCpuAverage();
  
  const idleDifference = endMeasure.idle - startMeasure.idle;
  const totalDifference = endMeasure.total - startMeasure.total;
  
  const percentage = 100 - Math.round(100 * idleDifference / totalDifference);
  return isNaN(percentage) ? 0 : percentage;
}

/**
 * Builds a Message Components V2 ContainerBuilder with title, description, and separators.
 * @param {string} title Header/title
 * @param {string} description Main description content
 * @param {number} accentColor Optional accent hex color
 * @returns {ContainerBuilder} Constructed ContainerBuilder
 */
function buildV2Container(title, description, accentColor = 0x2f3136) {
  const container = new ContainerBuilder().setAccentColor(accentColor);
  
  const contentText = title ? `### ${title}\n\n${description}` : description;
  
  container.addSectionComponents(
    new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(contentText)
    )
  );
  
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );
  
  return container;
}

module.exports = {
  progress_bar,
  get_disk_path,
  getCpuUsage,
  buildV2Container
};
