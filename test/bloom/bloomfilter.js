const {BloomFilter} = require('bfilter')
const {encodeFilterLoad} = require('../../src/commands/filterload')

const filter = new BloomFilter(24, 8, 0)

filter.add('n3ajdvaJC3BVB92pQnoJ88MN5exnFNDhxe', 'ascii')

filter.add('mgeBH9WW7qJqRWMDho9yH8qc7L7aSF872x', 'ascii')

console.log(filter)

console.log(filter.test('mgeBH9WW7qJqRWMDho9yH8qc7L7aSF872x', 'ascii'))
