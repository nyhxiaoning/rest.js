const NEW_ROUTES = require('@octokit/routes')
const CURRENT_ROUTES = require('../lib/routes')
const MISC_SCOPES = [
  'codesOfConduct',
  // 'emojis', https://github.com/octokit/routes/issues/50
  'gitignore',
  'licenses',
  'markdown',
  'rateLimit'
]

NEW_ROUTES['misc'] = [].concat(...MISC_SCOPES.map(scope => NEW_ROUTES[scope]))
NEW_ROUTES['orgs'] = NEW_ROUTES['orgs'].concat(NEW_ROUTES['teams'])

// move around some methods ¯\_(ツ)_/¯
const ORG_USER_PATHS = [
  '/user/orgs',
  '/user/memberships/orgs',
  '/user/memberships/orgs/:org',
  '/user/teams'
]
const REPOS_USER_PATHS = [
  '/user/repository_invitations',
  '/user/repository_invitations/:invitation_id'
]
const APPS_USER_PATHS = [
  '/user/installations',
  '/user/installations/:installation_id/repositories',
  '/user/installations/:installation_id/repositories/:repository_id',
  '/user/marketplace_purchases',
  '/user/marketplace_purchases/stubbed'
]
NEW_ROUTES['users'].push(...NEW_ROUTES['orgs'].filter(endpoint => ORG_USER_PATHS.includes(endpoint.path)))
NEW_ROUTES['users'].push(...NEW_ROUTES['repos'].filter(endpoint => REPOS_USER_PATHS.includes(endpoint.path)))
NEW_ROUTES['users'].push(...NEW_ROUTES['apps'].filter(endpoint => APPS_USER_PATHS.includes(endpoint.path)))

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
  misc: 'misc',
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

  NEW_ROUTES[currentScopeName] = NEW_ROUTES[scope]

  newRoutes[currentScopeName] = {}
})

// don’t break the deprecated "integrations" scope
NEW_ROUTES.integrations = NEW_ROUTES.apps.map(route => {
  return Object.assign({
    deprecated: '`integrations` has been renamed to `apps`'
  }, route)
})

// mutate the new routes to what we have today
Object.keys(CURRENT_ROUTES).sort().forEach(scope => {
  Object.keys(CURRENT_ROUTES[scope]).map(methodName => {
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

    // TODO: https://github.com/octokit/routes/issues/50
    if (['getEmojis', 'getMeta'].includes(methodName)) {
      return
    }

    const newEndpoint = NEW_ROUTES[mapScopes[scope] || scope].find(newEndpoint => {
      // project_id, card_id, column_id => just id
      if (/:project_id/.test(newEndpoint.path)) {
        newEndpoint.path = newEndpoint.path.replace(/:project_id/, ':id')
        newEndpoint.params.forEach(param => {
          if (param.name === 'project_id') {
            param.name = 'id'
          }
        })
      }
      if (/:card_id/.test(newEndpoint.path)) {
        newEndpoint.path = newEndpoint.path.replace(/:card_id/, ':id')
        newEndpoint.params.forEach(param => {
          if (param.name === 'card_id') {
            param.name = 'id'
          }
        })
      }
      if (/:column_id/.test(newEndpoint.path)) {
        newEndpoint.path = newEndpoint.path.replace(/:column_id/, ':id')
        newEndpoint.params.forEach(param => {
          if (param.name === 'column_id') {
            param.name = 'id'
          }
        })
      }

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
    // we no longer need description, we can generate docs from @octokit/routes
    delete currentEndpoint.description
    Object.keys(currentEndpoint.params).forEach(name => {
      delete currentEndpoint.params[name].description
      if (currentEndpoint.params[name].required === false) {
        delete currentEndpoint.params[name].required
      }
    })

    newRoutes[scope][methodName] = currentEndpoint
  })
})

// const {diffString} = require('json-diff')
// const {get} = require('lodash')
// const CHECK = 'activity'
//
// console.log(diffString(
//   get(CURRENT_ROUTES, CHECK),
//   get(newRoutes, CHECK)
// ))

require('fs').writeFileSync('lib/routes.json', JSON.stringify(newRoutes, null, 2))
