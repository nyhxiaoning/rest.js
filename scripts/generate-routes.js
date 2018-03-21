const NEW_ROUTES = require('@octokit/routes')
const CURRENT_ROUTES = require('../lib/routes')

// map scopes from @octokit/routes to what we currently have in lib/routes.json
const mapScopes = {
  activity: 'activity',
  apps: 'apps',
  codesOfConduct: false,
  enterpriseAdmin: 'enterprise',
  gists: 'gists',
  git: 'gitdata',
  gitignore: false,
  issues: 'issues',
  licenses: false,
  markdown: false,
  migration: 'migrations',
  oauthAuthorizations: 'authorization',
  orgs: 'orgs',
  projects: 'projects',
  pulls: 'pullRequests',
  rateLimit: false,
  reactions: 'reactions',
  repos: 'repos',
  scim: false,
  search: 'search',
  teams: false,
  users: 'users'
}

const newRoutes = {}
Object.keys(NEW_ROUTES).forEach(scope => {
  const currentScopeName = mapScopes[scope]

  if (!currentScopeName) {
    return
  }

  newRoutes[currentScopeName] = NEW_ROUTES[scope]
})

// don’t break the deprecated "integrations" scope
newRoutes.integrations = newRoutes.apps.map(route => {
  return Object.assign({
    deprecated: '`integrations` has been renamed to `apps`'
  }, route)
})

// mutate the new routes to what we have today
Object.keys(CURRENT_ROUTES).sort().forEach(scope => {
  CURRENT_ROUTES[scope] = Object.keys(CURRENT_ROUTES[scope]).map(methodName => {
    const currentEndpoint = CURRENT_ROUTES[scope][methodName]

    if (currentEndpoint.method === 'GET' && currentEndpoint.url === '/repos/:owner/:repo/git/refs') {
      console.log('Ignoring custom override for GET /repos/:owner/:repo/git/refs (https://github.com/octokit/routes/commit/b7a9800)')
      return
    }

    if (currentEndpoint.url === '/repos/:owner/:repo/git/refs/tags') {
      console.log('Ignoring endpoint for getTags()')
      return
    }

    if (currentEndpoint.deprecated) {
      console.log(`No endpoint found for deprecated ${currentEndpoint.method} ${currentEndpoint.url}, leaving route as is.`)
      return
    }

    const newEndpoint = newRoutes[scope].find(newEndpoint => {
      return newEndpoint.method === currentEndpoint.method && newEndpoint.path === currentEndpoint.url
    })

    if (!newEndpoint) {
      throw new Error(`No endpoint found for ${currentEndpoint.method} ${currentEndpoint.url} (${JSON.stringify(currentEndpoint, null, 2)})`)
    }

    currentEndpoint.params = newEndpoint.params.reduce((map, route) => {
      map[route.name] = route
      delete route.name
      return map
    }, {})

    currentEndpoint.url = newEndpoint.path
    currentEndpoint.description = newEndpoint.description || newEndpoint.name
  })
})

const {diffString} = require('json-diff')
const {get} = require('lodash')
const CHECK = 'activity'

console.log(diffString(
  get(CURRENT_ROUTES, CHECK),
  get(newRoutes, CHECK)
))

// require('fs').writeFileSync('lib/routes.json', JSON.stringify(newRoutes, null, 2))
