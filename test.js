const Docker = require('dockerode')

async function main () {
  const docker = new Docker()

  const container = docker.run('dogecoind', null, undefined, {
    name: 'dogecoind_regtest',
    HostConfig: {
      PortBindings: { '18444/tcp': [{ HostPort: '18444' }] },
      NetworkMode: 'host'
    }
  })

  console.log(container)
}

main()
