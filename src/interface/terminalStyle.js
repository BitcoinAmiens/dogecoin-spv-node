// those are escape characters
// see more here : https://en.wikipedia.org/wiki/ANSI_escape_code
const terminalStyle = {
  RESET: '\x1b[0m',
  BLACK: '\x1b[30m',
  WHITE_BACKGROUND: '\x1b[47m',
  BOLD: '\x1b[1m',
  NO_CURSOR: '\x1B[?25l',
  SHOW_CURSOR: '\x1B[?25h',
  CLEAR: '\x1b[J',
  SCROLL_UP: '\x1b[1J',
  SLOW_BLINKING: '\x1b[5m'
}

module.exports = terminalStyle
