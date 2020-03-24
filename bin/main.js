#!/usr/bin/env node
const meow = require('meow')

const cli = meow(`
    Usage
      $ dogecoin-spv <input>

    Options
      --rainbow, -r  Include a rainbow

    Examples
      $ dogecoin-spv unicorns --rainbow
      🌈 unicorns 🌈
`, {
    flags: {
        rainbow: {
            type: 'boolean',
            alias: 'r'
        }
    }
});
/*
{
    input: ['unicorns'],
    flags: {rainbow: true},
    ...
}
*/

console.log(cli.input[0], cli.flags);
